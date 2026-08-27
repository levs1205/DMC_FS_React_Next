import type { UserRole } from "@/lib/generated/prisma/enums";

// Se reexporta para que el resto de la app no importe del cliente generado.
export type { UserRole };

// Valores válidos del enum user_role (mismo orden que en el schema).
export const USER_ROLES = ["STUDENT", "ADMIN"] as const satisfies readonly UserRole[];

export function isUserRole(value: unknown): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

/**
 * Identidad que viaja dentro del access token y que la app usa para decidir
 * qué puede ver cada persona. Es deliberadamente mínima: id, rol y nombre
 * para saludar. Nada sensible (password, correo, teléfono) entra al JWT,
 * porque el payload de un JWT va firmado pero NO cifrado: cualquiera que lo
 * tenga puede leerlo.
 */
export interface SessionUser {
  id: number;
  name: string | null;
  role: UserRole;
}

// Par de tokens que se entrega al navegador en cada login/refresh.
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}
