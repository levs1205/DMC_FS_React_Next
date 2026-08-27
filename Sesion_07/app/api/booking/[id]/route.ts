import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/http/api-error";
import { handleRouteError } from "@/lib/http/handle-route-error";
import { bookingService } from "@/modules/booking/booking.service";
import { UpdateBookingStatusInput } from "@/modules/booking/booking.types";

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/booking/[id]">,
) {
  try {
    const { id } = await context.params;
    let body : Partial<UpdateBookingStatusInput>;

    try {
        body = await request.json();
    } catch  {
        throw new ApiError(400, "El body debe ser JSON")
    }

    const booking = await bookingService.updateStatus(id, body.status);

    return NextResponse.json(booking);

  } catch (error) {
    return handleRouteError(error);
  }
}
