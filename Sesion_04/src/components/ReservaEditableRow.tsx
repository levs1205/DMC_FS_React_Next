import { useState } from "react";
import { esReprogramacionValida } from '../utils/businessLogic';
import type { Reserva } from "../utils/types";

export interface ReservaEditableRowProps {
  reserva: Reserva;
  nombreHabitacion: string;
  nombreUsuario: string;
  cancelando: boolean;
  reprogramando: boolean;
  onCancelar: () => void;
  onGuardarReprogramacion: (
    nuevaFechaInicio: string,
    nuevaFechaFin: string,
  ) => Promise<void> | void;
}

function ReservaEditableRow({
  reserva,
  nombreHabitacion,
  nombreUsuario,
  cancelando,
  reprogramando,
  onCancelar,
  onGuardarReprogramacion,
}: ReservaEditableRowProps) {
  const [editando, setEditando] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(reserva.fechaInicio);
  const [fechaFin, setFechaFin] = useState(reserva.fechaFin);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  const reservaCancelada = reserva.estado === "cancelada";

  function handleIniciarEdicion() {
    setFechaInicio(reserva.fechaInicio);
    setFechaFin(reserva.fechaFin);
    setErrorValidacion(null);
    setEditando(true);
  }

  function handleDescartar() {
    setErrorValidacion(null);
    setEditando(false);
  }

  async function handleGuardar() {
    if (!esReprogramacionValida(reserva.fechaInicio, fechaInicio, fechaFin)) {
      setErrorValidacion(
        "La nueva fecha de entrada debe ser posterior a la original, y la salida posterior a la nueva entrada.",
      );
      return;
    }

    setErrorValidacion(null);
    await onGuardarReprogramacion(fechaInicio, fechaFin);
    setEditando(false);
  }


  return (
    <>
      <tr>
        <td>{reserva.id}</td>
        <td>{nombreHabitacion}</td>
        <td>{nombreUsuario}</td>

        <td>
          {editando ? (
            <input
              type="date"
              className="admin-bookings-page__date-input"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          ) : (
            reserva.fechaInicio
          )}
        </td>

        <td>
          {editando ? (
            <input
              type="date"
              className="admin-bookings-page__date-input"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          ) : (
            reserva.fechaFin
          )}
        </td>

        <td>${reserva.precioTotal}</td>
        <td>
          <span className={`admin-bookings-page__badge is-${reserva.estado}`}>
            {reserva.estado}
          </span>
        </td>
        <td className="admin-bookings-page__acciones">
          {editando ? (
            <>
              <button
                type="button"
                className="admin-bookings-page__save"
                disabled={reprogramando}
                onClick={handleGuardar}
              >
                {reprogramando ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                className="admin-bookings-page__descartar"
                disabled={reprogramando}
                onClick={handleDescartar}
              >
                Descartar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="admin-bookings-page__edit"
                disabled={reservaCancelada || cancelando}
                onClick={handleIniciarEdicion}
              >
                Editar
              </button>
              <button
                type="button"
                className="admin-bookings-page__cancel"
                disabled={reservaCancelada || cancelando}
                onClick={onCancelar}
              >
                {cancelando ? "Cancelando..." : "Cancelar"}
              </button>
            </>
          )}
        </td>
      </tr>
      {errorValidacion && (
        <tr className="admin-bookings-page__error-row">
          <td colSpan={8}>{errorValidacion}</td>
        </tr>
      )}
    </>
  );
}

export default ReservaEditableRow;
