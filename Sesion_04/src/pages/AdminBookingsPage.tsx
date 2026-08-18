// ============================================================================
// AdminBookingsPage — listado de reservas (solo administrador)
// ============================================================================
// Taller educativo: la prop `key` en listas.
//
// Cada `<tr>` de la tabla usa `key={reserva.id}` (el id real de la reserva,
// nunca el índice del arreglo). Así, cuando una reserva cambia de estado o se
// agregan reservas nuevas, React sabe exactamente qué fila reutilizar y cuál
// hay que crear, en vez de volver a renderizar la tabla completa.
//
// El botón "Cancelar" abre un ConfirmDialog (dialog box) antes de llamar al
// servicio, para evitar cancelaciones accidentales.

import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useReservas } from '../hooks/useReservas';
import { obtenerUsuarios } from '../services/authService';
import { obtenerHabitaciones } from '../services/roomsService';
import { useAuth } from '../store/AuthContext';
import type { Habitacion, Reserva, Usuario } from '../utils/types';
import './AdminBookingsPage.css';
import ReservaEditableRow from '../components/ReservaEditableRow';

export function AdminBookingsPage() {
  const { usuario, cerrarSesion } = useAuth();
  const { reservas, cargando, error, cancelandoId, cancelar, reprogramandoId, reprogramar } = useReservas();

  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [reservaACancelar, setReservaACancelar] = useState<Reserva | null>(null);

  useEffect(() => {
    obtenerHabitaciones().then(setHabitaciones);
    obtenerUsuarios().then(setUsuarios);
  }, []);

  function obtenerNombreHabitacion(habitacionId: string): string {
    return habitaciones.find((h) => h.id === habitacionId)?.nombre ?? habitacionId;
  }

  function obtenerNombreUsuario(usuarioId: string): string {
    return usuarios.find((u) => u.id === usuarioId)?.nombre ?? usuarioId;
  }

  async function handleConfirmarCancelacion() {
    if (!reservaACancelar) return;
    await cancelar(reservaACancelar.id);
    setReservaACancelar(null);
  }

  if (!usuario) return null;

  return (
    <section className="admin-bookings-page">
      <header className="admin-bookings-page__header">
        <div>
          <h1>Listado de reservas</h1>
          <p>Todas las reservas creadas por los huéspedes, con opción de cancelarlas.</p>
        </div>
        <div className="admin-bookings-page__user">
          <span>{usuario.nombre}</span>
          <button type="button" className="admin-bookings-page__logout" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>

      {cargando && <p className="admin-bookings-page__status">Cargando...</p>}
      {error && <p className="admin-bookings-page__status admin-bookings-page__status--error">{error}</p>}

      {!cargando && reservas.length === 0 && (
        <p className="admin-bookings-page__status">Todavía no hay reservas registradas.</p>
      )}

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
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {reservas.map((reserva) => (
              // key={reserva.id}: identifica la fila por su id real, no por su
              // posición en el arreglo. Es lo que le permite a React actualizar
              // solo esta fila al cancelar o reprogramar, sin perder el estado
              // (por ejemplo, el modo de edición) de las demás filas.
              <ReservaEditableRow
                key={reserva.id}
                reserva={reserva}
                nombreHabitacion={obtenerNombreHabitacion(reserva.habitacionId)}
                nombreUsuario={obtenerNombreUsuario(reserva.usuarioId)}
                cancelando={cancelandoId === reserva.id}
                reprogramando={reprogramandoId === reserva.id}
                onCancelar={() => setReservaACancelar(reserva)}
                onGuardarReprogramacion={(nuevaFechaInicio, nuevaFechaFin) =>
                  reprogramar(reserva.id, nuevaFechaInicio, nuevaFechaFin)
                }
              />
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
            : ''
        }
        textoConfirmar="Sí, cancelar"
        textoCancelar="Volver"
        onConfirmar={handleConfirmarCancelacion}
        onCancelar={() => setReservaACancelar(null)}
      />
    </section>
  );
}
