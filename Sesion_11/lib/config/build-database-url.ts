interface PostgresConnectionParts {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

// Arma la connection string de Postgres codificando usuario/contraseña
// (necesario si contienen caracteres especiales, p. ej. "$" o "@").
// Sin efectos secundarios: no lee `process.env`, así se puede importar de
// forma segura antes de que se cargue cualquier archivo ".env".
export function buildDatabaseUrl({
  host,
  port,
  user,
  password,
  database,
}: PostgresConnectionParts): string {
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}
