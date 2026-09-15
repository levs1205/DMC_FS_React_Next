import { buildDatabaseUrl } from "@/lib/config/build-database-url";

/**
 * Punto único donde la aplicación lee `process.env`.
 *
 * Dos reglas que vale la pena entender antes de tocar este archivo:
 *
 * 1. **Se valida al importarse.** Si falta una variable obligatoria, la app no
 *    arranca. Es deliberado: es mil veces mejor un error al desplegar que un
 *    `undefined` filtrándose hasta la consulta SQL a las tres de la mañana.
 *
 * 2. **Nada de secretos con valor por defecto.** Un `?? "dev-secret"` en un
 *    secreto de firma es una puerta trasera que tarde o temprano llega a
 *    producción. Host y puerto sí tienen defaults; las claves no.
 */

// ---------------------------------------------------------------------------
// Entorno de ejecución
// ---------------------------------------------------------------------------

/**
 * Los tres entornos del proyecto. No son lo mismo que `NODE_ENV`:
 *
 * - `development` → tu máquina (`next dev`).
 * - `preview`     → cada rama / Pull Request desplegado en Vercel. Compila en
 *                   modo producción (`NODE_ENV=production`) pero apunta a datos
 *                   de prueba: Mercado Pago en sandbox, base de datos aparte.
 * - `production`  → el dominio real, con datos y dinero de verdad.
 *
 * Vercel expone esta distinción en `VERCEL_ENV`; `NODE_ENV` no la conoce (para
 * Next.js preview y production son ambos "production"). Por eso la app decide
 * con `VERCEL_ENV` y solo cae a `NODE_ENV` fuera de Vercel.
 */
export type AppEnv = "development" | "preview" | "production";

function resolveAppEnv(): AppEnv {
  const vercelEnv = process.env.VERCEL_ENV;

  if (vercelEnv === "production" || vercelEnv === "preview") return vercelEnv;
  if (vercelEnv === "development") return "development";

  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export const appEnv: AppEnv = resolveAppEnv();

export const isProduction = appEnv === "production";
export const isPreview = appEnv === "preview";
export const isDevelopment = appEnv === "development";

/**
 * Versión desplegada. En Vercel es el SHA del commit; en local, "local".
 * Va en cada log y en cada traza: sin esto, "empezó a fallar hace una hora" no
 * se puede cruzar con "qué se desplegó hace una hora".
 */
export const release: string =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  process.env.RELEASE_SHA?.slice(0, 7) ??
  "local";

// ---------------------------------------------------------------------------
// Lectura de variables
// ---------------------------------------------------------------------------

function readEnvVar(name: string): string | undefined {
  const value = process.env[name]?.trim();

  return value === "" ? undefined : value;
}

function getEnvVar(name: string, fallback?: string): string {
  const value = readEnvVar(name) ?? fallback;

  if (value === undefined) {
    throw new Error(
      `Falta configurar la variable de entorno "${name}" (entorno: ${appEnv}).`
    );
  }

  return value;
}

// ---------------------------------------------------------------------------
// Base de datos
// ---------------------------------------------------------------------------

/**
 * Nombres bajo los que puede llegar la conexión CON pooler, en orden de
 * preferencia.
 *
 * Son varios porque no hay un estándar: `DATABASE_URL` es la convención
 * general, y las integraciones de Vercel con Postgres inyectan además sus
 * propios nombres con prefijo `POSTGRES_`. Cuál aparece depende de la versión
 * de la integración, así que se aceptan todos en vez de obligar a duplicar la
 * variable a mano —que es justo el tipo de paso manual que se olvida—.
 *
 * `POSTGRES_PRISMA_URL` queda fuera a propósito: viene con `?pgbouncer=true`
 * pegado, un parámetro que entiende el motor viejo de Prisma pero no el driver
 * `pg` que usa este proyecto.
 */
const POOLED_URL_VARS = ["DATABASE_URL", "POSTGRES_URL"] as const;

/** Lo mismo para la conexión SIN pooler, la que necesitan las migraciones. */
const DIRECT_URL_VARS = [
  "DIRECT_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
] as const;

function firstDefined(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = readEnvVar(name);
    if (value) return value;
  }

  return undefined;
}

