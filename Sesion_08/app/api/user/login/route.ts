import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/http/api-error";
import { handleRouteError } from "@/lib/http/handle-route-error";
import type { LoginCredentials } from "@/modules/users/user.types";
import { loginSchema } from "@/modules/users/user.schemas"
import { validateBody } from "@/lib/http/validate-body"
import { authService } from "@/modules/auth/auth.service";
import { homePathForRole } from "@/modules/auth/auth.config";
import { applySessionCookies } from "@/modules/auth/auth.cookies";

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "El cuerpo de la solicitud debe ser JSON válido.");
    }

    const credentials = validateBody(loginSchema, body);

    const { user, tokens } = await authService.login({
      user: credentials.user ?? "",
      password: credentials.password ?? "",
    });

    const response = NextResponse.json({
      user,
      redirectTo: homePathForRole(user.role),
    });

     return applySessionCookies(response, tokens);
  } catch (error) {
    return handleRouteError(error);
  }
}
