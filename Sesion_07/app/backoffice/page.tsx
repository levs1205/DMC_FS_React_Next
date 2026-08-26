"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import "./page.css";
import type { BookingListItem } from "@/modules/booking/booking.types";
import {
  BOOKING_STATUS_LABELS,
  ROOM_TYPE_LABELS,
} from "@/modules/booking/booking.labels";

function BakcofficePage() {
  const [bookings, setBookings] = useState<BookingListItem[]>([]);

  useEffect(
    () => {
        async function loadBookings() {
            try {
                const response = await fetch("/api/booking");
                const data = await response.json();

                if(!response.ok){
                    throw new Error(data.message || "Error al cargar las reservas");
                }

                setBookings(data);
                
            } catch (error) {
                
            }
        }

        loadBookings();
    }, []
  );

  return (
    <section className="backoffice">
      <header className="backoffice__header">
        <h1 className="backoffice__title">Reservas</h1>
      </header>
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
                  <td>{booking.startDate}</td>
                  <td>{booking.endDate}</td>
                  <td>
                    <span
                      className={`backoffice__badge backoffice__badge--${booking.status.toLowerCase()}`}
                    >
                      {BOOKING_STATUS_LABELS[booking.status]}
                    </span>
                  </td>
                  <td className="backoffice__cell--right">
                    {booking.totalPrice}
                  </td>
                  <td className="backoffice__cell--right">
                    <button
                      type="button"
                      className="backoffice__cancel"
                      disabled={booking.status === "CANCELLED"}
                    >
                      Cancelar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
        </table>
      </div>
    </section>
  );
}

export default BakcofficePage;