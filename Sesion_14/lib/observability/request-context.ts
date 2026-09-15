import { AsyncLocalStorage } from "node:async_hooks";

/**
 * El "quién y qué" del request en curso, disponible en cualquier punto de la
 * pila sin pasarlo por parámetro.
 *
 * El problema que resuelve: cuando el repositorio de reservas quiere registrar
 * una consulta lenta, necesita decir *de qué request* venía. La alternativa es
 * arrastrar un `ctx` desde el route handler hasta el último `prisma.booking
 * .findMany`, ensuciando cada firma del camino. `AsyncLocalStorage` es la
 * herramienta que Node ofrece para esto: un almacén ligado a la cadena de
 * ejecución asíncrona, que sobrevive a los `await` y no se mezcla entre
 * requests concurrentes.
 *
 * Solo funciona en el runtime de Node (no en Edge), que es donde corren los
 * route handlers, los server components y —desde Next 16— también el proxy.
 */
export interface RequestContext {
  /** Identificador del request. Viaja en el header `x-request-id`. */
  requestId: string;
  method: string;
  /** Patrón de ruta, p. ej. "/api/booking/[id]". Nunca la URL con datos. */
  route: string;
  /** Id del usuario autenticado, si ya se resolvió la sesión. */
  userId?: number;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Ejecuta `fn` con un contexto de request activo. */
export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T
): T {
  return storage.run(context, fn);
}

/**
 * Añade datos al contexto ya activo (mutación deliberada del store).
 *
 * Sirve para lo que se descubre a mitad del request: el `userId` no se conoce
 * hasta que se valida la sesión, pero una vez conocido queremos que aparezca
 * también en los logs que ya se van a emitir después.
 */
export function enrichRequestContext(patch: Partial<RequestContext>): void {
  const current = storage.getStore();

  if (current) Object.assign(current, patch);
}

/**
 * Identificador de request. Se prefiere el que ya venga del borde (Vercel
 * manda `x-vercel-id`) para poder cruzar nuestros logs con los suyos.
 */
export function createRequestId(): string {
  return crypto.randomUUID();
}
