import type { UserRole } from "@/modules/auth/auth.types";

/**
 * Parámetros de la sesión: nombres de cookies, tiempos de vida y qué rol
 * puede entrar a cada zona de la app. Vive aparte porque lo consumen tanto
 * el servidor (route handlers, server components) como `proxy.ts`.
 */

export const ACCESS_TOKEN_COOKIE = "hotel_access_token";
export const REFRESH_TOKEN_COOKIE = "hotel_refresh_token";

// Access token de vida corta: si alguien lo roba, la ventana de uso es chica.
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutos

// Refresh token de vida larga: mantiene la sesión sin volver a pedir la clave.
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 días

// Solo se rota el refresh token cuando ya gastó más de la mitad de su vida.
// Rotar en cada refresh (cada 15 min) dispara carreras entre pestañas y
// prefetches del router; rotar a mitad de camino da sesión deslizante sin ese
// problema y mantiene acotada la vida útil de un token robado.
export const REFRESH_ROTATION_THRESHOLD_SECONDS = REFRESH_TOKEN_TTL_SECONDS / 2;

export const JWT_ISSUER = "hotel-reservas";
export const JWT_AUDIENCE = "hotel-reservas-web";

export const LOGIN_PATH = "/login";
export const HOME_PATH = "/";
export const REFRESH_PATH = "/api/auth/refresh";

// A dónde cae cada rol apenas inicia sesión (y a dónde se lo devuelve si
// intenta entrar a una zona que no le corresponde).
export const HOME_PATH_BY_ROLE: Record<UserRole, string> = {
  ADMIN: "/backoffice",
  STUDENT: "/intranet",
};

export function homePathForRole(role: UserRole): string {
  return HOME_PATH_BY_ROLE[role];
}

// Zonas privadas y roles admitidos en cada una.
const PROTECTED_ROUTES = [
  { prefix: "/backoffice", roles: ["ADMIN"] },
  { prefix: "/intranet", roles: ["STUDENT"] },
] as const satisfies readonly { prefix: string; roles: readonly UserRole[] }[];

export interface RouteRule {
  prefix: string;
  roles: readonly UserRole[];
}

// Devuelve la regla de la zona a la que pertenece la ruta, o null si es pública.
export function findRouteRule(pathname: string): RouteRule | null {
  return (
    PROTECTED_ROUTES.find(
      (route) =>
        pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)
    ) ?? null
  );
}
