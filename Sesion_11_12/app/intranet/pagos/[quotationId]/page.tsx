/**
 * Ruta: "/intranet/pagos/[quotationId]" (resultado del pago)
 *
 * A esta pantalla se llega volviendo de Mercado Pago. La clave es que NO se le
 * cree a la query string: Mercado Pago agrega `?status=approved&payment_id=...`
 * al redirigir, pero eso es texto en una URL que cualquiera puede escribir a
 * mano. Antes de pintar nada se le pregunta el estado real a la API
 * (`syncByQuotation`) y recién después se lee de la base.
 *
 * También es la red de seguridad del webhook: si la notificación todavía no
 * llegó —o si en desarrollo no hay un túnel https que la reciba— igual se
 * muestra el resultado correcto.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "./page.css";
import { formatCurrency } from "@/lib/format/format-currency";
import { formatIsoDate } from "@/lib/format/format-date";
import { ApiError } from "@/lib/http/api-error";
import { requireRole } from "@/modules/auth/auth.session";
import { PAYMENT_STATUS_LABELS } from "@/modules/payments/payment.labels";
import { isQuotationId } from "@/modules/payments/payment.quotation";
import { paymentService } from "@/modules/payments/payment.service";
import type { CheckoutView } from "@/modules/payments/payment.types";
import { ROOM_TYPE_LABELS } from "@/modules/rooms/room.labels";
import { PaymentErrorDialog } from "@/app/intranet/_components/payment-error-dialog";

export const metadata: Metadata = {
  title: "Resultado del pago",
};

// Texto y color de la tarjeta según cómo terminó el cobro.
const OUTCOMES = {
  APPROVED: {
    tone: "ok",
    heading: "¡Pago confirmado!",
    text: "Tu reserva quedó pagada. Te esperamos en el hotel.",
  },
  REJECTED: {
    tone: "error",
    heading: "El pago no se completó",
    text: "Mercado Pago rechazó el cobro, así que la reserva quedó marcada como pago incorrecto. Podés reintentar con otro medio de pago.",
  },
  CANCELLED: {
    tone: "warn",
    heading: "Cancelaste el pago",
    text: "No se cobró nada. Tu reserva sigue pendiente y podés pagarla cuando quieras.",
  },
  REFUNDED: {
    tone: "warn",
    heading: "El pago fue devuelto",
    text: "Se devolvió el importe y la reserva quedó cancelada.",
  },
  PENDING: {
    tone: "warn",
    heading: "Estamos esperando el pago",
    text: "Mercado Pago todavía no confirmó la operación. Actualizá en unos minutos para ver el resultado.",
  },
  IN_PROCESS: {
    tone: "warn",
    heading: "Mercado Pago está revisando el pago",
    text: "En cuanto se resuelva vas a ver la reserva actualizada. Actualizá en unos minutos.",
  },
} as const;

export default async function PaymentResultPage({
  params,
}: PageProps<"/intranet/pagos/[quotationId]">) {
  const session = await requireRole("STUDENT");
  const { quotationId } = await params;

  if (!isQuotationId(quotationId)) notFound();

  // Primero se sincroniza con Mercado Pago, después se lee: así la página
  // muestra el estado real y no el que quedó guardado la última vez.
  await paymentService.syncByQuotation(quotationId);

  let checkout: CheckoutView;

  try {
    checkout = await paymentService.findCheckoutForUser(quotationId, session.id);
  } catch (caught) {
    if (caught instanceof ApiError && caught.statusCode === 404) notFound();
    throw caught;
  }

  const { booking, payment } = checkout;
  const outcome = OUTCOMES[payment.status];
  const canRetry =
    payment.status === "REJECTED" || payment.status === "CANCELLED";

  return (
    <section className="payment-result">
      <article className={`payment-result__card payment-result__card--${outcome.tone}`}>
        <h1 className="payment-result__heading">{outcome.heading}</h1>
        <p className="payment-result__text">{outcome.text}</p>

        <dl className="payment-result__specs">
          <div>
            <dt>Habitación</dt>
            <dd>
              {booking.roomName}
              <small>{ROOM_TYPE_LABELS[booking.roomType]}</small>
            </dd>
          </div>
          <div>
            <dt>Estadía</dt>
            <dd>
              {formatIsoDate(booking.startDate)} → {formatIsoDate(booking.endDate)}
              <small>
                {booking.nights} {booking.nights === 1 ? "noche" : "noches"} ×{" "}
                {formatCurrency(booking.pricePerNight)}
              </small>
            </dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{formatCurrency(payment.amount)}</dd>
          </div>
          <div>
            <dt>Estado del pago</dt>
            <dd>{PAYMENT_STATUS_LABELS[payment.status]}</dd>
          </div>
        </dl>

        <p className="payment-result__quotation">
          N.º de pedido: <code>{payment.quotationId}</code>
          {payment.providerPaymentId && (
            <>
              {" · "}N.º de pago: <code>{payment.providerPaymentId}</code>
            </>
          )}
        </p>

        <div className="payment-result__actions">
          {/* El detalle del rechazo va en un diálogo y no en la tarjeta: el
              mensaje principal tiene que ser corto, y el motivo técnico lo
              busca quien lo necesita. */}
          {payment.status === "REJECTED" && (
            <PaymentErrorDialog
              quotationId={payment.quotationId}
              statusDetail={payment.statusDetail}
              providerPaymentId={payment.providerPaymentId}
              label="Ver detalle del rechazo"
            />
          )}

          {canRetry && (
            <Link
              className="payment-result__retry"
              prefetch={false}
              href={`/intranet/reservas/${booking.id}/pago`}
            >
              Reintentar el pago
            </Link>
          )}

          <Link className="payment-result__link" href="/intranet/reservas">
            Ir a mis reservas
          </Link>
        </div>
      </article>
    </section>
  );
}
