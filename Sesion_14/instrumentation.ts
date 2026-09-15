import { registerOTel } from "@vercel/otel";
import type { Instrumentation } from "next";

/**
 * Punto de arranque de la observabilidad.
 *
 * Next.js llama a `register()` UNA vez por instancia del servidor, antes de
 * atender el primer request. Es el único lugar donde se puede inicializar un
 * SDK de tracing a tiempo para que alcance a instrumentar todo lo demás.
 *
 * `registerOTel` de `@vercel/otel` monta el SDK de OpenTelemetry con la
 * configuración correcta para cada entorno: en Vercel exporta a la
 * infraestructura de la plataforma sin pedir nada; fuera de Vercel, exporta por
 * OTLP a donde apunte `OTEL_EXPORTER_OTLP_ENDPOINT` (Jaeger, Grafana Tempo,
 * Axiom, un colector propio). Ese es el sentido de usar OpenTelemetry en lugar
 * del SDK de un proveedor concreto: se cambia de backend sin tocar el código.
 *
 * Next.js emite bastantes más spans de los que exporta por defecto. Para ver
 * todos —incluida la resolución de módulos y de metadatos— hay que poner
 * `NEXT_OTEL_VERBOSE=1`.
 */
export function register(): void {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "reservas",
  });
}

/**
 * Gancho para TODO error del servidor: los que revientan en un Server
 * Component, en una Server Action, en un route handler o en el proxy.
 *
 * Es la red de seguridad. Los errores que un route handler atrapa ya se
 * registran en `handleRouteError`, pero los que se escapan de un render nunca
 * pasan por ahí: sin este gancho se los lleva el `error.tsx` y en el servidor
 * solo queda un rastro genérico de React.
 *
 * Aquí es donde se enchufaría Sentry, Rollbar o similar. Nosotros lo dejamos en
 * el logger estructurado, que en Vercel ya es consultable.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  // El logger usa `node:async_hooks`, que no existe en el runtime Edge; y en
  // ese runtime este archivo también se ejecuta. La importación dinámica y
  // condicional evita romper el build del bundle Edge.
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    console.error("[onRequestError]", context.routePath, error);
    return;
  }

  const [{ logger }, { metrics }] = await Promise.all([
    import("@/lib/observability/logger"),
    import("@/lib/observability/metrics"),
  ]);

  // `digest` es el hash que React le pone al error cuando lo procesa durante el
  // render: en el navegador es lo único que se ve del error, así que registrarlo
  // es lo que permite cruzar "el usuario reporta el digest X" con este log.
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest: unknown }).digest)
      : undefined;

  metrics.errorsTotal.inc({
    route: context.routePath,
    type: context.routeType,
  });

  logger.error("error no controlado en el servidor", {
    err: error instanceof Error ? error : new Error(String(error)),
    digest,
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
  });
};
