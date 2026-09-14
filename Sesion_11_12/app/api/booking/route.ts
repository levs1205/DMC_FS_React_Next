import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/http/api-error";
import { handleRouteError } from "@/lib/http/handle-route-error";
import { validateBody } from "@/lib/http/validate-body";
import { requireApiSession } from "@/modules/auth/auth.session";
import { createBookingSchema } from "@/modules/bookings/booking.schemas";
import { bookingService } from "@/modules/bookings/booking.service";

// GET /api/booking → listado completo de reservas para el backoffice.
// Solo ADMIN: el proxy ya filtra la navegación, pero la API se protege igual
// porque es la que realmente entrega los datos.
export async function GET() {
  try {
    await requireApiSession("ADMIN");

    const bookings = await bookingService.listBookings();
    return NextResponse.json(bookings);
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * POST /api/booking
 * Body: { "roomId": 3, "startDate": "2026-10-01", "endDate": "2026-10-04" }
 *
 * Crea una reserva PENDIENTE a nombre del alumno logueado. Ni el usuario ni el
 * precio se aceptan del cliente: el primero sale de la sesión y el segundo se
 * calcula con el precio vigente de la habitación.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession("STUDENT");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "El cuerpo de la solicitud debe ser JSON válido.");
    }

    const input = validateBody(createBookingSchema, body);
    const booking = await bookingService.createBooking(session.id, input);

    // 201 + Location: la respuesta correcta de un POST que creó un recurso.
    return NextResponse.json(booking, {
      status: 201,
      headers: { Location: `/intranet/reservas/${booking.id}/pago` },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
