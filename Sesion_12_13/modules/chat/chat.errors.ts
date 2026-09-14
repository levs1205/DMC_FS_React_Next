import "server-only";

import { ApiError as GeminiApiError } from "@google/genai";

/**
 * Traducción de las fallas del proveedor a algo que se pueda leer.
 *
 * El SDK tira el cuerpo del error de Google tal cual, que viene con el JSON
 * anidado y escapado dos veces: mostrarlo en pantalla es inservible. Peor
 * todavía, la mitad de esos errores se arreglan cambiando una variable de
 * entorno, así que el mensaje tiene que decir cuál.
 */

/**
 * ¿Conviene reintentar?
 *
 * Solo los 5xx: son fallas del lado de Google que suelen durar segundos
 * (el 503 "high demand" aparece bastante en los modelos nuevos). Un 429 NO se
 * reintenta: es la cuota, y golpear de nuevo solo la gasta más rápido.
 */
export function isRetryableModelError(error: unknown): boolean {
  return error instanceof GeminiApiError && error.status >= 500;
}

/**
 * Cuánto pide esperar Google antes de reintentar.
 *
 * En los 429 por cuota POR MINUTO —el caso normal de la capa gratuita, que
 * permite 5 llamadas por minuto y por modelo— el error trae un `retryDelay`
 * de un par de segundos. Esperarlo y reintentar es lo correcto: la cuota se
 * repone sola. Si el tope fuera diario no viene ese dato, o viene enorme, y
 * entonces no tiene sentido esperar: por eso solo se honran las esperas
 * cortas.
 *
 * Se lee con una expresión regular porque el SDK entrega el cuerpo del error
 * como texto con el JSON de Google escapado adentro.
 */
const MAX_HONORED_RETRY_DELAY_MS = 15_000;

export function getSuggestedRetryDelayMs(error: unknown): number | null {
  if (!(error instanceof GeminiApiError)) return null;

  const match = /retryDelay[^0-9]{0,12}(\d+)s/.exec(error.message);

  if (!match) return null;

  const delay = Number(match[1]) * 1000;

  // Medio segundo de margen: el reloj de Google y el nuestro no son el mismo.
  return delay > 0 && delay <= MAX_HONORED_RETRY_DELAY_MS ? delay + 500 : null;
}

/** ¿El corte lo pidió el navegador, o se nos venció el tiempo a nosotros? */
export function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

export function describeModelError(error: unknown, model: string): string {
  if (error instanceof GeminiApiError) {
    switch (error.status) {
      case 503:
        return `El modelo ${model} está saturado en este momento (503). Ya se reintentó y sigue sin responder: probá de nuevo en un minuto, o pasá a otro modelo con GEMINI_MODEL (por ejemplo gemini-3.5-flash).`;
      case 429:
        return "Se agotó la cuota de la API de Google (429) y el reintento tampoco entró. La capa gratuita permite 5 llamadas por minuto y por modelo, y cada pregunta del asistente gasta una por cada consulta que encadena: esperá un minuto o revisá tu plan en AI Studio.";
      case 404:
        return `El modelo ${model} no está disponible para esta API key (404). Elegí otro con la variable GEMINI_MODEL.`;
      case 400:
      case 401:
      case 403:
        return `Google rechazó la petición (${error.status}). Suele ser la GEMINI_API_KEY: verificá que sea válida y que tenga habilitada la API de Gemini.`;
      default:
        return `El proveedor devolvió un error ${error.status}.`;
    }
  }

  if (isAbortError(error)) {
    return "El modelo no respondió a tiempo. Probá de nuevo o con una pregunta más acotada.";
  }

  return error instanceof Error
    ? error.message
    : "El asistente no pudo responder.";
}
