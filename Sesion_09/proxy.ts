import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  HOME_PATH,
  LOGIN_PATH,
  REFRESH_PATH,
  REFRESH_TOKEN_COOKIE,
  findRouteRule,
} from "@/modules/auth/auth.config";
import { verifyAccessToken } from "@/modules/auth/auth.tokens";

/**
 * Proxy (lo que hasta Next 15 se llamaba middleware): corre antes de cada
 * navegación y decide quién entra a dónde.
 *
 * Es un control OPTIMISTA: solo lee y verifica la cookie del access token, sin
 * tocar la base de datos, porque este archivo se ejecuta también en los
 * prefetch del router. La autorización de verdad vive en los layouts de cada
 * zona y en los route handlers (`requireRole` / `requireApiSession`).
 *
 * Como el rol ya no viaja dentro del token, acá solo se distingue "hay sesión"
 * de "no hay sesión": el filtro por rol lo hace `requireRole` en el layout de
 * cada zona, que sí puede leer el rol de la base y devuelve al usuario a la
 * zona que le corresponde.
 *
 * Reglas:
 * 1. Sin sesión pero con refresh token → renovación silenciosa y vuelta a la
 *    misma URL, para que la sesión no se corte cada 15 minutos.
 * 2. Sin sesión en una zona privada → al login.
 * 3. Con sesión en /login → a la portada (de ahí cada zona se encarga).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const session = accessToken ? await verifyAccessToken(accessToken) : null;

  const rule = findRouteRule(pathname);
  const isLoginPage = pathname === LOGIN_PATH;

  if (!session) {
    const hasRefreshToken = Boolean(
      request.cookies.get(REFRESH_TOKEN_COOKIE)?.value
    );

    if (hasRefreshToken && (rule || isLoginPage)) {
      const refreshUrl = new URL(REFRESH_PATH, request.nextUrl);
      refreshUrl.searchParams.set("next", `${pathname}${search}`);

      return NextResponse.redirect(refreshUrl);
    }

    if (rule) {
      return NextResponse.redirect(new URL(LOGIN_PATH, request.nextUrl));
    }

    return NextResponse.next();
  }

  if (isLoginPage) {
    return NextResponse.redirect(new URL(HOME_PATH, request.nextUrl));
  }

  return NextResponse.next();
}

// No corre sobre /api (cada route handler se protege solo), ni sobre los
// assets estáticos.
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
