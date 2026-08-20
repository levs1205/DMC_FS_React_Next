import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";
import { buildDatabaseUrl } from "./lib/config/build-database-url";

loadEnv({ path: ".env.local" });

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
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_NAME ?? "",
    }),
  },
});
