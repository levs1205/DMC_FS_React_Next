import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/modules/payments/mercadopago/mercadopago.signature";
import type { WebhookNotification } from "@/modules/payments/mercadopago/mercadopago.types";
import { paymentService } from "@/modules/payments/payment.service";

/**
 * POST /api/payment/webhook
 *
 * Endpoint que escucha las notificaciones de Mercado Pago. Es el único punto
 * de toda la app que se ejecuta sin sesión —lo llama un servidor ajeno— así
 * que concentra varias defensas:
 *
 * 1. FIRMA. Se valida el header `x-signature` con HMAC-SHA256 y la clave
 *    secreta del panel. Sin eso, cualquiera podría avisar "la reserva 7 está
 *    paga" con un simple curl.
 * 2. DESCONFIANZA DEL CUERPO. De la notificación solo se usa el ID del pago;
 *    el estado se le vuelve a preguntar a la API de Mercado Pago.
 * 3. IDEMPOTENCIA. Mercado Pago reintenta ante cualquier respuesta que no sea
 *    2xx, y puede mandar la misma notificación varias veces. El servicio
 *    aplica el resultado sobre el `quotationId` y no repite efectos.
 *
 * Sobre los códigos de respuesta: 200 significa "recibido, no vuelvas a
 * mandarlo". Por eso una notificación de un tipo que no nos interesa también
 * responde 200; solo un fallo nuestro devuelve 500, que es lo que le pide a
 * Mercado Pago que reintente más tarde.
 */
export async function POST(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  let body: WebhookNotification = {};

  try {
    body = (await request.json()) as WebhookNotification;
  } catch {
    // Mercado Pago manda toda la información relevante también en la query
    // string, así que un cuerpo vacío o ilegible no es motivo para abortar.
  }

  // Según el tipo de notificación configurada, los datos llegan por la query
  // ("?type=payment&data.id=123") o dentro del cuerpo. Se aceptan las dos.
  const dataId = searchParams.get("data.id") ?? body.data?.id ?? null;
  const type = searchParams.get("type") ?? searchParams.get("topic") ?? body.type ?? null;

  const signature = verifyWebhookSignature({
    signatureHeader: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId,
  });

  if (!signature.valid) {
    console.warn("[webhook] notificación rechazada", { reason: signature.reason });

    // 401 sin detalle: a quien esté probando firmas no se le explica por qué
    // falló. El motivo queda en el log del servidor.
    return NextResponse.json({ message: "Firma inválida." }, { status: 401 });
  }

  // Mercado Pago también notifica órdenes, contracargos y otros temas. Se
  // confirman con un 200 para que deje de reintentarlos.
  if (type !== "payment" || !dataId) {
    return NextResponse.json({ received: true });
  }

  try {
    await paymentService.applyNotification(dataId);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhook] no se pudo procesar la notificación", {
      dataId,
      error,
    });

    // 500 a propósito: le pide a Mercado Pago que lo reintente más tarde.
    return NextResponse.json(
      { message: "No se pudo procesar la notificación." },
      { status: 500 }
    );
  }
}
