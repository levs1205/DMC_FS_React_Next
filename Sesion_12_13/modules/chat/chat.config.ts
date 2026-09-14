import "server-only";

import { GoogleGenAI } from "@google/genai";

/**
 * Configuración del modelo de Google (Gemini).
 *
 * Misma idea que `mercadopago.config`: la lectura es PEREZOSA. La app tiene
 * que arrancar y seguir vendiendo habitaciones aunque nadie haya cargado
 * todavía la clave del chat; el error aparece recién cuando alguien abre el
 * asistente, diciendo exactamente qué falta.
 *
 * `import "server-only"` es la barrera importante: la API key de Google es un
 * secreto de servidor. Si por accidente alguien importa este archivo desde un
 * Client Component, el build falla en vez de empaquetar la clave dentro del
 * JavaScript que baja al navegador. Por eso tampoco se llama `NEXT_PUBLIC_`
 * a la variable: ese prefijo la publicaría en el bundle.
 */

/**
 * Modelo por defecto. Se puede pisar con GEMINI_MODEL sin tocar código, que es
 * lo que conviene: la familia de modelos de Google cambia de nombre bastante
 * más seguido que este archivo.
 *
 * Se eligió 3.6-flash y no el 3.8-flash que la documentación marca como
 * recomendado porque, probando contra la API de verdad, el 3.8 contestaba 503
 * "high demand" de forma sostenida (tres reintentos seguidos sin entrar) y el
 * 3.6 respondía en ~2,5 s. Es además el reemplazo que Google indica en el
 * error de baja del 2.5-flash. Cuando el 3.8 se descongestione, alcanza con
 * poner GEMINI_MODEL=gemini-3.8-flash: no hay nada más que cambiar.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

/** Cuántas vueltas de herramientas se le permiten al modelo en un turno. */
export const MAX_TOOL_TURNS = 5;

/** Tope de mensajes previos que se reenvían como contexto de la charla. */
export const MAX_HISTORY_MESSAGES = 20;

/**
 * Tiempo máximo de cada llamada al modelo, apertura y streaming incluidos.
 * Sin esto, un modelo que se cuelga —pasa— deja la pantalla en "Pensando…"
 * para siempre.
 */
export const MODEL_TIMEOUT_MS = 60_000;

/**
 * Esperas antes de reintentar cuando Google devuelve un 5xx. Los modelos
 * nuevos contestan 503 "high demand" cada tanto y se recuperan en segundos.
 */
export const RETRY_DELAYS_MS = [1_000, 4_000, 8_000];

let client: GoogleGenAI | null = null;

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

/**
 * Cliente del SDK, creado una sola vez por proceso.
 *
 * El SDK es `@google/genai` (el unificado, que sirve para la Gemini API y para
 * Vertex AI). El viejo `@google/generative-ai` está discontinuado: si
 * encontrás un tutorial que lo use, está desactualizado.
 */
export function getGeminiClient(): GoogleGenAI {
  if (client) return client;

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      'Falta configurar la variable de entorno "GEMINI_API_KEY" para poder usar el asistente. Se saca de Google AI Studio → Get API key.'
    );
  }

  client = new GoogleGenAI({ apiKey });

  return client;
}
