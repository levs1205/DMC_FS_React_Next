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
/**
 * Identificador del request, creado en el borde y propagado hacia dentro.
 *
 * Es la pieza que cose toda la observabilidad: el mismo id aparece en el log
 * del proxy, en el del route handler, en cada consulta a la base y en la
 * cabecera `x-request-id` que recibe el navegador. Cuando alguien reporta un
 * fallo y trae ese id, se reconstruye el recorrido completo.
 *
 * Se reutiliza el de Vercel (`x-vercel-id`) cuando existe, para poder cruzar
 * nuestros logs con los de la plataforma en lugar de tener dos numeraciones
 * paralelas del mismo request.
 *
 * `NextResponse.next({ request: { headers } })` es la forma —y la única— de que
 * una cabecera añadida aquí llegue al handler de destino: modificar
 * `request.headers` a secas no viaja.
 *
 * Nota importante: este archivo NO corre sobre `/api` (ver el matcher al final),
 * y eso es deliberado. El webhook de Mercado Pago usa su propio `x-request-id`
 * como parte del manifiesto que firma con HMAC; pisarlo invalidaría la firma de
 * todas las notificaciones de pago.
 */
function withRequestId(response: NextResponse, request: NextRequest): NextResponse {
  const requestId =
    request.headers.get("x-request-id") ??
    request.headers.get("x-vercel-id") ??
    crypto.randomUUID();

  response.headers.set("x-request-id", requestId);

  return response;
}

function forward(request: NextRequest): NextResponse {
  const requestId =
    request.headers.get("x-request-id") ??
    request.headers.get("x-vercel-id") ??
    crypto.randomUUID();

  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("x-request-id", requestId);

  return response;
}

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

      return withRequestId(NextResponse.redirect(refreshUrl), request);
    }

    if (rule) {
      return withRequestId(
        NextResponse.redirect(new URL(LOGIN_PATH, request.nextUrl)),
        request
      );
    }

    return forward(request);
  }

  if (isLoginPage) {
    return withRequestId(
      NextResponse.redirect(new URL(HOME_PATH, request.nextUrl)),
      request
    );
  }

  return forward(request);
}

// No corre sobre /api (cada route handler se protege solo), ni sobre los
// assets estáticos.
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
