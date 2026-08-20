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
