import { buildDatabaseUrl } from "@/lib/config/build-database-url"

function getEnvVariable(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;

  if (!value) {
    throw new Error(`Environment variable ${key} is not defined`);
  }

  return value;
}

export const dbConfig = {
  host: getEnvVariable("DB_HOST", "localhost"),
  port: parseInt(getEnvVariable("DB_PORT", "5432")),
  database: getEnvVariable("DB_NAME", "db_booking"),
  user: getEnvVariable("DB_USER", "postgres"),
  password: getEnvVariable("DB_PASSWORD", "Pa$$w0rd"),
};

export const databaseUrl = buildDatabaseUrl(dbConfig);