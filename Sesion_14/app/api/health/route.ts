import { NextResponse } from "next/server";
import { appEnv, release } from "@/lib/config/env";
import { checkDatabaseHealth } from "@/lib/db/prisma";

/**
 * GET /api/health → ¿está vivo esto y puede trabajar?
 *
 * No es un adorno. Es el endpoint que consulta cualquier cosa que vigile la
 * aplicación: un monitor externo (UptimeRobot, Better Stack), el balanceador
 * antes de mandarle tráfico a una instancia, o tú mismo a los treinta segundos
 * de un despliegue para saber si hay que hacer rollback.
 *
 * La distinción clásica:
 *
 * - **liveness**: "¿el proceso responde?". Si esto falla, hay que reiniciar.
 * - **readiness**: "¿puede atender de verdad?". Aquí eso significa que llega a
 *   Postgres. Una app que responde pero no tiene base es una app que devuelve
 *   500 a todo el mundo: conviene que el monitor lo sepa ANTES que los usuarios.
 *
 * Por eso devuelve 503 —no 200 con un campo `ok: false`— cuando la base no
 * responde: un monitor mira el código de estado, no el cuerpo.
 *
 * Deliberadamente NO pasa por `withApiRoute`: un health check que se consulta
 * cada treinta segundos generaría un log por minuto y contaminaría las métricas
 * de latencia con tráfico que no es de usuarios.
 */

// Sin esto Next podría precalcular la respuesta en build: un health check
// cacheado diría "todo bien" aunque la base llevara horas caída.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const database = await checkDatabaseHealth();

  const body = {
    status: database.ok ? "ok" : "degraded",
    env: appEnv,
    release,
    uptimeSeconds: Math.round(process.uptime()),
    checks: {
      database: {
        ok: database.ok,
        latencyMs: database.latencyMs,
        // El mensaje del error solo se expone fuera de producción: en
        // producción delataría host, usuario o nombre de la base.
        ...(database.error && appEnv !== "production"
          ? { error: database.error }
          : {}),
      },
    },
  };

  return NextResponse.json(body, {
    status: database.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
