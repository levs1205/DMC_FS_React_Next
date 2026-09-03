import type { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_COOKIE,
} from "@/modules/auth/auth.config";
import type { SessionTokens } from "@/modules/auth/auth.types";

/**
 * Los tokens NUNCA se devuelven en el JSON de la respuesta ni se guardan en
 * localStorage: viajan en cookies `HttpOnly`, que el JavaScript de la página
 * no puede leer. Así un XSS no puede robarse la sesión, y el navegador manda
 * las cookies solo por su cuenta.
 *
 * - httpOnly: invisible para document.cookie.
 * - secure:   solo por HTTPS (en desarrollo se desactiva, si no localhost no
 *             recibiría la cookie por http).
 * - sameSite: el access token usa "lax" para que sobreviva a la navegación
 *             normal entre páginas; el refresh token usa "strict" porque solo
 *             se usa desde la propia app, y así no acompaña a ningún pedido
 *             que nazca en otro sitio (defensa contra CSRF).
 * - path "/": una sola sesión para toda la app.
 */

const isProduction = process.env.NODE_ENV === "production";

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  path: "/",
} as const;

// Se le da un poco más de vida que al JWT para que el servidor pueda
// responder "token vencido" en vez de "no hay cookie" (mejor diagnóstico).
const ACCESS_COOKIE_MAX_AGE = ACCESS_TOKEN_TTL_SECONDS + 60;

export function applySessionCookies<T extends NextResponse>(
  response: T,
  tokens: SessionTokens
): T {
  response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseCookieOptions,
    sameSite: "lax",
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions,
    sameSite: "strict",
    expires: tokens.refreshTokenExpiresAt,
  });

  return response;
}

export function clearSessionCookies<T extends NextResponse>(response: T): T {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
    ...baseCookieOptions,
    sameSite: "lax",
    maxAge: 0,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    ...baseCookieOptions,
    sameSite: "strict",
    maxAge: 0,
  });

  return response;
}

// Lecturas desde el store de `next/headers` (server components, route
// handlers y server actions).
export async function readSessionCookies(): Promise<{
  accessToken?: string;
  refreshToken?: string;
}> {
  const store = await cookies();

  return {
    accessToken: store.get(ACCESS_TOKEN_COOKIE)?.value,
    refreshToken: store.get(REFRESH_TOKEN_COOKIE)?.value,
  };
}

// Versión para server actions, donde no hay un NextResponse que tocar.
export async function deleteSessionCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_TOKEN_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);
}
