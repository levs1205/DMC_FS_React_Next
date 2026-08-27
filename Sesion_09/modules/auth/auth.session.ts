import { cache } from "react";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/http/api-error";
import { LOGIN_PATH, homePathForRole } from "@/modules/auth/auth.config";
import { readSessionCookies } from "@/modules/auth/auth.cookies";
import { verifyAccessToken } from "@/modules/auth/auth.tokens";
import type { SessionUser, UserRole } from "@/modules/auth/auth.types";

/**
 * Lectura de la sesión del lado del servidor (server components, layouts y
 * route handlers). `proxy.ts` es solo una primera barrera optimista: el
 * chequeo que de verdad protege los datos es este, el que corre pegado a
 * quien los entrega.
 *
 * `cache()` memoriza el resultado durante el render: aunque el layout y la
 * página pidan la sesión, el token se verifica una sola vez por request.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const { accessToken } = await readSessionCookies();

  if (!accessToken) return null;

  return verifyAccessToken(accessToken);
});

// Guardia para páginas y layouts: redirige en vez de devolver un error.
export async function requireRole(
  ...roles: readonly UserRole[]
): Promise<SessionUser> {
  const session = await getSession();

  if (!session) {
    redirect(LOGIN_PATH);
  }

  // A quien tiene sesión pero rol equivocado se lo manda a su propia zona.
  if (!roles.includes(session.role)) {
    redirect(homePathForRole(session.role));
  }

  return session;
}

// Guardia para route handlers: 401 si no hay sesión, 403 si el rol no alcanza.
export async function requireApiSession(
  ...roles: readonly UserRole[]
): Promise<SessionUser> {
  const session = await getSession();

  if (!session) {
    throw new ApiError(401, "Necesitas iniciar sesión.");
  }

  if (roles.length > 0 && !roles.includes(session.role)) {
    throw new ApiError(403, "No tienes permiso para esta operación.");
  }

  return session;
}
