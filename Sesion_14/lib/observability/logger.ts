import { trace } from "@opentelemetry/api";
import {
  appEnv,
  observabilityConfig,
  release,
  type LogLevel,
} from "@/lib/config/env";
import { getRequestContext } from "@/lib/observability/request-context";

/**
 * Logger estructurado.
 *
 * La diferencia entre esto y `console.log` no es estética. Un log de
 * producción no se lee, se *consulta*: "dame los errores de POST /api/booking
 * de la última hora que tardaron más de dos segundos". Eso solo se puede
 * preguntar si cada línea es un objeto con campos, no una frase. Por eso en el
 * servidor la salida es JSON —Vercel lo parsea y lo indexa solo— y en tu
 * terminal es texto legible, que para depurar a mano es mejor.
 *
 * Tres cosas que añade y que no vas a querer escribir a mano cada vez:
 *
 * - **Correlación.** Cada línea lleva `requestId` y, si hay traza activa,
 *   `traceId`/`spanId`. Con eso, ante un error, se reconstruye el request
 *   completo: qué consultas hizo, cuánto tardó cada una, dónde reventó.
 * - **Contexto heredado.** `logger.child({ module: "pagos" })` devuelve un
 *   logger que estampa ese campo en todo lo que emita.
 * - **Redacción.** Las claves que parecen secretos se reemplazan por
 *   `[redacted]` antes de salir. Un token de sesión en los logs es una brecha
 *   de seguridad, y los logs se copian, se exportan y se comparten.
 */

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const minimumWeight = LEVEL_WEIGHT[observabilityConfig.logLevel];

export type LogFields = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Redacción de secretos
// ---------------------------------------------------------------------------

const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|credential/i;

const REDACTED = "[redacted]";

/**
 * Recorre el objeto reemplazando los valores de claves sensibles. El límite de
 * profundidad evita que una estructura cíclica o muy anidada (un `NextRequest`
 * entero, por ejemplo) cuelgue el proceso mientras se serializa.
 */
function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth-limit]";

  if (value instanceof Error) return serializeError(value);

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redact(item, depth + 1));
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(item, depth + 1);
    }

    return output;
  }

  return value;
}

function serializeError(error: Error): LogFields {
  return {
    name: error.name,
    message: error.message,
    // El stack completo en producción es ruido caro; las primeras líneas
    // alcanzan para ubicar el origen.
    stack: error.stack?.split("\n").slice(0, 8).join("\n"),
    ...(error.cause ? { cause: String(error.cause) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------

/**
 * Campos que lleva *toda* línea, vengan de donde vengan. `env` y `release`
 * permiten separar preview de producción y atribuir una regresión a un
 * despliegue concreto.
 */
function baseFields(): LogFields {
  const fields: LogFields = {
    env: appEnv,
    service: observabilityConfig.serviceName,
    release,
  };

  const context = getRequestContext();

  if (context) {
    fields.requestId = context.requestId;
    fields.method = context.method;
    fields.route = context.route;
    if (context.userId !== undefined) fields.userId = context.userId;
  }

  // El id de traza es el pegamento entre este log y el span correspondiente en
  // el visor de trazas: permite saltar de "este error" a "esta línea de tiempo".
  const spanContext = trace.getActiveSpan()?.spanContext();

  if (spanContext) {
    fields.traceId = spanContext.traceId;
    fields.spanId = spanContext.spanId;
  }

  return fields;
}

const PRETTY_LABEL: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO ",
  warn: "WARN ",
  error: "ERROR",
};

function writePretty(level: LogLevel, message: string, fields: LogFields): void {
  const time = new Date().toISOString().slice(11, 23);
  const { env, service, release: _release, ...rest } = fields;
  void env;
  void service;
  void _release;

  const suffix = Object.entries(rest)
    .map(([key, value]) => {
      const text =
        typeof value === "string" ? value : JSON.stringify(value) ?? "";
      return `${key}=${text}`;
    })
    .join(" ");

  const line = `${time} ${PRETTY_LABEL[level]} ${message}${suffix ? ` ${suffix}` : ""}`;

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function writeJson(level: LogLevel, message: string, fields: LogFields): void {
  const payload = JSON.stringify({
    level,
    time: new Date().toISOString(),
    msg: message,
    ...fields,
  });

  // Se usa el método de consola que corresponde al nivel porque Vercel
  // clasifica los Runtime Logs por ahí: `console.error` es lo que hace que una
  // línea aparezca como error en el dashboard y dispare alertas.
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.log(payload);
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export class Logger {
  constructor(private readonly bindings: LogFields = {}) {}

  /** Nuevo logger que arrastra estos campos en cada línea que emita. */
  child(bindings: LogFields): Logger {
    return new Logger({ ...this.bindings, ...bindings });
  }

  debug(message: string, fields?: LogFields): void {
    this.write("debug", message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.write("info", message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.write("warn", message, fields);
  }

  /**
   * `error` acepta el error como primer campo para no tener que serializarlo a
   * mano: `logger.error("falló el cobro", { err, bookingId })`.
   */
  error(message: string, fields?: LogFields): void {
    this.write("error", message, fields);
  }

  private write(level: LogLevel, message: string, fields?: LogFields): void {
    if (LEVEL_WEIGHT[level] < minimumWeight) return;

    const merged = {
      ...baseFields(),
      ...(redact(this.bindings) as LogFields),
      ...(redact(fields ?? {}) as LogFields),
    };

    if (observabilityConfig.logFormat === "pretty") {
      writePretty(level, message, merged);
    } else {
      writeJson(level, message, merged);
    }
  }
}

export const logger = new Logger();
