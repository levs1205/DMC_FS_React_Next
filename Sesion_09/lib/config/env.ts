import { buildDatabaseUrl } from "@/lib/config/build-database-url";

function getEnvVar(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;

  if (value === undefined) {
    throw new Error(`Falta configurar la variable de entorno "${name}".`);
  }

  return value;
}

export const dbConfig = {
  host: getEnvVar("DB_HOST", "localhost"),
  port: Number(getEnvVar("DB_PORT", "5432")),
  user: getEnvVar("DB_USER", "postgres"),
  password: getEnvVar("DB_PASSWORD"),
  database: getEnvVar("DB_NAME"),
};

export const databaseUrl = buildDatabaseUrl(dbConfig);

// Secretos con los que se firman los JWT de sesión. No tienen fallback a
// propósito: si faltan, la app no arranca en vez de firmar con algo predecible.
export const authConfig = {
  accessTokenSecret: getEnvVar("JWT_ACCESS_SECRET"),
  refreshTokenSecret: getEnvVar("JWT_REFRESH_SECRET"),
};
