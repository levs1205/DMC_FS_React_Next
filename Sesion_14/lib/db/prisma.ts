import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import {
  databaseUrl,
  dbPoolSize,
  isDevelopment,
  observabilityConfig,
} from "@/lib/config/env";
import { logger } from "@/lib/observability/logger";
import { metrics } from "@/lib/observability/metrics";
import { startTimer, withSpan } from "@/lib/observability/tracing";

/**
 * Cliente de Prisma, con pool dimensionado para serverless y con cada consulta
 * cronometrada.
 */

const dbLogger = logger.child({ module: "db" });

/**
 * Pool de conexiones.
 *
 * `max` es la pieza importante en serverless y conviene entender por qué. Cada
 * instancia de la función abre su propio pool contra Postgres; si hay 30
 * instancias calientes y cada una abre 10 conexiones, son 300 conexiones contra
 * un servidor que admite 100 y el resultado es "too many clients already" —un
 * error que no aparece nunca en desarrollo y revienta el primer día de tráfico
 * real. Con un pool chico por instancia, el sistema escala a lo ancho sin
 * agotar el servidor, y de la multiplexación se encarga el pooler (PgBouncer)
 * que está del otro lado.
 *
 * Los dos timeouts evitan el otro modo de fallo: una función serverless que se
 * queda colgada esperando una conexión hasta agotar su tiempo máximo y factura
 * ese tiempo sin hacer nada. Mejor fallar rápido y claro.
 */
const adapter = new PrismaPg({
  connectionString: databaseUrl,
  max: dbPoolSize,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

function createPrismaClient() {
  const client = new PrismaClient({ adapter });

  /**
   * Extensión que envuelve TODA operación de Prisma —consultas de modelo,
   * `$queryRaw`, transacciones— para medirla.
   *
   * De cada consulta salen tres señales, y cada una responde a una pregunta
   * distinta:
   *
   * - un **span** anidado dentro del request, que muestra la consulta en la
   *   línea de tiempo y deja ver el N+1 de un vistazo;
   * - una **métrica** (contador + histograma) para preguntar por el percentil
   *   95 de `booking.findMany` sin leer un solo log;
   * - un **log** en `debug`, o en `warn` si pasa el umbral de lentitud, para
   *   cuando hay que mirar un caso concreto.
   *
   * Lo que NO se registra son los `args`: ahí van nombres, logins y fechas de
   * los usuarios. Se registran el modelo y la operación, que son de baja
   * cardinalidad y no identifican a nadie.
   */
  return client.$extends({
    name: "observability",
    query: {
      async $allOperations({ model, operation, args, query }) {
        const target = model ?? "raw";
        const elapsed = startTimer();

        return withSpan(
          `db ${target}.${operation}`,
          {
            // Convención semántica de OpenTelemetry: así cualquier visor de
            // trazas reconoce el span como una llamada a base de datos y lo
            // pinta en su carril, en vez de como un tramo genérico.
            "db.system": "postgresql",
            "db.operation": operation,
            "db.sql.table": target,
          },
          async (span) => {
            let outcome: "ok" | "error" = "ok";

            try {
              return await query(args);
            } catch (error) {
              outcome = "error";
              throw error;
            } finally {
              const durationMs = elapsed();
              const labels = { model: target, operation, outcome };

              span.setAttribute("db.duration_ms", Math.round(durationMs));

              metrics.dbQueriesTotal.inc(labels);
              metrics.dbQueryDurationMs.observe(durationMs, labels);

              const fields = {
                model: target,
                operation,
                outcome,
                durationMs: Math.round(durationMs),
              };

              if (durationMs > observabilityConfig.slowQueryMs) {
                dbLogger.warn("consulta lenta", fields);
              } else {
                dbLogger.debug("consulta", fields);
              }
            }
          }
        );
      },
    },
  });
}

/**
 * Una sola instancia por proceso, reutilizada entre recargas de Fast Refresh.
 * Sin esto, cada edición en desarrollo dejaría un pool de conexiones huérfano
 * hasta agotar los slots de Postgres.
 */
declare global {
  var __prisma: ReturnType<typeof createPrismaClient> | undefined;
}

export const prisma = globalThis.__prisma ?? createPrismaClient();

if (isDevelopment) {
  globalThis.__prisma = prisma;
}

/**
 * Comprobación de vida de la base para el health check.
 *
 * `SELECT 1` es a propósito la consulta más barata posible: mide que haya
 * conexión y que el servidor responda, sin depender de que exista ninguna
 * tabla ni de que las migraciones estén al día.
 */
export async function checkDatabaseHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const elapsed = startTimer();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return { ok: true, latencyMs: Math.round(elapsed()) };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Math.round(elapsed()),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
