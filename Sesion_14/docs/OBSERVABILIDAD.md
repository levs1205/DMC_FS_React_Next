# Observabilidad: logs, métricas y trazas

Cómo está instrumentada esta aplicación, cómo se usa cuando algo va mal y cómo
instrumentar código nuevo sin romper las reglas.

---

## 1. Tres señales, tres preguntas

No son tres formas de hacer lo mismo. Cada una responde una pregunta que las
otras dos no pueden responder bien:

| Señal | Pregunta | Coste | Ejemplo |
| --- | --- | --- | --- |
| **Log** | ¿Qué pasó en *este* request? | Alto por evento | `consulta lenta … durationMs=1840` |
| **Traza** | ¿Dónde se fue el tiempo en *este* request? | Medio | El 78 % del tiempo fue esperando a Mercado Pago |
| **Métrica** | ¿Cómo va el sistema *en general*? | Muy bajo | El p95 de `/api/booking` subió a 900 ms |

La típica secuencia de una investigación real las usa las tres, en este orden:

1. La **métrica** avisa: el p95 de una ruta se disparó. *Sé que hay un problema.*
2. La **traza** localiza: el tiempo se va en una consulta concreta. *Sé dónde.*
3. El **log** explica: la consulta trae 40 000 filas porque faltó un filtro.
   *Sé por qué.*

Empezar por el log es lo intuitivo y lo más lento: es buscar una aguja sin saber
todavía en qué pajar.

---

## 2. Mapa de archivos

```
instrumentation.ts                     arranque del SDK de OpenTelemetry + captura global de errores
lib/config/env.ts                      configuración validada, detección de entorno, umbrales
lib/observability/
  ├── logger.ts                        logger estructurado, con redacción de secretos
  ├── metrics.ts                       registro de métricas + salida en formato Prometheus
  ├── request-context.ts               requestId/userId propagados con AsyncLocalStorage
  └── tracing.ts                       withSpan(), startTimer()
lib/http/with-api-route.ts             envoltorio de route handlers: mide, cuenta, registra, captura
lib/http/handle-route-error.ts         excepción → respuesta HTTP
lib/db/prisma.ts                       extensión de Prisma que cronometra cada consulta
app/api/health/route.ts                liveness + readiness
app/api/metrics/route.ts               exposición de métricas
proxy.ts                               genera el x-request-id en el borde
```

---

## 3. Logs

### Formato

En el servidor, JSON (una línea por evento, que Vercel indexa por campo):

```json
{
  "level": "warn",
  "time": "2026-09-14T22:17:21.234Z",
  "msg": "request lento",
  "env": "production",
  "service": "reservas",
  "release": "a1b2c3d",
  "requestId": "f69b7ce2-7ccd-486a-b735-2404acb4dd6e",
  "method": "POST",
  "route": "/api/booking",
  "userId": 7,
  "traceId": "d9bfd208d6adb858fb5ddbe8cec1abc6",
  "spanId": "a7c5acc49f4d0285",
  "status": 201,
  "durationMs": 1840
}
```

En tu terminal, lo mismo pero legible:

```
22:17:21.234 WARN  request lento requestId=f69b7ce2… method=POST route=/api/booking status=201 durationMs=1840
```

Lo controlan `LOG_FORMAT` (`json` | `pretty`) y `LOG_LEVEL`
(`debug` | `info` | `warn` | `error`). Por defecto: `pretty`/`debug` en local,
`json`/`info` en el servidor.

### Qué campos van solos

`env`, `service`, `release`, `requestId`, `method`, `route`, `userId`, `traceId`
y `spanId` los pone el logger; no hay que pasarlos. Vienen de
`lib/observability/request-context.ts` y del span activo de OpenTelemetry.

### Cómo se usa

```ts
import { logger } from "@/lib/observability/logger";

// Logger de módulo: todo lo que emita lleva module="pagos".
const paymentsLogger = logger.child({ module: "pagos" });

paymentsLogger.info("cobro iniciado", { quotationId, amount });

paymentsLogger.error("no se pudo cobrar", {
  quotationId,
  err: error instanceof Error ? error : new Error(String(error)),
});
```

