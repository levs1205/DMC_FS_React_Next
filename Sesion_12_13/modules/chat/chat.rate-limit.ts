import "server-only";

import { ApiError } from "@/lib/http/api-error";

/**
 * Límite de preguntas por administrador.
 *
 * No es una defensa contra intrusos —para llegar acá hay que tener sesión de
 * ADMIN— sino contra el gasto. Cada pregunta del asistente dispara entre una y
 * cinco llamadas a Google, y la capa gratuita permite 5 por minuto: una
 * pestaña con un bucle, un botón que se reenvía solo o alguien impaciente
 * dejan al resto del equipo sin servicio, o hacen crecer la factura si el plan
 * es pago. Es el equivalente, para una API que se cobra por uso, de no dejar
 * una consulta sin LIMIT.
 *
 * LIMITACIÓN IMPORTANTE: el contador vive en la memoria de ESTE proceso. En
 * desarrollo y en un servidor único alcanza y sobra. Si mañana la app corre en
 * varias instancias o en funciones serverless, cada una llevaría su propia
 * cuenta y el límite real sería el múltiplo: ahí hay que mover el contador a
 * un almacén compartido (Redis, Upstash o la propia base).
 */

const WINDOW_MS = 60_000;
const MAX_MESSAGES_PER_WINDOW = 10;

/** A partir de cuántos usuarios distintos conviene barrer el mapa. */
const PRUNE_THRESHOLD = 500;

const recentByUser = new Map<number, number[]>();

function prune(now: number): void {
  for (const [userId, timestamps] of recentByUser) {
    const alive = timestamps.filter((time) => now - time < WINDOW_MS);

    if (alive.length === 0) recentByUser.delete(userId);
    else recentByUser.set(userId, alive);
  }
}

/** Lanza 429 si el usuario ya gastó su cupo del minuto. */
export function assertChatRateLimit(userId: number): void {
  const now = Date.now();

  if (recentByUser.size > PRUNE_THRESHOLD) prune(now);

  const recent = (recentByUser.get(userId) ?? []).filter(
    (time) => now - time < WINDOW_MS
  );

  if (recent.length >= MAX_MESSAGES_PER_WINDOW) {
    const oldest = Math.min(...recent);
    const waitSeconds = Math.ceil((WINDOW_MS - (now - oldest)) / 1000);

    throw new ApiError(
      429,
      `Demasiadas preguntas seguidas. Esperá ${waitSeconds} segundo(s) antes de volver a preguntar.`
    );
  }

  recent.push(now);
  recentByUser.set(userId, recent);
}
