import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/http/handle-route-error";
import { bookingService } from "@/modules/bookings/booking.service";
import { requireApiSession } from "@/modules/auth/auth.sessions";

// GET /api/booking → listado completo de reservas para el backoffice.
export async function GET() {
  try {
    await requireApiSession("ADMIN");
    const bookings = await bookingService.listBookings();
    return NextResponse.json(bookings);
  } catch (error) {
    return handleRouteError(error);
  }
}
