#!/usr/bin/env node

/**
 * Ensayo general del despliegue, contra una base de datos desechable.
 *
 * ## Qué problema resuelve
 *
 * Que las migraciones funcionen en TU base no demuestra que funcionen en una
 * base nueva. Son dos cosas distintas y se confunden todo el tiempo:
 *
 * - Tu base local lleva meses de historia: se creó a mano, se le aplicaron
 *   migraciones por encima, alguien tocó una columna desde un cliente SQL.
 *   Funciona, pero no es *el resultado de las migraciones*.
 * - La base de producción nace VACÍA. Lo único que la construye son los
 *   archivos de `prisma/migrations`, aplicados en orden, de una sentada.
 *
 * Si esos archivos tienen un hueco, el sitio se entera en el primer despliegue.
 * Este script lo descubre antes, en tu máquina y en diez segundos:
 *
 *   1. Crea una base vacía.
 *   2. Le aplica las migraciones EXACTAMENTE como hará Vercel.
 *   3. Compara el resultado con `schema.prisma`: si sobra o falta algo, falla.
 *   4. Ejecuta `seed.sql` encima, para comprobar que también funciona sobre
 *      una base recién creada (y no solo sobre la tuya, que ya tenía datos).
 *   5. Enseña lo que quedó y borra la base.
 *
 * Uso:  npm run db:verify
 *
 * Solo toca la base desechable `<DB_NAME>_verify`, que borra y recrea. No lee
 * ni escribe en tu base de trabajo.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { config as loadEnv } from "dotenv";
import pg from "pg";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

// Mismo destildado que usa `prisma.config.ts`: dotenv escapa caracteres y la
// contraseña tiene que llegar a Postgres tal cual es.
function unescapeDotenv(value) {
  return value.replace(/\\(.)/g, "$1");
}

const host = process.env.DB_HOST ?? "localhost";
const port = Number(process.env.DB_PORT ?? "5432");
const user = process.env.DB_USER ?? "postgres";
const password = unescapeDotenv(process.env.DB_PASSWORD ?? "");
const baseName = process.env.DB_NAME ?? "";

if (!baseName) {
  console.error(
    "Falta DB_NAME en .env.local. Este script necesita un Postgres local."
  );
  process.exit(1);
}

const verifyName = `${baseName}_verify`;

/**
 * La comparación con `schema.prisma` necesita ADEMÁS una base sombra, porque
 * para saber qué construyen las migraciones Prisma tiene que aplicarlas en
 * algún sitio. Se crea también desechable: así el script no depende de que
 * exista nada previo en tu Postgres.
 */
const shadowName = `${baseName}_verify_shadow`;

const disposable = [verifyName, shadowName];

function urlFor(database) {
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

const verifyUrl = urlFor(verifyName);
const shadowUrl = urlFor(shadowName);

function adminClient() {
  return new pg.Client({ host, port, user, password, database: "postgres" });
}

/**
 * Las variables de entorno mandan sobre los archivos `.env` en
 * `prisma.config.ts`, así que basta con exportarlas al proceso hijo para
 * apuntar el CLI de Prisma a la base desechable.
 */
const childEnv = {
  ...process.env,
  DATABASE_URL: verifyUrl,
  DIRECT_URL: verifyUrl,
  SHADOW_DATABASE_URL: shadowUrl,
};

/**
 * Cómo se invoca `npx` sin que Windows lo impida.
 *
 * Desde Node 20.12, `spawn` se niega a ejecutar archivos `.cmd` o `.bat`
 * directamente (se cerró un agujero de inyección de comandos), y `npx` en
 * Windows es precisamente un `.cmd`. Sin esto el proceso falla con EINVAL y sin
 * una sola línea de salida, que es de los errores más desconcertantes que hay.
 *
 * Se pasa por `cmd.exe /c` en vez de por `shell: true` porque con `shell` los
 * argumentos se concatenan sin escapar —Node avisa de ello con DEP0190— y así
 * los sigue escapando él.
 */
const isWindows = process.platform === "win32";

function npx(args) {
  return isWindows
    ? ["cmd.exe", ["/c", "npx", ...args]]
    : ["npx", args];
}

function prisma(label, args) {
  console.log(`\n── ${label}`);

  const [command, commandArgs] = npx(["prisma", ...args]);
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    env: childEnv,
  });

  if (result.error) console.error(result.error.message);

  return result.status === 0;
}

async function dropVerifyDatabase() {
  const admin = adminClient();
  await admin.connect();

  for (const database of disposable) {
    // FORCE cierra las conexiones que hayan quedado abiertas de un intento
    // anterior; sin eso, DROP DATABASE se queda esperando.
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  }

  await admin.end();
}

