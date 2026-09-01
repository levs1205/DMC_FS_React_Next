import type { UserRole } from "@/modules/auth/auth.types";

export const ACCESS_TOKEN_COOKIE = "hotel_access_token";
export const REFRESH_TOKEN_COOKIE = "hotel_refresh_token";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export const REFRESH_ROTATE_THRESHOLD_SECONDS = REFRESH_TOKEN_TTL_SECONDS / 2;

export const JWT_ISSUER = "hotel_reservas";
export const JWT_AUDIENCE = "hotel-reservas-web";

export const LOGIN_PATH = "/login";
export const HOME_PARTH = "/";
export const REFRESH_PATH = "/api/auth/refresh";

export const HOME_PATH_BY_ROLE: Record<UserRole, string> = {
  ADMIN: "/backoffice",
  STUDENT: "/intranet",
};

export function homePathForRole(role: UserRole): string {
  return HOME_PATH_BY_ROLE[role];
}

export interface RouteRole {
  prefix: string;
  roles: readonly UserRole[];
}

const PROTECTED_ROUTES = [
  { prefix: "/backoffice", roles: ["ADMIN"] },
  { prefix: "/intranet", roles: ["STUDENT"] },
] as const satisfies readonly RouteRole[];

export function findRouteRule(pathName: string): RouteRole | null {
  return (
    PROTECTED_ROUTES.find(
      (route) => pathName === route.prefix || pathName.startsWith(route.prefix),
    ) ?? null
  );
}
