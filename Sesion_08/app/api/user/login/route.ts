import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/http/api-error";
import { handleRouteError } from "@/lib/http/handle-route-error";
import { userService } from "@/modules/users/user.service";
import type { LoginCredentials } from "@/modules/users/user.types";
import { loginSchema } from "@/modules/users/user.schemas"
import { validateBody } from "@/lib/http/validate-body"

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "El cuerpo de la solicitud debe ser JSON válido.");
    }

    const credentials = validateBody(loginSchema, body);

    const user = await userService.login({
      user: credentials.user ?? "",
      password: credentials.password ?? "",
    });

    return NextResponse.json(user);
  } catch (error) {
    return handleRouteError(error);
  }
}
