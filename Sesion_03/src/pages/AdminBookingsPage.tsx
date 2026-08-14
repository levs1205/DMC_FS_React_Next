import { useState } from "react";
import { useReservas } from "../hooks/useReservas";
import type { Reserva } from "../utils/types";
import "./AdminBookingsPage.css";
import { ConfirmDialog } from "../components/ConfirmDialog";

export function AdminBookingsPage() {
  const { reservas, cargando, error, cancelandoId, cancelar } = useReservas();
  const [reservaACancelar, setReservaACancelar] = useState<Reserva | null>(
    null,
  );

  async function handleConfirmarCancelacion() {
    if (!reservaACancelar) return;
    await cancelar(reservaACancelar.id);
    setReservaACancelar(null);
  }

  return (
    <section className="admin-bookings-page">
      <header className="admin-bookings-page__header">
        <div>
          <h1>Listado de reservas</h1>
          <p>
            Todas las reservas creadas por los huéspedes, con opción de
            cancelarlas.
          </p>
        </div>
        <div className="admin-bookings-page__user">
          <span>Lincoln</span>
          <button type="button" className="admin-bookings-page__logout">
            Cerrar sesión
          </button>
        </div>
      </header>

      {reservas.length > 0 && (
        <table className="admin-bookings-page__table">
          <thead>
            <tr>
              <th>Reserva</th>
              <th>Habitación</th>
              <th>Huésped</th>
              <th>Entrada</th>
              <th>Salida</th>
              <th>Total</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {reservas.map((reserva) => (
              // key={reserva.id}: identifica la fila por su id real, no por su
              // posición en el arreglo. Es lo que le permite a React actualizar
              // solo esta fila al cancelar, sin perder el estado de las demás.
              <tr key={reserva.id}>
                <td>{reserva.id}</td>
                <td>{reserva.habitacionId}</td>
                <td>{reserva.usuarioId}</td>
                <td>{reserva.fechaInicio}</td>
                <td>{reserva.fechaFin}</td>
                <td>${reserva.precioTotal}</td>
                <td>
                  <span
                    className={`admin-bookings-page__badge is-${reserva.estado}`}
                  >
                    {reserva.estado}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="admin-bookings-page__cancel"
                    disabled={
                      reserva.estado === "cancelada" ||
                      cancelandoId === reserva.id
                    }
                    onClick={() => setReservaACancelar(reserva)}
                  >
                    {cancelandoId === reserva.id ? "Cancelando..." : "Cancelar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        abierto={reservaACancelar !== null}
        titulo="Cancelar reserva"
        mensaje={
          reservaACancelar
            ? `¿Seguro que deseas cancelar la reserva ${reservaACancelar.id}? Esta acción no se puede deshacer.`
            : ""
        }
        textoConfirmar="Sí, porfavor"
        textoCancelar="No, gracias"
        onConfirmar={handleConfirmarCancelacion}
        onCancelar={() => setReservaACancelar(null)}
      />
    </section>
  );
}
