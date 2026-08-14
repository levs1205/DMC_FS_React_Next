// ============================================================================
// Datos simulados (mock) — Sistema de reservas de hoteles
// Representan lo que normalmente vendría de un backend / base de datos.
// ============================================================================

import type { Disponibilidad, Habitacion } from '../utils/types';

export const habitacionesMock: Habitacion[] = [
  {
    id: 'hab-101',
    nombre: 'Habitación Individual 101',
    tipo: 'individual',
    capacidad: 1,
    precioPorNoche: 45,
    descripcion: 'Ideal para viajeros solos. Cama individual y escritorio.',
  },
  {
    id: 'hab-202',
    nombre: 'Habitación Doble 202',
    tipo: 'doble',
    capacidad: 2,
    precioPorNoche: 75,
    descripcion: 'Cama matrimonial, vista a la ciudad.',
  },
  {
    id: 'hab-303',
    nombre: 'Suite Ejecutiva 303',
    tipo: 'suite',
    capacidad: 4,
    precioPorNoche: 150,
    descripcion: 'Sala de estar separada, minibar y balcón privado.',
  },
];

/**
 * Genera disponibilidad simulada para los próximos `dias` a partir de hoy.
 * `diasNoDisponibles` marca, por índice, qué días se muestran ocupados.
 */
function generarDisponibilidad(
  habitacionId: string,
  dias: number,
  diasNoDisponibles: number[],
): Disponibilidad[] {
  return Array.from({ length: dias }, (_, indice) => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + indice);

    return {
      habitacionId,
      fecha: fecha.toISOString().slice(0, 10),
      disponible: !diasNoDisponibles.includes(indice),
    };
  });
}

export const disponibilidadMock: Disponibilidad[] = [
  ...generarDisponibilidad('hab-101', 14, [2, 3, 8]),
  ...generarDisponibilidad('hab-202', 14, [0, 5, 6, 7]),
  ...generarDisponibilidad('hab-303', 14, []),
];
