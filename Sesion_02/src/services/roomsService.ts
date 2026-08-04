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

// Mapa `ruta -> URL` de todas las imágenes bajo src/services/img/{habitacionId},
// resuelto en tiempo de build por Vite (simula un CDN/almacenamiento de imágenes).
const modulosImagenesHabitaciones = import.meta.glob<string>('./img/*/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Simula: GET /habitaciones/:id/imagenes */
export async function obtenerImagenesHabitacion(habitacionId: string): Promise<string[]> {
  const imagenes = Object.entries(modulosImagenesHabitaciones)
    .filter(([ruta]) => ruta.includes(`/img/${habitacionId}/`))
    .sort(([rutaA], [rutaB]) => rutaA.localeCompare(rutaB))
    .map(([, url]) => url);

  return simularRespuesta(imagenes);
}