El campo `err` recibe trato especial: se serializa a `{ name, message, stack }`
con el stack recortado a ocho líneas.

### Qué nivel usar

| Nivel | Cuándo | ¿Despierta a alguien? |
| --- | --- | --- |
| `debug` | Detalle para depurar. No se emite en producción | No |
| `info` | Algo normal y relevante pasó | No |
| `warn` | Algo raro, pero el sistema siguió | Solo si se repite |
| `error` | Algo se rompió o requiere una persona | Sí |

El error más común es abusar de `error`. Si todo es un error, nada lo es: la
alerta pierde sentido y se empieza a ignorar. Un 401 por sesión vencida es
`debug`; un webhook con firma inválida es `warn`; un pago cuyo importe no
coincide con la cotización es `error`, porque huele a fraude y alguien tiene que
mirarlo.

### Qué NO registrar nunca

- **Contraseñas, tokens, cookies, claves de API.** El logger redacta
  automáticamente cualquier clave que encaje con
  `pass|secret|token|authorization|cookie|api_key|credential`, pero esa red de
  seguridad no es excusa para tirarle un objeto entero y confiar.
- **Datos personales.** Se registra `userId: 7`, nunca el correo ni el nombre.
  Un `userId` identifica para depurar sin convertir los logs en una base de
  datos personal que hay que proteger y borrar.
- **Cuerpos de request completos.** Caros, ruidosos y llenos de lo anterior.
- **Los `args` de una consulta a la base.** Ahí van nombres, logins y fechas.
  Se registran el modelo y la operación, que no identifican a nadie. (La
  excepción deliberada son los argumentos de las herramientas del chatbot: son
  los filtros que eligió el modelo y son justamente la evidencia de auditoría.)

---

## 4. El hilo que lo cose todo: `requestId`

```
Navegador
   │
   ▼
proxy.ts ─── genera x-request-id (o reutiliza el x-vercel-id)
   │          y lo inyecta en el request que sigue hacia dentro
   ▼
withApiRoute ─── lo lee y abre el contexto con AsyncLocalStorage
   │
   ├─ logger  ──── estampa requestId en CADA línea, sin pasarlo por parámetro
   ├─ prisma  ──── cada consulta hereda el mismo requestId
   └─ respuesta ── cabecera x-request-id + campo requestId en el JSON de error
```

En la práctica: un usuario dice "me dio error al pagar". Le pides el id que
salió en pantalla, lo pegas en el buscador de logs de Vercel y aparece el
request completo: qué ruta, qué usuario, qué consultas hizo, cuánto tardó cada
una y en qué línea reventó. Sin eso, la alternativa es buscar por hora aproximada
entre miles de líneas.

`AsyncLocalStorage` es lo que hace que el repositorio sepa de qué request viene
sin que haya que arrastrar un parámetro `ctx` por toda la pila.

---

## 5. Métricas

### Catálogo

| Métrica | Tipo | Etiquetas |
| --- | --- | --- |
| `http_requests_total` | counter | `method`, `route`, `status` |
| `http_request_duration_ms` | histogram | `method`, `route`, `status` |
| `db_queries_total` | counter | `model`, `operation`, `outcome` |
| `db_query_duration_ms` | histogram | `model`, `operation`, `outcome` |
| `errors_total` | counter | `route`, `type` |
| `external_calls_total` | counter | `provider`, `operation`, `outcome` |
| `external_call_duration_ms` | histogram | `provider`, `operation` |
| `process_uptime_seconds` | gauge | — |

### Los tres tipos

- **Counter** — solo sube. Requests, errores, reintentos. Lo interesante no es
  el valor sino su *derivada*: "errores por minuto".
- **Gauge** — sube y baja. Conexiones abiertas, uptime.
- **Histogram** — la distribución. Es lo único que permite hablar de
  percentiles, y los percentiles son lo que importa: un promedio de 200 ms
  puede esconder que uno de cada veinte usuarios espera cuatro segundos. El p95
  no lo esconde.

### La regla de la cardinalidad

