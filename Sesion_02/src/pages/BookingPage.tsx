// ============================================================================
// BookingPage — vista principal del flujo de disponibilidad y reservas
// ============================================================================
// Une el hook de estado (hooks/useAvailability), la lógica de negocio
// (utils/businessLogic) y el componente presentacional
// (components/AvailabilityPreview) en un único flujo simple:
//
//   1. Elegir una habitación del catálogo.
//   2. Elegir un rango de fechas.
//   3. Ver la vista previa de disponibilidad y precio.
//   4. Confirmar la reserva (simulada).

import { useMemo, useState } from 'react';
import { AvailabilityPreview } from '../components/AvailabilityPreview';
import { useAvailability } from '../hooks/useAvailability';
import {
  calcularNochesEstadia,
  calcularPrecioTotal,
  esRangoDeFechasValido,
  verificarDisponibilidadEnRango,
} from '../utils/businessLogic';
import type { Reserva, Usuario } from '../utils/types';
import './BookingPage.css';

// Usuario "logueado" simulado para esta clase (todavía sin autenticación real).
const usuarioActual: Usuario = {
  id: 'user-01',
  nombre: 'Estudiante Invitado',
  email: 'estudiante@dmc.pe',
};

export function BookingPage() {
  const {
    habitaciones,
    disponibilidad,
    imagenes,
    cargando,
    error,
    errorImagenes,
    cargarDisponibilidad,
    cargarImagenes,
  } = useAvailability();

  const [habitacionId, setHabitacionId] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [reservaConfirmada, setReservaConfirmada] = useState<Reserva | null>(null);

  const habitacionSeleccionada = habitaciones.find((h) => h.id === habitacionId);
  const fechasValidas = useMemo(
    () => Boolean(fechaInicio && fechaFin && esRangoDeFechasValido(fechaInicio, fechaFin)),
    [fechaInicio, fechaFin],
  );

  const noches = fechasValidas ? calcularNochesEstadia(fechaInicio, fechaFin) : 0;
  const precioTotal = habitacionSeleccionada
    ? calcularPrecioTotal(habitacionSeleccionada.precioPorNoche, noches)
    : 0;
  const disponible = fechasValidas
    ? verificarDisponibilidadEnRango(disponibilidad, fechaInicio, fechaFin)
    : false;

  function handleSeleccionarHabitacion(id: string) {
    setHabitacionId(id);
    setReservaConfirmada(null);
    if (id) {
      cargarDisponibilidad(id);
      cargarImagenes(id);
    }
  }

  function handleCambiarFechas(nuevaFechaInicio: string, nuevaFechaFin: string) {
    setFechaInicio(nuevaFechaInicio);
    setFechaFin(nuevaFechaFin);
    setReservaConfirmada(null);
  }

  function handleReservar() {
    if (!habitacionSeleccionada || !disponible) return;

    const nuevaReserva: Reserva = {
      id: `res-${Date.now()}`,
      habitacionId: habitacionSeleccionada.id,
      usuarioId: usuarioActual.id,
      fechaInicio,
      fechaFin,
      estado: 'confirmada',
      precioTotal,
    };

    setReservaConfirmada(nuevaReserva);
  }

  return (
    <section className="booking-page">
      <header className="booking-page__header">
        <h1>Reserva de habitaciones</h1>
        <p>Elige una habitación y un rango de fechas para ver su disponibilidad.</p>
      </header>

      <form className="booking-page__form" onSubmit={(e) => e.preventDefault()}>
        <label className="booking-page__field">
          Habitación
          <select
            value={habitacionId}
            onChange={(e) => handleSeleccionarHabitacion(e.target.value)}
          >
            <option value="">Selecciona una habitación</option>
            {habitaciones.map((habitacion) => (
              <option key={habitacion.id} value={habitacion.id}>
                {habitacion.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="booking-page__field">
          Fecha de entrada
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => handleCambiarFechas(e.target.value, fechaFin)}
          />
        </label>

        <label className="booking-page__field">
          Fecha de salida
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => handleCambiarFechas(fechaInicio, e.target.value)}
          />
        </label>
      </form>

      {cargando && <p className="booking-page__status">Cargando...</p>}
      {error && <p className="booking-page__status booking-page__status--error">{error}</p>}
      {errorImagenes && (
        <p className="booking-page__status booking-page__status--error">{errorImagenes}</p>
      )}
      {fechaInicio && fechaFin && !fechasValidas && (
        <p className="booking-page__status booking-page__status--error">
          La fecha de salida debe ser posterior a la fecha de entrada.
        </p>
      )}

      {habitacionSeleccionada && fechasValidas && (
        <div className="booking-page__result">
          <AvailabilityPreview
            habitacion={habitacionSeleccionada}
            imagenes={imagenes}
            noches={noches}
            precioTotal={precioTotal}
            disponible={disponible}
          />

          <button
            type="button"
            className="booking-page__submit"
            disabled={!disponible}
            onClick={handleReservar}
          >
            Reservar
          </button>
        </div>
      )}

      {reservaConfirmada && (
        <p className="booking-page__status booking-page__status--success">
          ¡Reserva {reservaConfirmada.id} confirmada para {usuarioActual.nombre}!
        </p>
      )}
    </section>
  );
}
