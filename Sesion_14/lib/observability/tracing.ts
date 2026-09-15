import {
  SpanStatusCode,
  trace,
  type Attributes,
  type Span,
} from "@opentelemetry/api";
import { observabilityConfig } from "@/lib/config/env";

/**
 * Utilidades para crear spans propios.
 *
 * Next.js ya instrumenta lo suyo (el request, el render de cada ruta, cada
 * `fetch`). Lo que no puede saber es qué significan *tus* operaciones: "cobrar
 * la reserva" o "preguntarle al modelo" son conceptos del dominio. Un span
 * propio pone esa etiqueta en la línea de tiempo, y es la diferencia entre ver
 * "el request tardó 3 segundos" y ver "el request tardó 3 segundos, de los
 * cuales 2,8 los pasó esperando a Mercado Pago".
 *
 * Reglas de atributos que conviene respetar:
 * - Valores de **baja cardinalidad**. `route: "/api/booking/[id]"` sí;
 *   `url: "/api/booking/91827"` no: cada valor distinto es una serie nueva.
 * - Nada de datos personales ni secretos. Las trazas se exportan a terceros.
 */

const tracer = trace.getTracer(observabilityConfig.serviceName);

/**
 * Envuelve una operación asíncrona en un span.
 *
 * El span se cierra siempre —incluso si `fn` lanza— y los errores quedan
 * grabados con `recordException`, que es lo que hace que el visor de trazas
 * pinte el tramo en rojo y guarde el stack.
 */
export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });

      return result;
    } catch (error) {
      if (error instanceof Error) span.recordException(error);

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });

      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Cronómetro monótono.
 *
 * Usa `performance.now()` y no `Date.now()` a propósito: el reloj de pared
 * puede saltar hacia atrás (ajuste NTP, cambio de horario) y producir
 * duraciones negativas. El reloj monótono solo avanza.
 */
export function startTimer(): () => number {
  const startedAt = performance.now();

  return () => performance.now() - startedAt;
}

/** Id de la traza en curso, para pegarlo en una respuesta o en un log. */
export function currentTraceId(): string | undefined {
  return trace.getActiveSpan()?.spanContext().traceId;
}
