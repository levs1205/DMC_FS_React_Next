import { NextResponse, type NextRequest } from "next/server";
import { handleRouteError } from "@/lib/http/handle-route-error";
import { validateQuery } from "@/lib/http/validate-query";
import { bookingSearchSchema } from "@/modules/analytics/analytics.schemas";
import { analyticsService } from "@/modules/analytics/analytics.service";
import { requireApiSession } from "@/modules/auth/auth.session";

/**
 * GET /api/analytics/booking
 *
 * Listado de reservas filtrado, la "vista" que va a leer el chatbot.
 *
 * Filtros (todos opcionales y combinables):
 *   studentId=7                  alumno exacto
 *   student=ana                  búsqueda parcial por nombre o usuario
 *   from=2026-10-01&to=2026-10-31   rango de fechas, ambos extremos incluidos
 *   dateField=checkIn|checkOut|overlap   contra qué fecha se compara el rango
 *   minAmount=200&maxAmount=1500 rango de importe total
 *   status=PAID,PENDING          uno o varios estados
 *   roomType=SUITE,DOUBLE        uno o varios tipos de habitación
 *   roomId=3                     habitación exacta
 *
 * Paginación y orden: page, pageSize (máx. 100), sort, order.
 *
 * Ejemplo:
 *   /api/analytics/booking?student=ana&from=2026-10-01&to=2026-10-31&status=PAID
 *
 * Solo ADMIN. La sesión se valida acá aunque el proxy no toque /api: es este
 * handler el que entrega los datos, así que es acá donde tiene que estar la
 * guardia. Cuando el chatbot llame a este endpoint lo va a hacer con la sesión
 * del administrador que está conversando, nunca con una llave propia.
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiSession("ADMIN");

    const query = validateQuery(
      bookingSearchSchema,
      request.nextUrl.searchParams
    );
    const result = await analyticsService.searchBookings(query);

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
