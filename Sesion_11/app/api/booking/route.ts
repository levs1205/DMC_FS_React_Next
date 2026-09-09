import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http/handle-route-error";
import { requireApiSession } from "@/modules/auth/auth.session";
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
