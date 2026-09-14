/**
 * Ruta: "/intranet/reservas/[id]/pago"
 *
 * Server Component. Al entrar acá ya existe el `quotationId`: `ensureQuotation`
 * crea (o reutiliza) la cotización, así que el alumno ve su número de pedido
 * antes de tocar nada. Ese mismo UUID es el que después viaja a Mercado Pago
 * como clave de idempotencia y como `external_reference`.
 *
 * El botón de pagar es un <form> con una Server Action: el access token del
 * proveedor no baja nunca al navegador, funciona sin JavaScript y Next valida
 * el Origin por su cuenta (protección CSRF incluida).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import "./page.css";
import { formatCurrency } from "@/lib/format/format-currency";
import { formatIsoDate } from "@/lib/format/format-date";
import { ApiError } from "@/lib/http/api-error";
import { requireRole } from "@/modules/auth/auth.session";
import { startCheckoutAction } from "@/modules/payments/payment.actions";
import { paymentService } from "@/modules/payments/payment.service";
import type { CheckoutView } from "@/modules/payments/payment.types";
import { ROOM_TYPE_LABELS } from "@/modules/rooms/room.labels";
import { SubmitButton } from "@/app/intranet/_components/submit-button";

export const metadata: Metadata = {
  title: "Pagar reserva",
};

export default async function PayBookingPage({
  params,
  searchParams,
}: PageProps<"/intranet/reservas/[id]/pago">) {
  const session = await requireRole("STUDENT");
  const { id } = await params;
  const { error } = await searchParams;

  // `searchParams` entrega string | string[]: se normaliza antes de pintarlo.
  const errorMessage = Array.isArray(error) ? error[0] : error;

  let checkout: CheckoutView;

  try {
    checkout = await paymentService.ensureQuotation(id, session.id);
  } catch (caught) {
    // Una reserva ajena o inexistente responde 404 (no se confirma que exista).
    if (caught instanceof ApiError && caught.statusCode === 404) notFound();

    // Ya pagada o cancelada: no hay nada que cobrar, se vuelve al listado.
    if (caught instanceof ApiError && caught.statusCode === 409) {
      redirect("/intranet/reservas");
    }

    throw caught;
  }

  const { booking, payment } = checkout;

  return (
    <section className="pay-booking">
      <header className="pay-booking__header">
        <h1 className="pay-booking__title">Pagar tu reserva</h1>
        <p className="pay-booking__subtitle">
          Revisá el detalle y confirmá. Vas a completar el pago en el sitio
          seguro de Mercado Pago y volvés acá con el resultado.
        </p>
      </header>

      <article className="pay-booking__summary">
        <header className="pay-booking__room">
          <h2>{booking.roomName}</h2>
          <p>{ROOM_TYPE_LABELS[booking.roomType]}</p>
        </header>

        <dl className="pay-booking__specs">
          <div>
            <dt>Check-in</dt>
            <dd>{formatIsoDate(booking.startDate)}</dd>
          </div>
          <div>
            <dt>Check-out</dt>
            <dd>{formatIsoDate(booking.endDate)}</dd>
          </div>
          <div>
            <dt>Noches</dt>
            <dd>{booking.nights}</dd>
          </div>
          <div>
            <dt>Precio por noche</dt>
            <dd>{formatCurrency(booking.pricePerNight)}</dd>
          </div>
        </dl>

        <p className="pay-booking__calc">
          {formatCurrency(booking.pricePerNight)} × {booking.nights}{" "}
          {booking.nights === 1 ? "noche" : "noches"}
        </p>

        <p className="pay-booking__total">
          <span>Total a pagar</span>
          <strong>{formatCurrency(booking.totalPrice)}</strong>
        </p>

        {/* El número de pedido a la vista: es el dato que hay que dar si algo
            sale mal, y el que Mercado Pago guarda como external_reference. */}
        <p className="pay-booking__quotation">
          N.º de pedido: <code>{payment.quotationId}</code>
        </p>
      </article>

      {errorMessage && (
        <p className="pay-booking__status pay-booking__status--error">
          {errorMessage}
        </p>
      )}

      <form action={startCheckoutAction.bind(null, id)}>
        <SubmitButton
          className="pay-booking__submit"
          pendingLabel="Conectando con Mercado Pago..."
        >
          Pagar con Mercado Pago
        </SubmitButton>
      </form>

      <Link className="pay-booking__back" href="/intranet/reservas">
        Volver a mis reservas
      </Link>
    </section>
  );
}
