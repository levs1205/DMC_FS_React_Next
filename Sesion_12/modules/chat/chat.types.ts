/**
 * Contrato del asistente: lo que manda el navegador y lo que le va llegando
 * mientras el modelo piensa.
 */

/**
 * Un mensaje de la conversación. Se usan los nombres de rol de Gemini
 * ("user" / "model") para no tener que traducirlos en cada vuelta.
 *
 * El historial lo guarda el NAVEGADOR y viaja en cada pedido. Podríamos
 * guardarlo del lado de Google (la API de Interactions lo hace con un
 * `previous_interaction_id`), pero teniendo datos de alumnos de por medio es
 * preferible que la conversación no viva en un servidor ajeno: acá cada turno
 * manda lo que necesita y nada queda persistido afuera.
 */
export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

/** Cuerpo de POST /api/chat. */
export interface ChatRequest {
  message: string;
  history: ChatMessage[];
}

/**
 * Eventos que viajan por el stream, uno por línea SSE.
 *
 * `tool` existe por transparencia, y no es un adorno: es lo que deja ver con
 * qué filtros se respondió. Si el asistente dice "Ana gastó S/ 4.860", el
 * evento de herramienta muestra que consultó `{student: "ana", status: "PAID"}`
 * y no hay que creerle a ciegas.
 */
export type ChatEvent =
  | { type: "tool"; name: string; label: string; args: Record<string, unknown> }
  | { type: "text"; value: string }
  | { type: "done" }
  | { type: "error"; message: string };
