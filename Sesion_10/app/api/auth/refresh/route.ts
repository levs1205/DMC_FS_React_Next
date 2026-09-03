import { NextResponse, type NextRequest } from "next/server";
import { handleRouteError } from "@/lib/http/handle-route-error";
import {
  LOGIN_PATH,
  REFRESH_TOKEN_COOKIE,
  homePathForRole,
} from "@/modules/auth/auth.config";
import {
  applySessionCookies,
  clearSessionCookies,
} from "@/modules/auth/auth.cookies";
import { authService } from "@/modules/auth/auth.service";

/**
 * Renovación de la sesión a partir del refresh token (que viaja solo en la
 * cookie HttpOnly, nunca en el cuerpo ni en la URL).
 *
 * - POST: lo llama `apiFetch` cuando una llamada a la API responde 401.
 * - GET:  lo usa `proxy.ts` cuando alguien navega con el access token vencido:
 *         renueva y devuelve a la misma URL, así la sesión no se corta cada
 *         15 minutos. Muta estado en un GET a propósito, porque un redirect
 *         del navegador no puede ser POST; el efecto es idempotente salvo por
 *         la rotación, y la cookie `SameSite=Strict` impide dispararlo desde
 *         otro sitio.
 */

// Evita el "open redirect": solo se aceptan rutas internas ("/algo"), nunca
// "//otro-dominio.com" ni URLs absolutas.
function safeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export async function GET(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? "";
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));

  try {
    const { user, tokens } = await authService.refresh(refreshToken);
    const destination = nextPath ?? homePathForRole(user.role);

    const response = NextResponse.redirect(
      new URL(destination, request.nextUrl)
    );
    response.headers.set("Cache-Control", "no-store");

    return applySessionCookies(response, tokens);
  } catch {
    // Si el refresh no sirve se limpian las cookies para no volver a entrar
    // acá en la próxima navegación (evita un bucle de redirecciones).
    const response = NextResponse.redirect(new URL(LOGIN_PATH, request.nextUrl));
    response.headers.set("Cache-Control", "no-store");

    return clearSessionCookies(response);
  }
}

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? "";

  try {
    const { user, tokens } = await authService.refresh(refreshToken);

    return applySessionCookies(NextResponse.json({ user }), tokens);
  } catch (error) {
    return clearSessionCookies(handleRouteError(error));
  }
}
