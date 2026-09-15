import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/http/api-error";
import { withApiRoute } from "@/lib/http/with-api-route";
import { requireApiSession } from "@/modules/auth/auth.session";
import { bookingService } from "@/modules/bookings/booking.service";
import type { UpdateBookingStatusInput } from "@/modules/bookings/booking.types";

/**
 * PATCH /api/booking/[id]
 * Body: { "status": "CANCELLED" }
 *
 * Se usa PATCH (y no PUT) porque solo se envía el campo que cambia: el resto
 * de la reserva se queda tal cual está en la base de datos.
 */
export const PATCH = withApiRoute(
  // Se registra el PATRÓN de la ruta, no la URL concreta: así las métricas
  // tienen una serie por endpoint y no una por reserva.
  "/api/booking/[id]",
  async (
    request: NextRequest,
    context: RouteContext<"/api/booking/[id]">
  ) => {
    await requireApiSession("ADMIN");

    const { id } = await context.params;

    let body: Partial<UpdateBookingStatusInput>;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "El cuerpo de la solicitud debe ser JSON válido.");
    }

    const booking = await bookingService.updateStatus(id, body.status);

    return NextResponse.json(booking);
  }
);
