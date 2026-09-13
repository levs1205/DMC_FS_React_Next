import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/http/api-error";
import { handleRouteError } from "@/lib/http/handle-route-error";
import { requireApiSession } from "@/modules/auth/auth.session";
import { listRoomsWithAvailability } from "@/modules/rooms/room.service";

/**
 * GET /api/room/availability?startDate=2026-10-01&endDate=2026-10-04
 *
 * Devuelve el catálogo con un `available` por habitación y el total que
 * costaría esa estadía. Lo consume el formulario de nueva reserva.
 *
 * Es un GET con los parámetros en la query (y no un POST) porque es una
 * consulta sin efectos: se puede compartir el enlace, volver atrás y refrescar
 * sin consecuencias.
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiSession("STUDENT");

    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      throw new ApiError(
        400,
        "Hay que indicar las fechas de entrada y de salida."
      );
    }

    const rooms = await listRoomsWithAvailability(startDate, endDate);

    return NextResponse.json(rooms);
  } catch (error) {
    return handleRouteError(error);
  }
}
