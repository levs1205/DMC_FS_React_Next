/**
 * Ruta: "/intranet/reservas" (listado de reservas del alumno)
 *
 * Server Component: los datos se leen del servicio directamente, sin pasar por
 * la API. Para una pantalla que solo muestra información es el camino más
 * corto —una consulta y HTML— y de paso las reservas de una persona nunca
 * viajan por un endpoint que alguien pueda llamar por su cuenta.
 *
 * La interactividad puntual (el diálogo con el motivo del rechazo) se aísla en
 * un Client Component, en vez de convertir toda la página en cliente.
 */
import type { Metadata } from "next";
import Link from "next/link";
import "./page.css";
import { formatCurrency } from "@/lib/format/format-currency";
import { formatIsoDate } from "@/lib/format/format-date";
import { requireRole } from "@/modules/auth/auth.session";
import { BOOKING_STATUS_LABELS } from "@/modules/bookings/booking.labels";
import { bookingService } from "@/modules/bookings/booking.service";
import { ROOM_TYPE_LABELS } from "@/modules/rooms/room.labels";
import { PaymentErrorDialog } from "@/app/intranet/_components/payment-error-dialog";

export const metadata: Metadata = {
  title: "Mis reservas",
};

export default async function MyBookingsPage() {
  const session = await requireRole("STUDENT");
  const bookings = await bookingService.listBookingsForUser(session.id);

  return (
    <section className="my-bookings">
      <header className="my-bookings__header">
        <div>
          <h1 className="my-bookings__title">Mis reservas</h1>
          <p className="my-bookings__subtitle">
            {bookings.length === 0
              ? "Todavía no tenés reservas."
              : `${bookings.length} reserva(s) a tu nombre.`}
          </p>
        </div>

        <Link className="my-bookings__cta" href="/intranet/reservas/nueva">
          Nueva reserva
        </Link>
      </header>

      {bookings.length === 0 ? (
        <p className="my-bookings__empty">
          Cuando reserves una habitación va a aparecer acá, lista para pagar.
        </p>
      ) : (
        <ul className="my-bookings__list">
          {bookings.map((booking) => {
            const isPayable =
              booking.status === "PENDING" ||
              booking.status === "PAYMENT_FAILED";

            return (
              <li key={booking.id}>
                <article className="booking-card">
                  <header className="booking-card__header">
                    <div>
                      <h2 className="booking-card__room">{booking.roomName}</h2>
                      <p className="booking-card__type">
                        {ROOM_TYPE_LABELS[booking.roomType]} · Reserva #
                        {booking.id}
                      </p>
                    </div>

                    <span
                      className={`booking-card__badge booking-card__badge--${booking.status.toLowerCase()}`}
                    >
                      {BOOKING_STATUS_LABELS[booking.status]}
                    </span>
                  </header>

                  <dl className="booking-card__specs">
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
                      <dt>Total</dt>
                      <dd className="booking-card__total">
                        {formatCurrency(booking.totalPrice)}
                      </dd>
                    </div>
                  </dl>

                  <footer className="booking-card__actions">
                    {isPayable && (
                      /* `prefetch={false}` a propósito: al entrar, la página
                         de pago CREA la cotización. Con el prefetch por
                         defecto bastaría con pasar el mouse por encima para
                         generarla sin que nadie haya decidido pagar. */
                      <Link
                        className="booking-card__pay"
                        prefetch={false}
                        href={`/intranet/reservas/${booking.id}/pago`}
                      >
                        {booking.status === "PAYMENT_FAILED"
                          ? "Reintentar pago"
                          : "Pagar reserva"}
                      </Link>
                    )}

                    {booking.status === "PAYMENT_FAILED" && booking.payment && (
                      <PaymentErrorDialog
                        quotationId={booking.payment.quotationId}
                        statusDetail={booking.payment.statusDetail}
                        providerPaymentId={booking.payment.providerPaymentId}
                      />
                    )}

                    {booking.status === "PAID" && booking.payment && (
                      <Link
                        className="booking-card__link"
                        prefetch={false}
                        href={`/intranet/pagos/${booking.payment.quotationId}`}
                      >
                        Ver detalle del pago
                      </Link>
                    )}
                  </footer>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