/**
 * La conexión admite dos formatos, y el orden importa:
 *
 * 1. Una **cadena completa**. Es lo que entregan los Postgres administrados
 *    (Neon, Supabase, Railway): host, credenciales y parámetros de TLS y de
 *    pooling ya puestos. En Vercel siempre es esta.
 *
 * 2. Las piezas sueltas `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` /
 *    `DB_NAME`, que es como está montado el Postgres local de clase.
 *
 * Soportar las dos no es indecisión: es lo que permite que el mismo código
 * corra contra tu Postgres de escritorio y contra el de producción sin un `if`
 * repartido por medio proyecto.
 */
function resolveDatabaseUrl(): string {
  const url = firstDefined(POOLED_URL_VARS);

  if (url) return url;

  return buildDatabaseUrl({
    host: getEnvVar("DB_HOST", "localhost"),
    port: Number(getEnvVar("DB_PORT", "5432")),
    user: getEnvVar("DB_USER", "postgres"),
    password: getEnvVar("DB_PASSWORD"),
    database: getEnvVar("DB_NAME"),
  });
}

export const databaseUrl = resolveDatabaseUrl();

/**
 * Conexión DIRECTA, sin pooler. Solo la usan las migraciones.
 *
 * Neon (y cualquier Postgres con PgBouncer delante) ofrece dos endpoints: el
 * *pooled*, que multiplexa muchas conexiones cortas sobre pocas reales —lo que
 * necesita una función serverless que nace y muere en cada request— y el
 * *directo*. `prisma migrate deploy` necesita el directo porque toma locks y
 * ejecuta DDL en sesiones largas, algo que el pooler en modo transacción no
 * sostiene. Si no hay `DIRECT_URL`, se usa la misma de siempre.
 */
export const directDatabaseUrl: string =
  firstDefined(DIRECT_URL_VARS) ?? databaseUrl;

/**
 * Tamaño del pool de conexiones de la aplicación.
 *
 * En serverless cada instancia de la función abre su propio pool, y Postgres
 * tiene un techo de conexiones simultáneas (Neon free: ~100 vía pooler). Con
 * un pool chico por instancia el sistema escala horizontalmente sin agotar el
 * servidor. En local, donde hay un solo proceso, conviene más holgura.
 */
export const dbPoolSize = Number(
  getEnvVar("DB_POOL_SIZE", isDevelopment ? "10" : "3")
);

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------

/**
 * Secretos con los que se firman los JWT de sesión. Sin fallback a propósito:
 * si faltan, la app no arranca en vez de firmar con algo predecible.
 */
export const authConfig = {
  accessTokenSecret: getEnvVar("JWT_ACCESS_SECRET"),
  refreshTokenSecret: getEnvVar("JWT_REFRESH_SECRET"),
};

// ---------------------------------------------------------------------------
// Observabilidad
// ---------------------------------------------------------------------------

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];

function resolveLogLevel(): LogLevel {
  const raw = readEnvVar("LOG_LEVEL")?.toLowerCase();

  if (raw && (LOG_LEVELS as readonly string[]).includes(raw)) {
    return raw as LogLevel;
  }

  // En desarrollo interesa el detalle; en producción el ruido cuesta dinero y
  // esconde lo importante.
  return isDevelopment ? "debug" : "info";
}

function resolveLogFormat(): "pretty" | "json" {
  const raw = readEnvVar("LOG_FORMAT");

  if (raw === "pretty" || raw === "json") return raw;

  return isDevelopment ? "pretty" : "json";
}

