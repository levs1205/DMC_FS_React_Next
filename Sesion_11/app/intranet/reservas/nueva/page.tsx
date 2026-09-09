/**
 * Ruta: "/intranet/reservas/nueva"
 *
 * Client Component: acá sí hace falta interactividad real. Al elegir el rango
 * de fechas se consulta la disponibilidad y la lista de habitaciones se
 * actualiza sola, sin recargar la página.
 *
 * Todo lo que se muestra (disponibilidad, noches, total) lo calcula el
 * servidor en GET /api/room/availability. El navegador solo pinta: si el total
 * se calculara acá, cualquiera podría cambiarlo desde la consola.
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type SubmitEvent } from "react";
import "./page.css";
import { formatCurrency } from "@/lib/format/format-currency";
import { apiFetch } from "@/lib/http/api-client";
import { addDays, todayIsoDate } from "@/modules/bookings/booking.dates";
import type { BookingWithPayment } from "@/modules/bookings/booking.types";
import { ROOM_TYPE_LABELS } from "@/modules/rooms/room.labels";
import type { RoomAvailabilityItem } from "@/modules/rooms/room.types";

const TODAY = todayIsoDate();

/**
 * Resultado de consultar la disponibilidad. Se modela como un valor y no como
 * una serie de `setState`: así la función es una llamada HTTP pura, se puede
 * probar sola y el componente decide qué hacer con la respuesta.
 */
type AvailabilityResult =
  | { ok: true; rooms: RoomAvailabilityItem[] }
  | { ok: false; unauthorized: boolean; message: string };

async function fetchAvailability(
  startDate: string,
  endDate: string,
  signal: AbortSignal
): Promise<AvailabilityResult | null> {
  const query = new URLSearchParams({ startDate, endDate });

  try {
    const response = await apiFetch(`/api/room/availability?${query}`, { signal });
    const data = await response.json();

    if (response.status === 401) {
      return { ok: false, unauthorized: true, message: "" };
    }

    if (!response.ok) {
      return {
        ok: false,
        unauthorized: false,
        message: data.message ?? "No se pudo consultar la disponibilidad.",
      };
    }

    return { ok: true, rooms: data as RoomAvailabilityItem[] };
  } catch (error) {
    // Cancelar la consulta anterior al cambiar de fecha no es un error:
    // devolver null le dice al componente que no toque nada.
    if (signal.aborted || (error as Error)?.name === "AbortError") return null;

    return {
      ok: false,
      unauthorized: false,
      message: "No se pudo conectar con el servidor.",
    };
  }
}

function NewBookingPage() {
  const router = useRouter();
  const [startDate, setStartDate] = useState(TODAY);
  const [endDate, setEndDate] = useState(addDays(TODAY, 1));
  const [rooms, setRooms] = useState<RoomAvailabilityItem[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  // Arranca en true porque el primer efecto ya sale a consultar disponibilidad.
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Cada cambio de fecha dispara una consulta y CANCELA la anterior con
   * `AbortController`. Sin eso, dos respuestas pueden llegar desordenadas y
   * dejar en pantalla la disponibilidad de un rango que ya no es el elegido.
   *
   * El efecto solo arranca la petición: el estado se actualiza dentro del
   * callback, cuando la respuesta llega. El "cargando" lo enciende el handler
   * que cambia la fecha, que es quien de verdad inicia la consulta.
   */
  useEffect(() => {
    const controller = new AbortController();

    fetchAvailability(startDate, endDate, controller.signal).then((result) => {
      if (!result || controller.signal.aborted) return;

      if (!result.ok) {
        if (result.unauthorized) {
          router.push("/login");
          return;
        }

        setRooms([]);
        setError(result.message);
        setIsLoading(false);
        return;
      }

      setRooms(result.rooms);
      setError(null);
      setIsLoading(false);
    });

    return () => controller.abort();
  }, [startDate, endDate, router]);

  /**
   * La habitación elegida se deriva de la lista en cada render en vez de
   * sincronizarse con un efecto: si al cambiar las fechas deja de estar libre,
   * `selectedRoom` pasa a null solo y el botón se deshabilita.
   */
  const selectedRoom =
    rooms.find((room) => room.id === selectedRoomId && room.available) ?? null;

  function handleStartDateChange(value: string) {
    setIsLoading(true);
    setStartDate(value);

    // El check-out siempre tiene que quedar después del check-in.
    if (value >= endDate) setEndDate(addDays(value, 1));
  }

  function handleEndDateChange(value: string) {
    setIsLoading(true);
    setEndDate(value);
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRoom) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: selectedRoom.id, startDate, endDate }),
      });

      const data = await response.json();

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        setError(data.message ?? "No se pudo crear la reserva.");
        return;
      }

      // La reserva nace PENDIENTE: el paso siguiente es pagarla.
      const booking = data as BookingWithPayment;
      router.push(`/intranet/reservas/${booking.id}/pago`);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const availableCount = rooms.filter((room) => room.available).length;

  return (
    <section className="new-booking">
      <header className="new-booking__header">
        <h1 className="new-booking__title">Nueva reserva</h1>
        <p className="new-booking__subtitle">
          Elegí las fechas y la habitación. La reserva queda pendiente hasta que
          completes el pago.
        </p>
      </header>

      <form className="new-booking__form" onSubmit={handleSubmit}>
        <fieldset className="new-booking__dates">
          <legend className="new-booking__legend">Fechas de la estadía</legend>

          <label className="new-booking__field">
            Entrada
            <input
              type="date"
              value={startDate}
              min={TODAY}
              required
              onChange={(event) => handleStartDateChange(event.target.value)}
            />
          </label>

          <label className="new-booking__field">
            Salida
            <input
              type="date"
              value={endDate}
              min={addDays(startDate, 1)}
              required
              onChange={(event) => handleEndDateChange(event.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className="new-booking__rooms">
          <legend className="new-booking__legend">
            Habitaciones{" "}
            <span className="new-booking__hint">
              {isLoading
                ? "Consultando disponibilidad..."
                : `${availableCount} libre(s) en esas fechas`}
            </span>
          </legend>

          <ul className="new-booking__list">
            {rooms.map((room) => (
              <li key={room.id}>
                <label
                  className={`room-option${room.available ? "" : " room-option--busy"}`}
                >
                  <input
                    type="radio"
                    name="roomId"
                    value={room.id}
                    checked={selectedRoom?.id === room.id}
                    disabled={!room.available}
                    onChange={() => setSelectedRoomId(room.id)}
                  />

                  <span className="room-option__body">
                    <span className="room-option__name">{room.name}</span>
                    <span className="room-option__meta">
                      {ROOM_TYPE_LABELS[room.type]} · hasta {room.capacity}{" "}
                      {room.capacity === 1 ? "huésped" : "huéspedes"} ·{" "}
                      {formatCurrency(room.pricePerNight)} por noche
                    </span>
                  </span>

                  <span className="room-option__total">
                    {room.available ? (
                      <>
                        {formatCurrency(room.totalPrice)}
                        <small>
                          {room.nights} {room.nights === 1 ? "noche" : "noches"}
                        </small>
                      </>
                    ) : (
                      <em>Ocupada</em>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        {error && (
          <p className="new-booking__status new-booking__status--error">
            {error}
          </p>
        )}

        <div className="new-booking__actions">
          <Link className="new-booking__back" href="/intranet/reservas">
            Volver a mis reservas
          </Link>

          <button
            type="submit"
            className="new-booking__submit"
            disabled={!selectedRoom || isSubmitting || isLoading}
          >
            {isSubmitting ? "Creando reserva..." : "Reservar y continuar"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default NewBookingPage;