**Las etiquetas deben tener pocos valores posibles.** Cada combinación distinta
de etiquetas es una serie temporal en memoria.

```ts
// MAL: una serie por reserva. Con 10 000 reservas, 10 000 series.
metrics.httpRequestsTotal.inc({ route: "/api/booking/1837" });

// BIEN: una serie por endpoint.
metrics.httpRequestsTotal.inc({ route: "/api/booking/[id]" });
```

Por eso `withApiRoute` recibe el **patrón** de la ruta como primer argumento en
lugar de deducirlo de la URL. Nunca pongas como etiqueta un id, un correo, una
marca de tiempo ni un mensaje de error.

### Consultarlas

```bash
curl -s -H "Authorization: Bearer $METRICS_TOKEN" https://tu-dominio.com/api/metrics
```

Sin `METRICS_TOKEN` configurado, el endpoint queda abierto en desarrollo y
devuelve **404** en producción (404 y no 403: un 403 confirmaría que existe).

### La limitación que hay que entender

El registro vive **en la memoria del proceso**. En Vercel cada función corre en
instancias efímeras y múltiples, así que `/api/metrics` devuelve lo que vio *la
instancia que atendió esa llamada*. Dos llamadas seguidas pueden dar números
distintos, e incluso menores. **Es esperable, no es un bug.**

Para un proyecto educativo es perfecto: el modelo se entiende, el formato es el
real y se puede razonar sobre él. En un sistema con varias instancias hay dos
caminos de verdad:

1. **Empujar** las métricas a un colector (OTLP, StatsD, Prometheus
   remote-write) que las agregue entre instancias.
2. **Derivarlas de los logs.** Como cada request emite una línea JSON con
   `route`, `status` y `durationMs`, cualquier motor de logs puede calcular el
   p95 sobre eso. Es lo más habitual en Vercel, y es exactamente la razón por la
   que el logger escribe JSON estructurado y no texto.

---

## 6. Trazas

### Qué se instrumenta solo

`@vercel/otel`, arrancado en `instrumentation.ts`, hace que Next.js emita spans
del request, del render de cada ruta, de la ejecución de cada route handler y de
cada `fetch`. No hay que escribir nada para eso.

Encima de eso, el proyecto añade spans propios:

- `db <Modelo>.<operacion>` — una por consulta, desde la extensión de Prisma.
- `mercadopago <operacion>` — una por llamada al proveedor de pagos.

### Ver las trazas

**En Vercel:** pestaña **Observability**. Llegan solas, no hay que configurar
nada.

**En local**, levantando un Jaeger con Docker:

```bash
docker run --rm -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest
```

```bash
# .env.local
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
NEXT_OTEL_VERBOSE=1     # opcional: Next emite TODOS sus spans internos
```

Interfaz en <http://localhost:16686>. Un request de crear reserva se ve así:

```
POST /api/booking                                    ── 1840 ms
├── executing api route (app) /api/booking           ── 1835 ms
│   ├── db User.findUnique                           ──    4 ms
│   ├── db Room.findUnique                           ──    6 ms
│   ├── db Booking.count                             ──   12 ms
│   └── db Booking.create                            ──    9 ms
└── mercadopago createPreference                     ── 1798 ms   ← aquí está
```

Esa última línea es el valor de tener trazas: sin ellas la conclusión habría
sido "crear reservas va lento" y se habría perdido una tarde optimizando
consultas SQL que tardan 9 ms.

### Instrumentar código nuevo

```ts
import { withSpan } from "@/lib/observability/tracing";

async function generarFactura(bookingId: number) {
  return withSpan(
    "facturacion generar",
    { "booking.id": bookingId },   // atributos: baja cardinalidad, sin datos personales
    async (span) => {
      const pdf = await construirPdf(bookingId);
      span.setAttribute("factura.bytes", pdf.length);
      return pdf;
    }
  );
}
```

`withSpan` cierra el span siempre, incluso si la función lanza, y graba la
excepción para que el visor pinte el tramo en rojo.

---

## 7. Medición de la base de datos

