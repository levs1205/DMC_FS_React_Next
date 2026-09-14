/**
 * Ruta: "/backoffice/chat"
 *
 * Client Component: conversa con POST /api/chat y va pintando la respuesta a
 * medida que llega. El guardia de rol ya lo puso el layout de /backoffice, así
 * que acá no hace falta volver a chequear nada.
 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import "./page.css";
import { apiFetch } from "@/lib/http/api-client";
import type { ChatEvent, ChatMessage } from "@/modules/chat/chat.types";

interface ToolTrace {
  label: string;
  args: Record<string, unknown>;
}

interface Entry {
  role: "user" | "model";
  text: string;
  tools: ToolTrace[];
}

const SUGGESTIONS = [
  "¿Cuánto se cobró en total y cuántas reservas hay?",
  "¿Qué habitación generó más ingresos este año?",
  "Mostrame las reservas canceladas con su importe",
];

/** `{"student":"ana"}` → `student: ana`, para mostrarlo en una línea. */
function formatArgs(args: Record<string, unknown>): string {
  const parts = Object.entries(args).map(([key, value]) => `${key}: ${value}`);

  return parts.length > 0 ? parts.join(" · ") : "sin filtros";
}

function toHistory(entries: Entry[]): ChatMessage[] {
  return entries
    .filter((entry) => entry.text.trim() !== "")
    .map((entry) => ({ role: entry.role, text: entry.text }));
}

export default function ChatPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Cada vez que crece la conversación, el scroll sigue al último mensaje.
  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [entries]);

  // Si la persona se va de la página en medio de una respuesta, se corta el
  // pedido: el servidor lo ve y abandona también la llamada al modelo.
  useEffect(() => () => abortRef.current?.abort(), []);

  /** Aplica un evento del stream sobre el último mensaje del asistente. */
  const applyEvent = useCallback((event: ChatEvent) => {
    setEntries((current) => {
      const next = [...current];
      const last = next[next.length - 1];

      if (!last || last.role !== "model") return current;

      if (event.type === "text") {
        next[next.length - 1] = { ...last, text: last.text + event.value };
      }

      if (event.type === "tool") {
        next[next.length - 1] = {
          ...last,
          tools: [...last.tools, { label: event.label, args: event.args }],
        };
      }

      return next;
    });
  }, []);

  const send = useCallback(
    async (message: string) => {
      const trimmed = message.trim();

      if (trimmed === "" || isStreaming) return;

      setError(null);
      setDraft("");
      setIsStreaming(true);

      const history = toHistory(entries);

      setEntries((current) => [
        ...current,
        { role: "user", text: trimmed, tools: [] },
        { role: "model", text: "", tools: [] },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await apiFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, history }),
          signal: controller.signal,
        });

        if (response.status === 401) {
          router.push("/login");
          return;
        }

        // Un error de ANTES del stream llega como JSON normal, con su código.
        if (!response.ok || !response.body) {
          const data = await response.json().catch(() => null);
          setError(data?.message ?? "El asistente no pudo responder.");
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Un evento SSE termina en línea en blanco. El último trozo puede
          // estar cortado a la mitad, así que se guarda para la vuelta próxima.
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";

          for (const block of blocks) {
            const line = block
              .split("\n")
              .find((candidate) => candidate.startsWith("data: "));

            if (!line) continue;

            const event = JSON.parse(line.slice(6)) as ChatEvent;

            if (event.type === "error") setError(event.message);
            else applyEvent(event);
          }
        }
      } catch (streamError) {
        // Abortar es una decisión de la persona, no una falla.
        if ((streamError as Error).name !== "AbortError") {
          setError("Se cortó la conexión con el asistente.");
        }
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [applyEvent, entries, isStreaming, router]
  );

  return (
    <main className="chat">
      <header className="chat__header">
        <h1 className="chat__title">Asistente de reservas</h1>
        <p className="chat__subtitle">
          Pregunta en lenguaje natural. Solo puede leer reservas, alumnos y
          habitaciones: no modifica nada.
        </p>
      </header>

      <div className="chat__thread" ref={threadRef}>
        {entries.length === 0 && (
          <div className="chat__empty">
            <p className="chat__empty-title">Probá con algo así:</p>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="chat__suggestion"
                onClick={() => send(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {entries.map((entry, index) => (
          <article
            // La conversación solo crece por el final: el índice alcanza como
            // clave y no hay reordenamientos que puedan confundir a React.
            key={index}
            className={`chat__message chat__message--${entry.role}`}
          >
            {entry.tools.map((tool, toolIndex) => (
              <p key={toolIndex} className="chat__tool">
                {tool.label}
                <span className="chat__tool-args">{formatArgs(tool.args)}</span>
              </p>
            ))}

            {entry.text !== "" && <p className="chat__text">{entry.text}</p>}

            {entry.role === "model" &&
              entry.text === "" &&
              entry.tools.length === 0 &&
              isStreaming && <p className="chat__thinking">Pensando…</p>}
          </article>
        ))}
      </div>

      {error && <p className="chat__error">{error}</p>}

      <form
        className="chat__form"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <input
          className="chat__input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="¿Cuánto facturó cada tipo de habitación en octubre?"
          maxLength={2000}
          disabled={isStreaming}
          autoFocus
        />

        {isStreaming ? (
          <button
            type="button"
            className="chat__button chat__button--stop"
            onClick={() => abortRef.current?.abort()}
          >
            Detener
          </button>
        ) : (
          <button
            type="submit"
            className="chat__button"
            disabled={draft.trim() === ""}
          >
            Preguntar
          </button>
        )}
      </form>
    </main>
  );
}
