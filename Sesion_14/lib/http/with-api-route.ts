import "server-only";

import type { NextRequest } from "next/server";
import { observabilityConfig } from "@/lib/config/env";
import { handleRouteError } from "@/lib/http/handle-route-error";
import { logger } from "@/lib/observability/logger";
import { metrics } from "@/lib/observability/metrics";
import {
  createRequestId,
  runWithRequestContext,
} from "@/lib/observability/request-context";
import { startTimer } from "@/lib/observability/tracing";

/**
 * Envoltorio para route handlers: mide, registra y captura.
 *
 * Todo route handler termina haciendo las mismas cinco cosas alrededor de su
 * lógica real —abrir el contexto del request, cronometrar, contar, registrar el
 * resultado, traducir el error a una respuesta HTTP—. Repetirlas en cada
 * archivo garantiza que tarde o temprano una quede mal. Aquí se escriben una
 * vez.
 *
 * Uso:
 *
 * ```ts
 * export const GET = withApiRoute("/api/booking", async () => {
 *   await requireApiSession("ADMIN");
 *   return NextResponse.json(await bookingService.listBookings());
 * });
 * ```
 *
 * El primer argumento es el PATRÓN de la ruta, no la URL. Es importante:
 * `/api/booking/[id]` es una etiqueta con cinco valores posibles, mientras que
 * `/api/booking/1837` sería una serie temporal nueva por cada reserva. Esa
 * explosión de cardinalidad es la forma más común de arruinar (y encarecer) un
 * sistema de métricas.
 */
export function withApiRoute<Context = unknown>(
  route: string,
  handler: (request: NextRequest, context: Context) => Promise<Response>
): (request: NextRequest, context: Context) => Promise<Response> {
  return async (request, context) => {
    const method = request.method;

    /**
     * El id del request se hereda si ya viene de afuera y solo se inventa como
     * último recurso. El orden importa:
     *
     * 1. `x-request-id` — lo pone nuestro propio proxy, o un cliente que quiera
     *    correlacionar sus llamadas con nuestros logs.
     * 2. `x-vercel-id` — lo pone la plataforma. Reutilizarlo permite cruzar
     *    nuestros logs con los del borde de Vercel para el mismo request.
     * 3. Uno nuevo.
     */
    const requestId =
      request.headers.get("x-request-id") ??
      request.headers.get("x-vercel-id") ??
      createRequestId();

    return runWithRequestContext({ requestId, method, route }, async () => {
      const elapsed = startTimer();
      let response: Response;

      try {
        response = await handler(request, context);
      } catch (error) {
        // El handler no atrapó: `handleRouteError` decide el código y registra.
        response = handleRouteError(error);
      }

      const durationMs = elapsed();
      const status = response.status;
      const labels = { method, route, status };

      metrics.httpRequestsTotal.inc(labels);
      metrics.httpRequestDurationMs.observe(durationMs, labels);

      const fields = { status, durationMs: Math.round(durationMs) };

      // El nivel lo decide el resultado: un 500 es un problema nuestro y va a
      // `error`; un 4xx suele ser el cliente mandando algo mal y va a `warn`;
      // el resto es tráfico normal.
      if (status >= 500) {
        logger.error("request fallido", fields);
      } else if (status >= 400) {
        logger.warn("request rechazado", fields);
      } else if (durationMs > observabilityConfig.slowRequestMs) {
        logger.warn("request lento", fields);
      } else {
        logger.info("request", fields);
      }

      return withTraceHeaders(response, requestId, durationMs);
    });
  };
}

/**
 * Devuelve la respuesta con dos cabeceras de diagnóstico.
 *
 * - `x-request-id`: para que quien reporte un fallo pueda pegar ese id y uno
 *   encuentre el request exacto entre millones de líneas de log.
 * - `Server-Timing`: las DevTools del navegador la dibujan en la pestaña
 *   Network, junto al resto de los tiempos. Es telemetría gratis y visible sin
 *   ninguna herramienta extra.
 *
 * Se clona la respuesta porque las `Headers` de una `Response` ya construida son
 * inmutables.
 */
function withTraceHeaders(
  response: Response,
  requestId: string,
  durationMs: number
): Response {
  const headers = new Headers(response.headers);

  headers.set("x-request-id", requestId);
  headers.set("Server-Timing", `app;dur=${durationMs.toFixed(1)}`);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
