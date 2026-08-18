import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/http/api-error";
import { handleRouteError } from "@/lib/http/handle-route-error";
import { userService } from "@/modules/users/user.service";
import type { LoginCredentials } from "@/modules/users/user.types";

export async function POST(request: NextRequest) {
  try {
    let body: Partial<LoginCredentials>;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "El cuerpo de la solicitud debe ser JSON válido.");
    }

    const user = await userService.login({
      user: body.user ?? "",
      password: body.password ?? "",
    });

    return NextResponse.json(user);
  } catch (error) {
    return handleRouteError(error);
  }
}
