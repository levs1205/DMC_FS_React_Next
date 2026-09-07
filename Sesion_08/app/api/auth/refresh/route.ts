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