// Fila cruda de la tabla public.user.
export interface UserRecord {
  id: number;
  name: string | null;
  login: string | null;
  password: string | null;
}

// Datos de usuario seguros para exponer por la API (sin password).
export type PublicUser = Omit<UserRecord, "password">;

export interface LoginCredentials {
  user: string;
  password: string;
}
