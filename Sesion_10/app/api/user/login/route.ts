import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/http/api-error";
import { handleRouteError } from "@/lib/http/handle-route-error";
import { validateBody } from "@/lib/http/validate-body";
import { homePathForRole } from "@/modules/auth/auth.config";
import { applySessionCookies } from "@/modules/auth/auth.cookies";
import { authService } from "@/modules/auth/auth.service";
import { loginSchema } from "@/modules/users/user.schemas";

/**
 * POST /api/user/login
 * Body: { "user": "correo@dominio", "password": "..." }
 *
 * Responde con el usuario y la ruta que le toca según su rol. Los tokens no
 * aparecen en el cuerpo: se adjuntan como cookies HttpOnly.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "El cuerpo de la solicitud debe ser JSON válido.");
    }

    const credentials = validateBody(loginSchema, body);
    const { user, tokens } = await authService.login(credentials);

    const response = NextResponse.json({
      user,
      redirectTo: homePathForRole(user.role),
    });

    return applySessionCookies(response, tokens);
  } catch (error) {
    return handleRouteError(error);
  }
}