async function main() {
  console.log(`Bases desechables: ${disposable.join(", ")} (en ${host}:${port})`);

  await dropVerifyDatabase();

  const admin = adminClient();
  await admin.connect();

  for (const database of disposable) {
    await admin.query(`CREATE DATABASE "${database}"`);
  }

  await admin.end();

  // 1. Las migraciones, tal cual las correrá Vercel.
  if (!prisma("prisma migrate deploy (sobre base vacía)", ["migrate", "deploy"])) {
    return fail("Las migraciones NO se aplican sobre una base nueva.");
  }

  // 2. ¿El resultado coincide con el modelo? Esta es la comprobación que de
  //    verdad importa: detecta el caso clásico de haber editado
  //    `schema.prisma` sin generar la migración correspondiente.
  console.log("\n── comparando el resultado con schema.prisma");

  const [diffCommand, diffArgs] = npx([
    "prisma",
    "migrate",
    "diff",
    "--from-migrations",
    "prisma/migrations",
    "--to-schema",
    "prisma/schema.prisma",
  ]);

  const diff = execFileSync(diffCommand, diffArgs, {
    encoding: "utf8",
    env: childEnv,
  });

  const clean = diff.includes("No difference detected");
  console.log(diff.split("\n").filter((line) => !/injected env|tip:/.test(line)).join("\n").trim());

  if (!clean) {
    return fail(
      "Las migraciones NO reproducen schema.prisma.\n" +
        "Falta generar una migración: npm run db:migrate"
    );
  }

  // 3. El seed, sobre esa base recién creada.
  if (!prisma("seed.sql (sobre base recién migrada)", ["db", "execute", "--file", "prisma/seed.sql"])) {
    return fail("El seed NO funciona sobre una base nueva.");
  }

  // 4. Qué quedó.
  const check = new pg.Client({ connectionString: verifyUrl });
  await check.connect();

  const counts = {};
  const tables = await check.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        AND table_name <> '_prisma_migrations'
      ORDER BY table_name`
  );

  for (const { table_name: table } of tables.rows) {
    const { rows } = await check.query(`SELECT count(*)::int AS n FROM "${table}"`);
    counts[table] = rows[0].n;
  }

  console.log("\n── filas tras el seed");
  console.table(counts);

  const accounts = await check.query(
    'SELECT login, role, "password" FROM "user" ORDER BY id'
  );

  await check.end();

  if (counts.user === 0) {
    return fail(
      "La base queda SIN usuarios: nadie podría iniciar sesión en producción."
    );
  }

  // 5. ¿Las credenciales sembradas sirven de verdad para entrar?
  //
  // Es la comprobación que cierra el círculo. Que la fila exista y que la
  // columna tenga pinta de hash no demuestra nada: si el hash se generó con
  // otros parámetros que los que espera `verifyPassword`, la base está
  // perfecta y aun así nadie puede iniciar sesión. Aquí se usa EL MISMO módulo
  // que usa el login real, no una copia.
  const { verifyPassword } = await importPasswordModule();

  const expected = new Map([
    ["estudiante@dmc.pe", "1234"],
    ["admin@dmc.pe", "admin123"],
  ]);

  const report = [];

  for (const row of accounts.rows) {
    const plain = expected.get(row.login);
    const ok = plain ? await verifyPassword(plain, row.password) : null;

    report.push({
      login: row.login,
      role: row.role,
      "contraseña con hash": row.password?.startsWith("scrypt$") ? "sí" : "NO",
      "puede entrar": ok === null ? "(no comprobado)" : ok ? "sí" : "NO",
    });
  }

  console.log("\n── cuentas con las que se puede entrar");
  console.table(report);

  if (report.some((r) => r["contraseña con hash"] === "NO")) {
    return fail("Hay contraseñas guardadas EN CLARO: el seed o la migración están mal.");
  }

  if (report.some((r) => r["puede entrar"] === "NO")) {
    return fail(
      "Las credenciales del seed NO autentican.\n" +
        "El hash guardado no corresponde a la contraseña documentada:\n" +
        "regenéralo con `npm run db:hash -- \"<contraseña>\"`."
    );
  }

  await dropVerifyDatabase();
  console.log("\n✔ Todo correcto. Las migraciones y el seed construyen la base desde cero.");
}

/**
 * Carga `modules/auth/auth.password.ts` desde un script de Node corriente.
 *
 * Tiene dos obstáculos y los dos se resuelven con banderas, sin duplicar una
 * línea de la lógica que se quiere comprobar:
 *
 * - El módulo lleva `import "server-only"`, que lanza una excepción salvo bajo
 *   la condición de exportación `react-server`. Por eso el proceso hijo se
 *   lanza con `--conditions=react-server`, que hace que ese paquete resuelva a
 *   un archivo vacío (que es justo lo que hace Next.js en el servidor).
 * - Es TypeScript. Node 22.18+ lo ejecuta quitando los tipos sin compilar.
 *
 * El trabajo se hace en un proceso aparte porque las banderas hay que ponerlas
 * al arrancar Node, y este script ya está en marcha.
 */
async function importPasswordModule() {
  return {
    async verifyPassword(plain, stored) {
      const result = spawnSync(
        process.execPath,
        [
          "--conditions=react-server",
          "--no-warnings",
          "--input-type=module",
          "--eval",
          `import { verifyPassword } from "./modules/auth/auth.password.ts";
           const [plain, stored] = JSON.parse(process.argv[1]);
           process.stdout.write(String(await verifyPassword(plain, stored)));`,
          JSON.stringify([plain, stored]),
        ],
        { encoding: "utf8" }
      );

      if (result.status !== 0) {
        throw new Error(
          `No se pudo ejecutar auth.password.ts: ${result.stderr?.trim()}`
        );
      }

      return result.stdout.trim() === "true";
    },
  };
}

async function fail(message) {
  console.error(`\n✖ ${message}`);
  await dropVerifyDatabase();
  process.exit(1);
}

main().catch(async (error) => {
  console.error(`\n✖ ${error.message}`);
  await dropVerifyDatabase().catch(() => {});
  process.exit(1);
});
