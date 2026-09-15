/**
 * Registro de métricas en memoria, con salida en formato de texto de
 * Prometheus.
 *
 * ## Por qué métricas si ya hay logs y trazas
 *
 * Son tres preguntas distintas y ninguna reemplaza a las otras:
 *
 * - **Log**: "¿qué pasó en ESTE request?" — un evento, con todo su detalle.
 * - **Traza**: "¿dónde se fue el tiempo en ESTE request?" — la línea de tiempo.
 * - **Métrica**: "¿cómo se está comportando el sistema EN GENERAL?" — un
 *   número agregado y barato: requests por segundo, percentil 95 de latencia,
 *   porcentaje de errores.
 *
 * Los logs no sirven para responder lo tercero: contar diez millones de líneas
 * para calcular un promedio es lento y caro. Una métrica es un contador que ya
 * viene sumado.
 *
 * ## Advertencia honesta sobre serverless
 *
 * Este registro vive en la memoria del proceso. En Vercel cada función corre en
 * instancias efímeras y múltiples, así que `GET /api/metrics` devuelve lo que
 * vio *la instancia que atendió esa llamada*, no el total del sistema. Sirve
 * perfectamente para aprender el modelo y para depurar, pero en un sistema real
 * con varias instancias las métricas no se *exponen*, se *empujan*: cada
 * instancia manda sus números a un colector (OTLP, StatsD, Prometheus
 * remote-write) que los agrega. La otra salida —la que usa mucha gente en
 * Vercel— es derivar las métricas de los logs estructurados, que es
 * precisamente para lo que sirve el logger JSON de al lado.
 */

type LabelValues = Record<string, string | number>;

function renderLabels(labels: LabelValues): string {
  const entries = Object.entries(labels);

  if (entries.length === 0) return "";

  const body = entries
    .map(([key, value]) => `${key}="${escapeLabelValue(String(value))}"`)
    .join(",");

  return `{${body}}`;
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

// Clave estable para una combinación de etiquetas: mismo orden de claves ⇒
// misma serie temporal, aunque quien llame las escriba desordenadas.
function seriesKey(labels: LabelValues): string {
  return JSON.stringify(
    Object.keys(labels)
      .sort()
      .map((key) => [key, String(labels[key])])
  );
}

interface Metric {
  render(): string[];
}

// ---------------------------------------------------------------------------
// Counter: solo sube. Requests atendidos, errores, reintentos.
// ---------------------------------------------------------------------------

class Counter implements Metric {
  private readonly series = new Map<string, { labels: LabelValues; value: number }>();

  constructor(
    private readonly name: string,
    private readonly help: string
  ) {}

  inc(labels: LabelValues = {}, value = 1): void {
    const key = seriesKey(labels);
    const current = this.series.get(key);

    if (current) current.value += value;
    else this.series.set(key, { labels, value });
  }

  render(): string[] {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];

    for (const { labels, value } of this.series.values()) {
      lines.push(`${this.name}${renderLabels(labels)} ${value}`);
    }

    return lines;
  }
}

// ---------------------------------------------------------------------------
// Histogram: distribución. Es lo que permite hablar de percentiles.
// ---------------------------------------------------------------------------

/**
 * Cubetas por defecto, en milisegundos. Están apretadas abajo y separadas
 * arriba a propósito: la diferencia entre 5 ms y 25 ms importa mucho, la que
 * hay entre 5 s y 6 s ya no —a esa altura el usuario se fue igual.
 */
const DEFAULT_BUCKETS_MS = [
  5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
];

interface HistogramSeries {
  labels: LabelValues;
  counts: number[];
  sum: number;
  count: number;
}

class Histogram implements Metric {
  private readonly series = new Map<string, HistogramSeries>();

  constructor(
    private readonly name: string,
    private readonly help: string,
    private readonly buckets: number[] = DEFAULT_BUCKETS_MS
  ) {}

  observe(value: number, labels: LabelValues = {}): void {
    const key = seriesKey(labels);
    let entry = this.series.get(key);

    if (!entry) {
      entry = {
        labels,
        counts: new Array(this.buckets.length).fill(0),
        sum: 0,
        count: 0,
      };
      this.series.set(key, entry);
    }

    entry.sum += value;
    entry.count += 1;

    // Prometheus usa cubetas ACUMULATIVAS: `le="100"` cuenta todo lo que tardó
    // 100 ms o menos, no solo lo que cayó en ese tramo.
    for (let index = 0; index < this.buckets.length; index += 1) {
      if (value <= this.buckets[index]) entry.counts[index] += 1;
    }
  }

