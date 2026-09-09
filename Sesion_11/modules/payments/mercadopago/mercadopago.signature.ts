import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getWebhookSecrets } from "@/modules/payments/mercadopago/mercadopago.config";

/**
 * Validación de la firma de los webhooks de Mercado Pago.
 *
 * El endpoint del webhook es público —tiene que serlo, lo llama un servidor
 * ajeno— así que sin esta verificación cualquiera podría hacer un POST
 * diciendo "el pago 123 fue aprobado" y llevarse una reserva gratis. La firma
 * es lo único que prueba que la notificación la mandó Mercado Pago.
 *
 * Mercado Pago manda dos headers:
 *
 *   x-signature:  ts=1742505638683,v1=618c85345248dd820d5fd45611...
 *   x-request-id: bb56a2f1-6aae-46ac-982e-9dcd3581d08e
 *
 * Con ellos se arma el "manifest" en un formato exacto:
 *
 *   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 *
 * y se calcula su HMAC-SHA256 con la clave secreta que da el panel al
 * configurar la URL de notificaciones. Si el hash coincide con `v1`, la
 * notificación es auténtica.
 *
 * Nota: no se controla la antigüedad del `ts`. Repetir una notificación vieja
 * no sirve de nada en esta integración, porque el handler no le cree al cuerpo
 * del webhook: vuelve a consultarle el pago a la API de Mercado Pago y aplica
 * el resultado de forma idempotente (ver `payment.service`).
 */

export type SignatureResult =
  | { valid: true }
  | { valid: false; reason: string };

// "ts=123,v1=abc" → { ts: "123", v1: "abc" }
function parseSignatureHeader(header: string): Map<string, string> {
  const parts = new Map<string, string>();

  for (const chunk of header.split(",")) {
    const separator = chunk.indexOf("=");
    if (separator === -1) continue;

    parts.set(
      chunk.slice(0, separator).trim(),
      chunk.slice(separator + 1).trim()
    );
  }

  return parts;
}

// Comparación en tiempo constante: un `===` filtra, por lo que tarda, cuántos
// caracteres del hash acertó quien lo intenta.
function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  if (left.length !== right.length) return false;

  return timingSafeEqual(left, right);
}

export function verifyWebhookSignature({
  signatureHeader,
  requestId,
  dataId,
}: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
}): SignatureResult {
  const secrets = getWebhookSecrets();

  // Sin secreto configurado se rechaza TODO. Es la opción segura: aceptar
  // notificaciones sin firmar convertiría el endpoint en un "confirmá reservas
  // gratis" para cualquiera que conozca la URL.
  if (secrets.length === 0) {
    return {
      valid: false,
      reason: "Falta configurar la variable de entorno MP_WEBHOOK_SECRET.",
    };
  }

  if (!signatureHeader) {
    return {
      valid: false,
      reason: "La notificación no trae el header x-signature.",
    };
  }

  const parts = parseSignatureHeader(signatureHeader);
  const ts = parts.get("ts");
  const hash = parts.get("v1");

  if (!ts || !hash) {
    return {
      valid: false,
      reason: "El header x-signature no tiene el formato esperado.",
    };
  }

  // El manifest omite los segmentos cuyo valor no vino, y el id alfanumérico
  // va en minúsculas: ambas cosas las exige la documentación, y cualquier
  // desvío produce un hash distinto.
  const manifest = [
    dataId ? `id:${dataId.toLowerCase()};` : "",
    requestId ? `request-id:${requestId};` : "",
    `ts:${ts};`,
  ].join("");

  // Alcanza con que UNA de las claves configuradas produzca el mismo hash.
  const matches = secrets.some((secret) =>
    safeEquals(createHmac("sha256", secret).update(manifest).digest("hex"), hash)
  );

  return matches
    ? { valid: true }
    : { valid: false, reason: "La firma de la notificación no coincide." };
}