`lib/db/prisma.ts` extiende el cliente con un interceptor que envuelve **toda**
operación —consultas de modelo, `$queryRaw` y transacciones— y de cada una saca
las tres señales:

- un **span** anidado en el request (que hace visible un N+1 de un vistazo);
- un **contador y un histograma** por modelo, operación y resultado;
- un **log**: `debug` si fue rápida, `warn` si superó `SLOW_QUERY_MS` (200 ms
  por defecto).

Una consulta lenta aparece así:

```json
{"level":"warn","msg":"consulta lenta","module":"db","model":"Booking",
 "operation":"findMany","outcome":"ok","durationMs":1840,
 "requestId":"f69b7ce2-…","traceId":"d9bfd208…"}
```

Con el `requestId` se ve qué endpoint la provocó; con el `traceId`, dónde
encaja en la línea de tiempo.

El health check usa la misma conexión con un `SELECT 1`: la consulta más barata
posible, que mide que haya conexión sin depender de que exista ninguna tabla.

---

## 8. Instrumentar un endpoint nuevo

```ts
import { NextResponse, type NextRequest } from "next/server";
import { withApiRoute } from "@/lib/http/with-api-route";
import { enrichRequestContext } from "@/lib/observability/request-context";
import { requireApiSession } from "@/modules/auth/auth.session";

export const POST = withApiRoute(
  "/api/facturas",          // el PATRÓN de la ruta, nunca la URL concreta
  async (request: NextRequest) => {
    const session = await requireApiSession("ADMIN");

    // A partir de aquí, todo log del request lleva userId.
    enrichRequestContext({ userId: session.id });

    // Sin try/catch: lo que se lance lo traduce handleRouteError,
    // que además registra y cuenta el error.
    const factura = await facturaService.crear(await request.json());

    return NextResponse.json(factura, { status: 201 });
  }
);
```

Eso solo ya da: `requestId`, métricas de latencia y estado, log del resultado con
su nivel correcto, cabeceras `x-request-id` y `Server-Timing`, y captura de
errores con respuesta segura.

---

## 9. Server-Timing

Cada respuesta de la API lleva:

```
Server-Timing: app;dur=18.4
```

Las DevTools del navegador la dibujan en la pestaña **Network**, junto al resto
de los tiempos. Es telemetría visible sin instalar ni configurar nada, y sirve
para separar de un vistazo "el servidor tardó" de "la red tardó".

---

## 10. Variables de configuración

| Variable | Por defecto | Para qué |
| --- | --- | --- |
| `LOG_LEVEL` | `debug` local / `info` servidor | Nivel mínimo que se emite |
| `LOG_FORMAT` | `pretty` local / `json` servidor | Formato de salida |
| `SLOW_QUERY_MS` | `200` | Umbral de "consulta lenta" |
| `SLOW_REQUEST_MS` | `1000` | Umbral de "request lento" |
| `METRICS_TOKEN` | — | Protege `/api/metrics` |
| `OTEL_SERVICE_NAME` | `reservas` | Nombre del servicio en las trazas |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | Backend de trazas fuera de Vercel |
| `NEXT_OTEL_VERBOSE` | — | `1` para que Next emita todos sus spans |

---

## 11. Qué vigilar en producción

Las cuatro señales doradas, aplicadas a este proyecto:

| Señal | Dónde mirarla | Cuándo preocuparse |
| --- | --- | --- |
| **Latencia** | `http_request_duration_ms` (p95) | El p95 sube y no baja |
| **Tráfico** | `http_requests_total` | Cae a cero (¿está caído?) o se dispara |
| **Errores** | `errors_total`, `"level":"error"` | Cualquier tendencia al alza |
| **Saturación** | `db_query_duration_ms`, `process_uptime_seconds` | Consultas que se degradan; reinicios frecuentes |

Y tres específicas de este dominio, que valen una alerta:

- `"msg":"el monto del pago no coincide con la cotización"` — posible fraude.
  Debería ser siempre cero.
- `external_calls_total{outcome="invalid_signature"}` — alguien probando firmas
  contra el webhook, o la clave secreta mal configurada tras un despliegue.
- `/api/health` devolviendo 503 — la base no responde.
