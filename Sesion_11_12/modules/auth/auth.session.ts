import { cache } from "react";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/http/api-error";
import { LOGIN_PATH, homePathForRole } from "@/modules/auth/auth.config";
import { readSessionCookies } from "@/modules/auth/auth.cookies";
import { verifyAccessToken } from "@/modules/auth/auth.tokens";
import type {
  SessionIdentity,
  SessionUser,
  UserRole,
} from "@/modules/auth/auth.types";
import { userService } from "@/modules/users/user.service";

/**
 * Lectura de la sesión del lado del servidor (server components, layouts y
 * route handlers). `proxy.ts` es solo una primera barrera optimista: el
 * chequeo que de verdad protege los datos es este, el que corre pegado a
 * quien los entrega.
 *
 * Son dos lecturas distintas a propósito:
 * - `getSession()` responde "¿quién es?" con lo que viene firmado en el token
 *   (id y nombre). No toca la base.
 * - `getSessionUser()` responde "¿qué puede hacer?": suma el rol, que se lee
 *   de la base con el id del usuario porque ya no viaja dentro del token.
 *
 * `cache()` memoriza ambas durante el render: aunque el layout, la página y
 * la guardia pidan la sesión, el token se verifica y el rol se consulta una
 * sola vez por request.
 */
export const getSession = cache(async (): Promise<SessionIdentity | null> => {
  const { accessToken } = await readSessionCookies();

  if (!accessToken) return null;

  return verifyAccessToken(accessToken);
});

// Sesión completa: identidad del token + rol vigente en la base de datos.
// Si el usuario fue borrado ya no hay rol y la sesión deja de ser válida.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getSession();

  if (!session) return null;

  const role = await userService.findRoleById(session.id);

  if (!role) return null;

  return { ...session, role };
});

// Guardia para páginas y layouts: redirige en vez de devolver un error.
export async function requireRole(
  ...roles: readonly UserRole[]
): Promise<SessionUser> {
  const session = await getSessionUser();

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
  // El rol sale de la base (por el id del usuario logueado), no del token:
  // si a alguien le cambian los permisos, la próxima llamada ya lo refleja.
  const session = await getSessionUser();

  if (!session) {
    throw new ApiError(401, "Necesitas iniciar sesión.");
  }

  if (roles.length > 0 && !roles.includes(session.role)) {
    throw new ApiError(403, "No tienes permiso para esta operación.");
  }

  return session;
}
