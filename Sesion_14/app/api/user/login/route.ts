import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/http/api-error";
import { validateBody } from "@/lib/http/validate-body";
import { withApiRoute } from "@/lib/http/with-api-route";
import { enrichRequestContext } from "@/lib/observability/request-context";
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
export const POST = withApiRoute(
  "/api/user/login",
  async (request: NextRequest) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "El cuerpo de la solicitud debe ser JSON válido.");
    }

    const credentials = validateBody(loginSchema, body);
    const { user, tokens } = await authService.login(credentials);

    // Nunca se registra el login ni la contraseña; sí el id, que identifica sin
    // exponer datos personales y permite rastrear una sesión sospechosa.
    enrichRequestContext({ userId: user.id });

    const response = NextResponse.json({
      user,
      redirectTo: homePathForRole(user.role),
    });

    return applySessionCookies(response, tokens);
  }
);