  render(): string[] {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} histogram`,
    ];

    for (const entry of this.series.values()) {
      this.buckets.forEach((bucket, index) => {
        lines.push(
          `${this.name}_bucket${renderLabels({ ...entry.labels, le: bucket })} ${entry.counts[index]}`
        );
      });

      lines.push(
        `${this.name}_bucket${renderLabels({ ...entry.labels, le: "+Inf" })} ${entry.count}`
      );
      lines.push(`${this.name}_sum${renderLabels(entry.labels)} ${entry.sum}`);
      lines.push(`${this.name}_count${renderLabels(entry.labels)} ${entry.count}`);
    }

    return lines;
  }
}

// ---------------------------------------------------------------------------
// Gauge: sube y baja. Conexiones abiertas, tamaño de una cola.
// ---------------------------------------------------------------------------

class Gauge implements Metric {
  private readonly series = new Map<string, { labels: LabelValues; value: number }>();

  constructor(
    private readonly name: string,
    private readonly help: string
  ) {}

  set(value: number, labels: LabelValues = {}): void {
    this.series.set(seriesKey(labels), { labels, value });
  }

  render(): string[] {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];

    for (const { labels, value } of this.series.values()) {
      lines.push(`${this.name}${renderLabels(labels)} ${value}`);
    }

    return lines;
  }
}

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------

/**
 * Las métricas se guardan en `globalThis` por el mismo motivo que el cliente de
 * Prisma: Fast Refresh recarga el módulo en desarrollo y, sin esto, cada
 * edición reiniciaría los contadores a cero.
 */
declare global {
  var __metrics: Map<string, Metric> | undefined;
}

const registry: Map<string, Metric> = globalThis.__metrics ?? new Map();
globalThis.__metrics = registry;

function register<T extends Metric>(name: string, create: () => T): T {
  const existing = registry.get(name);

  if (existing) return existing as T;

  const metric = create();
  registry.set(name, metric);

  return metric;
}

export const metrics = {
  /** Requests HTTP atendidos, por método, ruta y código de estado. */
  httpRequestsTotal: register(
    "http_requests_total",
    () => new Counter("http_requests_total", "Requests HTTP atendidos.")
  ),

  /** Latencia del request completo, de extremo a extremo. */
  httpRequestDurationMs: register(
    "http_request_duration_ms",
    () =>
      new Histogram(
        "http_request_duration_ms",
        "Duración de los requests HTTP en milisegundos."
      )
  ),

  /** Consultas a la base, por modelo y operación de Prisma. */
  dbQueriesTotal: register(
    "db_queries_total",
    () => new Counter("db_queries_total", "Consultas ejecutadas contra Postgres.")
  ),

  /**
   * Latencia de cada consulta. Cubetas más finas que las HTTP: una consulta
   * que tarda 250 ms ya es sospechosa, y a esa escala las cubetas por defecto
   * no distinguen nada.
   */
  dbQueryDurationMs: register(
    "db_query_duration_ms",
    () =>
      new Histogram(
        "db_query_duration_ms",
        "Duración de las consultas a Postgres en milisegundos.",
        [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500]
      )
  ),

  /** Errores no controlados, por tipo y por ruta. */
  errorsTotal: register(
    "errors_total",
    () => new Counter("errors_total", "Errores no controlados.")
  ),

  /** Llamadas a servicios externos (Mercado Pago, Gemini). */
  externalCallsTotal: register(
    "external_calls_total",
    () => new Counter("external_calls_total", "Llamadas a APIs de terceros.")
  ),

  externalCallDurationMs: register(
    "external_call_duration_ms",
    () =>
      new Histogram(
        "external_call_duration_ms",
        "Duración de las llamadas a APIs de terceros en milisegundos."
      )
  ),

  /** Segundos que lleva viva esta instancia: delata reinicios y arranques en frío. */
  processUptimeSeconds: register(
    "process_uptime_seconds",
    () =>
      new Gauge("process_uptime_seconds", "Tiempo de vida de la instancia en segundos.")
  ),
};

/** Serializa todo el registro en el formato de texto que entiende Prometheus. */
export function renderMetrics(): string {
  metrics.processUptimeSeconds.set(Math.round(process.uptime()));

  const blocks: string[] = [];

  for (const metric of registry.values()) {
    blocks.push(metric.render().join("\n"));
  }

  // El formato exige un salto de línea final; sin él, algunos scrapers cortan
  // la última muestra.
  return `${blocks.join("\n\n")}\n`;
}
