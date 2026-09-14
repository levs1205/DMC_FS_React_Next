import "server-only";

import { ApiError } from "@/lib/http/api-error";
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

interface RequestOptions {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  /**
   * Clave de idempotencia. Mercado Pago guarda la respuesta de la primera
   * llamada con esta clave y la repite en las siguientes: dos clics en
   * "Pagar" (o un reintento por timeout de red) no generan dos preferencias.
   */
  idempotencyKey?: string;
}

async function request<T>({
  method,
  path,
  body,
  idempotencyKey,
}: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getAccessToken()}`,
    Accept: "application/json",
  };

  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;

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
    console.error("[mercadopago] fallo de red", { path, error });
    throw new ApiError(
      502,
      "No se pudo contactar con Mercado Pago. Intenta nuevamente en unos segundos."
    );
  }

  const payload = await response.text();

  if (!response.ok) {
    // El detalle crudo va al log del servidor (puede traer datos internos);
    // al usuario le llega un mensaje generico.
    console.error("[mercadopago] respuesta con error", {
      path,
      status: response.status,
      payload,
    });

    throw new ApiError(
      response.status === 404 ? 404 : 502,
      "Mercado Pago rechazo la operacion. Revisa la configuracion e intenta nuevamente."
    );
  }

  return JSON.parse(payload) as T;
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
      body: preference,
      idempotencyKey,
    });
  },

  /** GET /v1/payments/{id} → estado real de un pago puntual. */
  async getPayment(paymentId: string): Promise<MercadoPagoPayment> {
    return request<MercadoPagoPayment>({
      method: "GET",
      path: `/v1/payments/${encodeURIComponent(paymentId)}`,
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
    });

    return results[0] ?? null;
  },
};
