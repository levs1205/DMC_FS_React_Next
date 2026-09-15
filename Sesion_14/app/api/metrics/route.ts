import { NextResponse, type NextRequest } from "next/server";
import { isProduction, observabilityConfig } from "@/lib/config/env";
import { renderMetrics } from "@/lib/observability/metrics";

/**
 * GET /api/metrics → métricas en el formato de texto de Prometheus.
 *
 * Se prueba con:
 *
 *   curl -H "Authorization: Bearer $METRICS_TOKEN" https://tu-app/api/metrics
 *
 * ## Por qué va protegido
 *
 * Porque cuenta más de lo que parece. El listado de `http_requests_total`
 * expone todas las rutas internas de la aplicación; `db_queries_total` revela
 * el modelo de datos; y el volumen de reservas por hora es información
 * comercial. Es reconocimiento gratis para quien esté mirando.
 *
 * Si no hay token configurado, el endpoint funciona en desarrollo y devuelve
 * 404 en producción. 404 y no 403: un 403 confirma que el endpoint existe.
 *
 * ## Recordatorio sobre serverless
 *
 * Lo que sale de aquí son los contadores de UNA instancia (ver el comentario
 * largo en `lib/observability/metrics.ts`). Con varias instancias activas, dos
 * llamadas seguidas pueden devolver números distintos y menores, y es
 * esperable. Para un panel de verdad hay que empujar las métricas a un colector
 * o derivarlas de los logs.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { metricsToken } = observabilityConfig;

  if (!metricsToken) {
    if (isProduction) {
      return NextResponse.json({ message: "Not found." }, { status: 404 });
    }
  } else if (!isAuthorized(request, metricsToken)) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  return new NextResponse(renderMetrics(), {
    status: 200,
    headers: {
      // La versión del formato va en el content type; es lo que espera el
      // scraper de Prometheus para parsear sin adivinar.
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isAuthorized(request: NextRequest, expected: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;

  return timingSafeEqual(provided, expected);
}

/**
 * Comparación en tiempo constante.
 *
 * `provided === expected` corta en el primer carácter distinto, y ese "corta
 * antes" es medible: probando carácter por carácter y midiendo el tiempo de
 * respuesta se puede reconstruir el token. El coste de evitarlo es recorrer
 * siempre la cadena entera.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;

  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return diff === 0;
}
