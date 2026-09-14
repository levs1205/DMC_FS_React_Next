/**
 * Ruta: "/backoffice"
 * Client Component: lista las reservas de GET /api/booking y permite cancelar
 * una con PATCH /api/booking/[id], confirmando antes en un <dialog> modal.
 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import "./page.css";
import { apiFetch } from "@/lib/http/api-client";
import { formatCurrency } from "@/lib/format/format-currency";
import { formatIsoDate } from "@/lib/format/format-date";
import { BOOKING_STATUS_LABELS } from "@/modules/bookings/booking.labels";
import { ROOM_TYPE_LABELS } from "@/modules/rooms/room.labels";
import type { BookingListItem } from "@/modules/bookings/booking.types";

function Backoffice() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bookingToCancel, setBookingToCancel] =
    useState<BookingListItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let isActive = true;

    async function loadBookings() {
      try {
        const response = await apiFetch("/api/booking");
        const data = await response.json();

        if (!isActive) return;

        // 401 = ni el access token ni el refresh siguen vivos: sesión terminada.
        if (response.status === 401) {
          router.push("/login");
          return;
        }

        if (!response.ok) {
          setError(data.message ?? "No se pudieron cargar las reservas.");
          return;
        }

        setBookings(data);
      } catch {
        if (isActive) setError("No se pudo conectar con el servidor.");
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    loadBookings();

    return () => {
      isActive = false;
    };
  }, [router]);

  // <dialog> se abre/cierra de forma imperativa: showModal() es lo que activa
  // el backdrop nativo, el foco atrapado y el cierre con la tecla Escape.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (bookingToCancel && !dialog.open) {
      dialog.showModal();
    } else if (!bookingToCancel && dialog.open) {
      dialog.close();
    }
  }, [bookingToCancel]);

  const closeDialog = useCallback(() => {
    if (isCancelling) return;
    setBookingToCancel(null);
  }, [isCancelling]);

  async function handleConfirmCancel() {
    if (!bookingToCancel) return;

    setIsCancelling(true);
    setError(null);
    setNotice(null);

    try {
      const response = await apiFetch(`/api/booking/${bookingToCancel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });

      const data = await response.json();

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        setError(data.message ?? "No se pudo cancelar la reserva.");
        return;
      }

      const updated = data as BookingListItem;
      setBookings((current) =>
        current.map((booking) =>
          booking.id === updated.id ? updated : booking
        )
      );
      setNotice(`La reserva #${updated.id} quedó cancelada.`);
      setBookingToCancel(null);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <section className="backoffice">
      <header className="backoffice__header">
        <h1 className="backoffice__title">Reservas</h1>
        <p className="backoffice__subtitle">
          {isLoading
            ? "Cargando reservas..."
            : `${bookings.length} reserva(s) registradas`}
        </p>
      </header>

      {error && (
        <p className="backoffice__status backoffice__status--error">{error}</p>
      )}

      {notice && (
        <p className="backoffice__status backoffice__status--ok">{notice}</p>
      )}

      {!isLoading && bookings.length === 0 && !error && (
        <p className="backoffice__status">Todavía no hay reservas cargadas.</p>
      )}

      {bookings.length > 0 && (
        <div className="backoffice__table-wrapper">
          <table className="backoffice__table">
            <thead>
              <tr>
                <th>#</th>
                <th>Habitación</th>
                <th>Huésped</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Estado</th>
                <th className="backoffice__cell--right">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td>{booking.id}</td>
                  <td>
                    <span className="backoffice__room">{booking.roomName}</span>
                    <span className="backoffice__room-type">
                      {ROOM_TYPE_LABELS[booking.roomType]}
                    </span>
                  </td>
                  <td>{booking.userName ?? "—"}</td>
                  <td>{formatIsoDate(booking.startDate)}</td>
                  <td>{formatIsoDate(booking.endDate)}</td>
                  <td>
                    <span
                      className={`backoffice__badge backoffice__badge--${booking.status.toLowerCase()}`}
                    >
                      {BOOKING_STATUS_LABELS[booking.status]}
                    </span>
                  </td>
                  <td className="backoffice__cell--right">
                    {formatCurrency(booking.totalPrice)}
                  </td>
                  <td className="backoffice__cell--right">
                    <button
                      type="button"
                      className="backoffice__cancel"
                      disabled={booking.status === "CANCELLED"}
                      onClick={() => setBookingToCancel(booking)}
                    >
                      Cancelar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="backoffice-dialog"
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
      >
        <h2 className="backoffice-dialog__title">¿Cancelar la reserva?</h2>

        {bookingToCancel && (
          <p className="backoffice-dialog__text">
            Se cancelará la reserva <strong>#{bookingToCancel.id}</strong> de{" "}
            <strong>{bookingToCancel.roomName}</strong> a nombre de{" "}
            <strong>{bookingToCancel.userName ?? "—"}</strong> (
            {formatIsoDate(bookingToCancel.startDate)} al{" "}
            {formatIsoDate(bookingToCancel.endDate)}). Esta acción no se puede
            deshacer.
          </p>
        )}

        <div className="backoffice-dialog__actions">
          <button
            type="button"
            className="backoffice-dialog__button"
            onClick={closeDialog}
            disabled={isCancelling}
          >
            No, volver
          </button>
          <button
            type="button"
            className="backoffice-dialog__button backoffice-dialog__button--danger"
            onClick={handleConfirmCancel}
            disabled={isCancelling}
          >
            {isCancelling ? "Cancelando..." : "Sí, cancelar"}
          </button>
        </div>
      </dialog>
    </section>
  );
}

export default Backoffice;
