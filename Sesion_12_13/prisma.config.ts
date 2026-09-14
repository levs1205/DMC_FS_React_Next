import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";
import { buildDatabaseUrl } from "./lib/config/build-database-url";

// El CLI de Prisma no pasa por el loader de Next.js, así que cargamos
// ".env.local" manualmente para reutilizar las mismas variables DB_*.
loadEnv({ path: ".env.local" });

function unescapeDotenv(value: string): string {
  return value.replace(/\\(.)/g, "$1");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: buildDatabaseUrl({
      host: process.env.DB_HOST ?? "localhost",
      port: Number(process.env.DB_PORT ?? "5432"),
      user: process.env.DB_USER ?? "postgres",
      password: unescapeDotenv(process.env.DB_PASSWORD ?? ""),
      database: process.env.DB_NAME ?? "",
    }),
  },
});
