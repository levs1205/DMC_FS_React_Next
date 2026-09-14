import { NextResponse, type NextRequest } from "next/server";
import { handleRouteError } from "@/lib/http/handle-route-error";
import { validateQuery } from "@/lib/http/validate-query";
import { bookingStatsSchema } from "@/modules/analytics/analytics.schemas";
import { analyticsService } from "@/modules/analytics/analytics.service";
import { requireApiSession } from "@/modules/auth/auth.session";

/**
 * GET /api/analytics/stats
 *
 * Las estadísticas del mismo conjunto de reservas que devuelve
 * /api/analytics/booking: acepta EXACTAMENTE los mismos filtros y agrega
 * `top` (cuántas filas traen los rankings, máx. 20).
 *
 * Devuelve totales (reservas, alumnos, noches, importe, ticket promedio,
 * mínimo y máximo) y cuatro desgloses: por estado, por tipo de habitación,
 * por mes y los rankings de alumnos y habitaciones.
 *
 * Ejemplo:
 *   /api/analytics/stats?from=2026-01-01&to=2026-12-31&status=PAID&top=5
 *
 * Ojo con una cosa al leer los números: sin filtro de `status` el importe
 * incluye TODAS las reservas, también las canceladas y las que fallaron al
 * pagar. Para hablar de ingresos reales hay que pedir `status=PAID`; el
 * desglose `byStatus` está justamente para poder distinguirlo.
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiSession("ADMIN");

    const query = validateQuery(
      bookingStatsSchema,
      request.nextUrl.searchParams
    );
    const stats = await analyticsService.getBookingStats(query);

    return NextResponse.json(stats);
  } catch (error) {
    return handleRouteError(error);
  }
}
