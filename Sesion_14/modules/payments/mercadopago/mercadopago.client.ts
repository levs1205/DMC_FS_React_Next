import "server-only";

import { ApiError } from "@/lib/http/api-error";
import { logger } from "@/lib/observability/logger";
import { metrics } from "@/lib/observability/metrics";
import { startTimer, withSpan } from "@/lib/observability/tracing";
import {
  MERCADOPAGO_API_URL,
  getAccessToken,
} from "@/modules/payments/mercadopago/mercadopago.config";
import type {
  MercadoPagoPayment,
  PaymentSearchResponse,
  PreferenceRequest,
  PreferenceResponse,
} from "@/modules/payments/mercadopago/mercadopago.types";

/**
 * Cliente HTTP de Mercado Pago.
 *
 * Se usa `fetch` directo contra la API REST en vez del SDK oficial: son tres
 * endpoints, el contrato queda a la vista (que se manda, que headers viajan,
 * que vuelve) y no se agrega una dependencia mas para mantener. Con fines
 * educativos eso vale mas que el azucar sintactico del SDK.
 *
 * Todo pasa por `request()` para que la autenticacion, el timeout y el
 * manejo de errores esten en UN solo lugar.
 */

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Fecha en el formato ISO 8601 que espera Mercado Pago para las expiraciones:
 * "2026-09-09T18:30:00.000+00:00".
 *
 * `toISOString()` devuelve el mismo instante terminado en "Z" y, aunque es ISO
 * válido, la API es quisquillosa con ese sufijo. Se escribe el desplazamiento
 * explícito para no depender de eso.
 */
export function toMercadoPagoDate(date: Date): string {
  return `${date.toISOString().replace("Z", "")}+00:00`;
}

const mpLogger = logger.child({ provider: "mercadopago" });

interface RequestOptions {
  method: "GET" | "POST";
  path: string;
  /**
   * Nombre estable de la operación, para las métricas y el span.
   *
   * Va aparte del `path` a propósito: el path lleva ids
   * (`/v1/payments/1234567`) y usarlo como etiqueta crearía una serie temporal
   * por cada pago. `getPayment` es una etiqueta; `/v1/payments/1234567` es una
   * fuga de cardinalidad.
   */
  operation: string;
  body?: unknown;
  /**
   * Clave de idempotencia. Mercado Pago guarda la respuesta de la primera
   * llamada con esta clave y la repite en las siguientes: dos clics en
   * "Pagar" (o un reintento por timeout de red) no generan dos preferencias.
   */
  idempotencyKey?: string;
}

/**
 * Toda llamada sale medida y con su propio span.
 *
 * Es la instrumentación que más rinde de todo el proyecto: cuando el flujo de
 * pago va lento, la pregunta es casi siempre "¿somos nosotros o es el
 * proveedor?", y aquí se responde sin discusión. Un histograma de
 * `external_call_duration_ms{provider="mercadopago"}` separa un problema propio
 * de una caída ajena, que son dos incidentes con dueños distintos.
 */
async function request<T>({
  method,
  path,
  operation,
  body,
  idempotencyKey,
}: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getAccessToken()}`,
    Accept: "application/json",
  };

  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;

  return withSpan(
    `mercadopago ${operation}`,
    {
      "http.request.method": method,
      "peer.service": "mercadopago",
      "mercadopago.operation": operation,
    },
    async (span) => {
      const elapsed = startTimer();

      const record = (outcome: string, extra?: Record<string, unknown>) => {
        const durationMs = elapsed();

        span.setAttribute("http.duration_ms", Math.round(durationMs));

        metrics.externalCallsTotal.inc({
          provider: "mercadopago",
          operation,
          outcome,
        });
        metrics.externalCallDurationMs.observe(durationMs, {
          provider: "mercadopago",
          operation,
        });

        return { operation, outcome, durationMs: Math.round(durationMs), ...extra };
      };

      let response: Response;

      try {
        response = await fetch(`${MERCADOPAGO_API_URL}${path}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          // Nunca cachear: son datos de dinero y ademas la llamada lleva el
          // access token en los headers.
          cache: "no-store",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        // Se distingue el timeout del resto: son dos problemas distintos. Un
        // timeout suele ser lentitud del proveedor y se reintenta; un fallo de
        // red seco puede ser DNS, TLS o salida bloqueada.
        const timedOut = error instanceof Error && error.name === "TimeoutError";

        mpLogger.error("fallo de red contra Mercado Pago", {
          ...record(timedOut ? "timeout" : "network_error"),
          err: error instanceof Error ? error : new Error(String(error)),
        });

        throw new ApiError(
          502,
          "No se pudo contactar con Mercado Pago. Intenta nuevamente en unos segundos."
        );
      }

      const payload = await response.text();

      span.setAttribute("http.response.status_code", response.status);

      if (!response.ok) {
        // El detalle crudo va al log del servidor (puede traer datos internos);
        // al usuario le llega un mensaje generico.
        mpLogger.error("Mercado Pago respondió con error", {
          ...record("http_error", { status: response.status }),
          // Se recorta: un cuerpo de error puede venir con cientos de líneas y
          // los logs se cobran por volumen.
          payload: payload.slice(0, 500),
        });

        throw new ApiError(
          response.status === 404 ? 404 : 502,
          "Mercado Pago rechazo la operacion. Revisa la configuracion e intenta nuevamente."
        );
      }

      mpLogger.info("llamada a Mercado Pago", record("ok", { status: response.status }));

      return JSON.parse(payload) as T;
    }
  );
}

export const mercadoPagoClient = {
  /** POST /checkout/preferences → crea el "pedido" y devuelve su init_point. */
  async createPreference(
    preference: PreferenceRequest,
    idempotencyKey: string
  ): Promise<PreferenceResponse> {
    return request<PreferenceResponse>({
      method: "POST",
      path: "/checkout/preferences",
      operation: "createPreference",
      body: preference,
      idempotencyKey,
    });
  },

  /** GET /v1/payments/{id} → estado real de un pago puntual. */
  async getPayment(paymentId: string): Promise<MercadoPagoPayment> {
    return request<MercadoPagoPayment>({
      method: "GET",
      path: `/v1/payments/${encodeURIComponent(paymentId)}`,
      operation: "getPayment",
    });
  },

  /**
   * GET /v1/payments/search?external_reference=... → ultimo pago asociado a
   * una cotizacion. Es el plan B de la pagina de resultado cuando el webhook
   * todavia no llego (o cuando en desarrollo no hay tunel https que lo
   * reciba): en vez de mostrarle "pendiente" al usuario, se le pregunta a
   * Mercado Pago.
   */
  async findLastPaymentByQuotation(
    quotationId: string
  ): Promise<MercadoPagoPayment | null> {
    const query = new URLSearchParams({
      external_reference: quotationId,
      sort: "date_created",
      criteria: "desc",
      limit: "1",
    });

    const { results } = await request<PaymentSearchResponse>({
      method: "GET",
      path: `/v1/payments/search?${query}`,
      operation: "searchPayments",
    });

    return results[0] ?? null;
  },
};
