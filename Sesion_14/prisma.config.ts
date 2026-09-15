import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";
import { buildDatabaseUrl } from "./lib/config/build-database-url";

// El CLI de Prisma no pasa por el loader de Next.js, así que cargamos los
// archivos de entorno manualmente. El orden importa y es el mismo que usa
// Next: lo más específico primero, y `dotenv` no pisa lo que ya existe.
//
// `process.env` gana sobre todo lo demás: en Vercel o en CI las variables ya
// están puestas y no hay ningún archivo que cargar.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

function unescapeDotenv(value: string): string {
  return value.replace(/\\(.)/g, "$1");
}

function firstDefined(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }

  return undefined;
}

/**
 * URL que usan las migraciones.
 *
 * El orden de preferencia no es arbitrario:
 *
 * 1. La conexión **SIN pooler**. `prisma migrate` ejecuta DDL y toma locks de
 *    sesión, y un PgBouncer en modo transacción no los sostiene: la migración
 *    falla a mitad de camino, que es el peor momento posible.
 * 2. La conexión con pooler, si el proveedor no distingue las dos.
 * 3. Las piezas `DB_*` del Postgres local de clase.
 *
 * Los nombres se aceptan en varias formas porque no hay estándar: `DIRECT_URL`
 * es la convención de Prisma, y las integraciones de Vercel con Postgres
 * inyectan los suyos. Debe coincidir con la lista de `lib/config/env.ts`.
 */
function resolveMigrationUrl(): string {
  const direct = firstDefined([
    "DIRECT_URL",
    "DATABASE_URL_UNPOOLED",
    "POSTGRES_URL_NON_POOLING",
  ]);
  if (direct) return direct;

  const pooled = firstDefined(["DATABASE_URL", "POSTGRES_URL"]);
  if (pooled) return pooled;

  return buildDatabaseUrl({
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? "5432"),
    user: process.env.DB_USER ?? "postgres",
    password: unescapeDotenv(process.env.DB_PASSWORD ?? ""),
    database: process.env.DB_NAME ?? "",
  });
}

/**
 * Base "sombra": una base VACÍA y desechable que Prisma usa como banco de
 * pruebas.
 *
 * Sirve para dos cosas, y las dos importan:
 *
 * 1. `prisma migrate dev` la usa para detectar *drift* — que alguien haya
 *    tocado la base a mano y ya no coincida con lo que dicen las migraciones.
 * 2. `prisma migrate diff --from-migrations` la usa para **aplicar todas las
 *    migraciones desde cero** y comparar el resultado con `schema.prisma`. Esa
 *    es la única comprobación que responde de verdad a "¿esto va a funcionar
 *    contra una base nueva?", que es exactamente lo que pasa en el primer
 *    despliegue a producción.
 *
 * Prisma la BORRA y la recrea en cada uso, así que nunca debe apuntar a una
 * base con datos. Por defecto se deriva de la base de trabajo añadiéndole el
 * sufijo `_shadow`; hay que crearla una vez a mano:
 *
 *   CREATE DATABASE db_booking_shadow;
 */
function resolveShadowDatabaseUrl(): string | undefined {
  const explicit = process.env.SHADOW_DATABASE_URL?.trim();
  if (explicit) return explicit;

  try {
    const url = new URL(resolveMigrationUrl());
    const database = url.pathname.replace(/^\//, "");

    if (!database) return undefined;

    url.pathname = `/${database}_shadow`;

    return url.toString();
  } catch {
    return undefined;
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",

    /**
     * Qué ejecutar para poblar la base después de aplicar las migraciones.
     *
     * Lo usa `prisma migrate reset`, que deja la base vacía: sin esto habría
     * que acordarse de sembrar a mano, y una base migrada pero sin usuarios es
     * una base en la que no se puede ni entrar. Con esto, `migrate reset` es
     * una sola orden que deja el entorno de desarrollo listo.
     *
     * NO se ejecuta en `migrate deploy`, que es lo que corre en producción: allí
     * el seed se lanza aparte y una sola vez (ver docs/DESPLIEGUE.md § 10).
     */
    seed: "npx prisma db execute --file prisma/seed.sql",
  },
  datasource: {
    url: resolveMigrationUrl(),
    shadowDatabaseUrl: resolveShadowDatabaseUrl(),
  },
});
