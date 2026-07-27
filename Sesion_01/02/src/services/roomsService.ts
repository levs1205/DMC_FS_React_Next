// ============================================================================
// Servicio de habitaciones — capa de acceso a datos
// ============================================================================
// Simula llamadas a una API real usando los datos mockeados + un retardo
// artificial. En una clase futura, estas funciones podrían reemplazarse por
// llamadas `fetch`/`axios` reales sin tener que tocar los componentes.

import type { Disponibilidad, Habitacion } from '../utils/types';
import { disponibilidadMock, habitacionesMock } from './mockData';

const RETARDO_SIMULADO_MS = 400;

function simularRespuesta<T>(datos: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(datos), RETARDO_SIMULADO_MS);
  });
}

/** Simula: GET /habitaciones */
export async function obtenerHabitaciones(): Promise<Habitacion[]> {
  return simularRespuesta(habitacionesMock);
}

/** Simula: GET /habitaciones/:id/disponibilidad */
export async function obtenerDisponibilidad(habitacionId: string): Promise<Disponibilidad[]> {
  const disponibilidad = disponibilidadMock.filter((dia) => dia.habitacionId === habitacionId);
  return simularRespuesta(disponibilidad);
}
