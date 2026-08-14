// ============================================================================
// Lógica de negocio — Sistema de reservas de hoteles
// Taller 3: Tipado de funciones de lógica de negocio
// ============================================================================
// Funciones puras y tipadas, sin dependencias de React. Se pueden probar
// de forma aislada (ver src/scripts/validateModel.ts).

import type { Disponibilidad } from './types';

const MS_POR_DIA = 1000 * 60 * 60 * 24;

/**
 * Valida que la fecha de salida sea posterior a la fecha de entrada.
 */
export function esRangoDeFechasValido(fechaInicio: string, fechaFin: string): boolean {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
    return false;
  }

  return inicio.getTime() < fin.getTime();
}

/**
 * Valida una reprogramación de reserva: la nueva fecha de entrada debe ser
 * posterior a la fecha de entrada original, y el nuevo rango debe seguir
 * siendo un rango de fechas válido (salida posterior a la nueva entrada).
 */
export function esReprogramacionValida(
  fechaInicioOriginal: string,
  nuevaFechaInicio: string,
  nuevaFechaFin: string,
): boolean {
  if (!esRangoDeFechasValido(nuevaFechaInicio, nuevaFechaFin)) {
    return false;
  }

  const original = new Date(fechaInicioOriginal);
  const nuevaInicio = new Date(nuevaFechaInicio);

  return nuevaInicio.getTime() > original.getTime();
}

/**
 * Calcula la cantidad de noches de estadía entre dos fechas.
 * Devuelve 0 si el rango de fechas no es válido.
 */
export function calcularNochesEstadia(fechaInicio: string, fechaFin: string): number {
  if (!esRangoDeFechasValido(fechaInicio, fechaFin)) {
    return 0;
  }

  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  return Math.round((fin.getTime() - inicio.getTime()) / MS_POR_DIA);
}

/**
 * Calcula el precio total de una estadía a partir del precio por noche.
 * Redondea a dos decimales para evitar errores de punto flotante.
 */
export function calcularPrecioTotal(precioPorNoche: number, noches: number): number {
  if (precioPorNoche <= 0 || noches <= 0) {
    return 0;
  }

  return Math.round(precioPorNoche * noches * 100) / 100;
}

/**
 * Verifica si una habitación está disponible durante TODO el rango de fechas
 * solicitado (fechaInicio incluida, fechaFin excluida — es la noche de salida).
 */
export function verificarDisponibilidadEnRango(
  disponibilidad: Disponibilidad[],
  fechaInicio: string,
  fechaFin: string,
): boolean {
  if (!esRangoDeFechasValido(fechaInicio, fechaFin)) {
    return false;
  }

  const inicio = new Date(fechaInicio).getTime();
  const fin = new Date(fechaFin).getTime();

  const diasEnRango = disponibilidad.filter((dia) => {
    const tiempo = new Date(dia.fecha).getTime();
    return tiempo >= inicio && tiempo < fin;
  });

  // Si no hay datos de disponibilidad para el rango, no podemos confirmar.
  if (diasEnRango.length === 0) {
    return false;
  }

  return diasEnRango.every((dia) => dia.disponible);
}
