import type { UserRole } from "@/lib/generated/prisma/enums";

// Se reexporta para que el resto de la app no importe del cliente generado.
export type { UserRole };

// Valores válidos del enum user_role (mismo orden que en el schema).
export const USER_ROLES = ["STUDENT", "ADMIN"] as const satisfies readonly UserRole[];

export function isUserRole(value: unknown): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

/**
 * Identidad que viaja firmada dentro del access token: solo quién es la
 * persona (id) y su nombre para saludar. Nada sensible (password, correo,
 * teléfono) entra al JWT, porque el payload va firmado pero NO cifrado:
 * cualquiera que lo tenga puede leerlo.
 *
 * El ROL tampoco viaja acá a propósito: es un permiso, no una identidad, y
 * un token vive 15 minutos. Si el rol viajara dentro, un cambio de permisos
 * recién se aplicaría cuando el token caduque; leyéndolo de la base con el
 * id se aplica en la siguiente request.
 */
export interface SessionIdentity {
  id: number;
  name: string | null;
}

// Identidad del token + el rol vigente leído de la base de datos.
export interface SessionUser extends SessionIdentity {
  role: UserRole;
}

// Par de tokens que se entrega al navegador en cada login/refresh.
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}
