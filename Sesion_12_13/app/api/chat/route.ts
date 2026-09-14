import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/http/api-error";
import { handleRouteError } from "@/lib/http/handle-route-error";
import { validateBody } from "@/lib/http/validate-body";
import { requireApiSession } from "@/modules/auth/auth.session";
import { assertChatRateLimit } from "@/modules/chat/chat.rate-limit";
import { chatRequestSchema } from "@/modules/chat/chat.schemas";
import { streamChatReply } from "@/modules/chat/chat.service";
import type { ChatEvent } from "@/modules/chat/chat.types";

/**
 * POST /api/chat
 * Body: { "message": "¿cuánto facturó Ana en octubre?", "history": [...] }
 *
 * Responde con un stream de Server-Sent Events: una línea `data: {json}` por
 * cada evento (`tool`, `text`, `done`, `error`).
 *
 * Se eligió SSE y no WebSocket porque el flujo es de una sola dirección —el
 * servidor cuenta, el navegador escucha— y SSE es HTTP común: viaja con la
 * misma cookie de sesión, pasa por los mismos proxies y no necesita otro
 * servidor. No se usa `EventSource` del lado del cliente porque solo sabe
 * hacer GET, y acá hace falta mandar el mensaje en el cuerpo: se lee el
 * `body` del fetch a mano, que es igual de simple.
 *
 * Solo ADMIN: el asistente puede leer las reservas de todos los alumnos.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession("ADMIN");

    // Antes de leer el cuerpo: si ya gastó el cupo, no tiene sentido ni
    // parsear el JSON.
    assertChatRateLimit(session.id);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "El cuerpo de la solicitud debe ser JSON válido.");
    }

    const input = validateBody(chatRequestSchema, body);

    const events = streamChatReply({
      message: input.message,
      history: input.history,
      adminName: session.name,
      // Si la persona cierra la pestaña o corta la respuesta, se abandona
      // también la llamada al modelo en vez de seguir gastando tokens.
      signal: request.signal,
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let isOpen = true;

        const send = (event: ChatEvent) => {
          if (!isOpen) return;

          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            // El navegador cortó: dejamos de escribir y salimos ordenados.
            isOpen = false;
          }
        };

        try {
          for await (const event of events) send(event);
          send({ type: "done" });
        } catch (error) {
          // Momento clave: los headers ya salieron, así que acá NO se puede
          // devolver un 500. El error tiene que viajar como un evento más y
          // que la pantalla lo muestre dentro de la conversación.
          if (!request.signal.aborted) {
            console.error("[chat] error durante el stream", error);

            send({
              type: "error",
              // El detalle se muestra tal cual porque este endpoint es solo
              // para ADMIN y casi siempre dice qué configurar (por ejemplo,
              // que falta GEMINI_API_KEY).
              message:
                error instanceof Error
                  ? error.message
                  : "El asistente no pudo responder.",
            });
          }
        } finally {
          if (isOpen) {
            try {
              controller.close();
            } catch {
              // Ya estaba cerrado por el lado del cliente.
            }
          }
        }
      },

      // El navegador abandonó el stream: se corta el generador para que no
      // siga pidiéndole cosas al modelo.
      cancel() {
        void events.return(undefined);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        // Sin esto, un proxy intermedio puede juntar todo y entregarlo de
        // golpe al final, que es exactamente lo contrario de un stream.
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    // Errores de ANTES del stream (sesión, cuerpo inválido): acá sí se puede
    // responder con el código de estado que corresponde.
    return handleRouteError(error);
  }
}
