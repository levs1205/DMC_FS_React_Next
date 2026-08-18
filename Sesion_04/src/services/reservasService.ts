// ============================================================================
// Servicio de reservas — capa de acceso a datos (mockeada)
// ============================================================================
// `crearReserva` la usa BookingPage cuando un cliente reserva una habitación.
// `obtenerReservas` y `cancelarReserva` las usa AdminBookingsPage para listar
// y cancelar reservas. Como comparten el mismo arreglo en memoria
// (reservasMock), toda reserva creada aparece de inmediato en el listado del
// administrador.

import type { Reserva } from "../utils/types";
import { reservasMock } from "./reservasMockData";

const RETARDO_SIMULADO_MS = 400;

function simularRespuesta<T>(datos: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(datos), RETARDO_SIMULADO_MS);
  });
}

/** Simula: GET /reservas (uso exclusivo del administrador) */
export async function obtenerReservas(): Promise<Reserva[]> {
  return simularRespuesta([...reservasMock]);
}

/** Simula: POST /reservas */
export async function crearReserva(reserva: Reserva): Promise<Reserva> {
  reservasMock.push(reserva);
  return simularRespuesta(reserva);
}

/** Simula: PATCH /reservas/:id/cancelar */
export async function cancelarReserva(id: string): Promise<Reserva | null> {
  const reserva = reservasMock.find((r) => r.id === id);
  if (!reserva) {
    return simularRespuesta(null);
  }

  reserva.estado = "cancelada";
  return simularRespuesta(reserva);
}

/** Simula: PATCH /reservas/:id/reprogramar */
export async function reprogramarReserva(
  id: string,
  fechaInicio: string,
  fechaFin: string,
): Promise<Reserva | null> {
  const reserva = reservasMock.find((r) => r.id === id);
  if (!reserva) {
    return simularRespuesta(null);
  }

  reserva.fechaInicio = fechaInicio;
  reserva.fechaFin = fechaFin;
  reserva.estado = "reprogramada";
  return simularRespuesta(reserva);
}
