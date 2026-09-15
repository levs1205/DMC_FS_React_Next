import { NextResponse } from "next/server";
import { ApiError } from "@/lib/http/api-error";
import { logger } from "@/lib/observability/logger";
import { metrics } from "@/lib/observability/metrics";
import { getRequestContext } from "@/lib/observability/request-context";

/**
 * Traduce cualquier excepción a una respuesta HTTP.
 *
 * La distinción que gobierna todo el archivo es entre un error *esperado* y uno
 * *no esperado*:
 *
 * - Un `ApiError` es una decisión del dominio ("esas fechas se pisan", "no
 *   tienes permiso"). El mensaje está escrito para que lo lea un usuario, y se
 *   devuelve tal cual. No es una avería: no cuenta como error del sistema.
 *
 * - Cualquier otra cosa es un fallo nuestro. Al cliente se le devuelve un
 *   mensaje genérico —el texto de un error interno puede filtrar nombres de
 *   tablas, rutas del servidor o fragmentos de consultas, que es justo el
 *   material con el que se prepara un ataque— y el detalle completo va al log,
 *   que sí es nuestro.
 *
 * En los dos casos la respuesta lleva el `requestId`, para que un usuario que
 * reporta "me salió error" traiga consigo la llave exacta del incidente.
 */
export function handleRouteError(error: unknown): NextResponse {
  const requestId = getRequestContext()?.requestId;

  if (error instanceof ApiError) {
    logger.debug("error de negocio", {
      status: error.statusCode,
      reason: error.message,
    });

    return NextResponse.json(
      { message: error.message, requestId },
      { status: error.statusCode }
    );
  }

  const context = getRequestContext();

  metrics.errorsTotal.inc({
    route: context?.route ?? "unknown",
    type: "unhandled",
  });

  logger.error("error no controlado en un route handler", {
    err: error instanceof Error ? error : new Error(String(error)),
  });

  return NextResponse.json(
    { message: "Error interno del servidor.", requestId },
    { status: 500 }
  );
}