export const observabilityConfig = {
  /** Nombre con el que la app aparece en el backend de trazas. */
  serviceName: getEnvVar("OTEL_SERVICE_NAME", "reservas"),

  logLevel: resolveLogLevel(),

  /**
   * Formato de los logs. JSON en el servidor (Vercel lo parsea y deja filtrar
   * por campo); texto legible en tu terminal.
   */
  logFormat: resolveLogFormat(),

  /**
   * Una consulta que tarde más que esto se registra como `warn`. 200 ms es un
   * umbral razonable para consultas OLTP con índices; ajústalo a tu caso.
   */
  slowQueryMs: Number(getEnvVar("SLOW_QUERY_MS", "200")),

  /** Igual que el anterior, pero para el request HTTP completo. */
  slowRequestMs: Number(getEnvVar("SLOW_REQUEST_MS", "1000")),

  /**
   * Token que protege `GET /api/metrics`. Si no se define, el endpoint queda
   * abierto en desarrollo y CERRADO en producción: un endpoint de métricas
   * público filtra rutas internas, volumen de negocio y tasa de errores.
   */
  metricsToken: readEnvVar("METRICS_TOKEN"),
};

// ---------------------------------------------------------------------------
// Verificaciones específicas de producción
// ---------------------------------------------------------------------------

/**
 * ¿Es un `next build` corriendo en una máquina de desarrollo?
 *
 * Hace falta distinguirlo porque `next build` pone `NODE_ENV=production`
 * SIEMPRE, también cuando lo ejecutas tú para comprobar que el proyecto compila.
 * Sin esta distinción, un `npm run build` local fallaría quejándose de que la
 * base apunta a localhost —que es justo lo que quieres en local—.
 *
 * En el build de Vercel la variable `VERCEL` sí está definida, así que ahí las
 * comprobaciones SÍ se ejecutan y un despliegue mal configurado se cae en el
 * build, con un mensaje claro, en vez de en la cara del primer usuario.
 */
const isLocalBuild =
  process.env.NEXT_PHASE === "phase-production-build" && !process.env.VERCEL;

/**
 * Cosas que en tu máquina son una molestia y en producción son un incidente.
 * Se comprueban solo cuando `appEnv === "production"` para no estorbar en clase.
 */
function assertProductionInvariants(): void {
  if (!isProduction || isLocalBuild) return;

  const problems: string[] = [];

  // Un secreto corto es un secreto que se rompe por fuerza bruta. 32
  // caracteres es el mínimo razonable para HS256.
  if (authConfig.accessTokenSecret.length < 32) {
    problems.push("JWT_ACCESS_SECRET debe tener al menos 32 caracteres.");
  }

  if (authConfig.refreshTokenSecret.length < 32) {
    problems.push("JWT_REFRESH_SECRET debe tener al menos 32 caracteres.");
  }

  // Si fueran iguales, un access token valdría como refresh token: la sesión
  // de 15 minutos pasaría a durar lo que dura el refresh.
  if (authConfig.accessTokenSecret === authConfig.refreshTokenSecret) {
    problems.push("JWT_ACCESS_SECRET y JWT_REFRESH_SECRET deben ser distintos.");
  }

  // Apuntar producción a la base de desarrollo es de los errores más caros y
  // más fáciles de cometer.
  if (/localhost|127\.0\.0\.1/.test(databaseUrl)) {
    problems.push(
      "La base de datos apunta a localhost. Configura DATABASE_URL del Postgres administrado."
    );
  }

  // La URL pública puede venir de nuestra variable o del dominio que Vercel
  // asigna al proyecto (ver `resolveSiteUrl` en lib/seo/site.config.ts). Basta
  // con que haya una: si no, el canonical y el sitemap apuntarían a localhost.
  if (
    !readEnvVar("NEXT_PUBLIC_SITE_URL") &&
    !readEnvVar("VERCEL_PROJECT_PRODUCTION_URL")
  ) {
    problems.push(
      "No hay URL pública: define NEXT_PUBLIC_SITE_URL (canonical, sitemap y robots)."
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `Configuración de producción inválida:\n- ${problems.join("\n- ")}`
    );
  }
}

assertProductionInvariants();
