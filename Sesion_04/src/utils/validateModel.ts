// ============================================================================
// Validación del modelo — Sistema de reservas de hoteles
// Taller 2: Validación del modelo con datos simulados (antes de integrarlo a React)
// ============================================================================
// Estas funciones verifican, en tiempo de ejecución, que los datos simulados
// (mocks) cumplen con las reglas del dominio definidas en utils/types.ts.
// La idea del taller es correr esta validación DESDE LA TERMINAL
// (ver scripts/validateModel.ts) antes de conectar nada a React.

import type { Disponibilidad, Habitacion } from './types';

export interface ResultadoValidacion {
  valido: boolean;
  errores: string[];
}

/** Valida los datos de una habitación del catálogo. */
export function validarHabitacion(habitacion: Habitacion): ResultadoValidacion {
  const errores: string[] = [];

  if (!habitacion.id.trim()) errores.push('La habitación requiere un id.');
  if (!habitacion.nombre.trim()) errores.push('La habitación requiere un nombre.');
  if (habitacion.capacidad <= 0) errores.push('La capacidad debe ser mayor a 0.');
  if (habitacion.precioPorNoche <= 0) errores.push('El precio por noche debe ser mayor a 0.');

  const tiposValidos = ['individual', 'doble', 'suite'];
  if (!tiposValidos.includes(habitacion.tipo)) {
    errores.push(`Tipo de habitación inválido: "${habitacion.tipo}".`);
  }

  return { valido: errores.length === 0, errores };
}

/** Valida un registro de disponibilidad para un día puntual. */
export function validarDisponibilidad(item: Disponibilidad): ResultadoValidacion {
  const errores: string[] = [];

  if (!item.habitacionId.trim()) errores.push('Falta el id de la habitación.');
  if (Number.isNaN(new Date(item.fecha).getTime())) {
    errores.push(`Fecha inválida: "${item.fecha}".`);
  }

  return { valido: errores.length === 0, errores };
}

/** Valida una lista completa de habitaciones y agrupa los errores encontrados. */
export function validarCatalogoHabitaciones(habitaciones: Habitacion[]): ResultadoValidacion {
  const errores = habitaciones.flatMap((habitacion) => {
    const resultado = validarHabitacion(habitacion);
    return resultado.errores.map((error) => `[${habitacion.id || 's/id'}] ${error}`);
  });

  return { valido: errores.length === 0, errores };
}

/** Valida una lista completa de disponibilidad y agrupa los errores encontrados. */
export function validarListaDisponibilidad(disponibilidad: Disponibilidad[]): ResultadoValidacion {
  const errores = disponibilidad.flatMap((item) => {
    const resultado = validarDisponibilidad(item);
    return resultado.errores.map((error) => `[${item.habitacionId}/${item.fecha}] ${error}`);
  });

  return { valido: errores.length === 0, errores };
}
