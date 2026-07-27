// ============================================================================
// Taller 2 — Validación del modelo con datos simulados (antes de React)
// ============================================================================
// Este script se ejecuta de forma independiente a la app (con `npm run
// validate:model`) para demostrar que el modelo de dominio y los datos
// mockeados son correctos ANTES de conectarlos a componentes de React.

import { disponibilidadMock, habitacionesMock } from '../src/services/mockData';
import { validarCatalogoHabitaciones, validarListaDisponibilidad } from '../src/utils/validateModel';

console.log('Validando modelo de dominio con datos simulados...\n');

const resultadoHabitaciones = validarCatalogoHabitaciones(habitacionesMock);
console.log(`Habitaciones revisadas: ${habitacionesMock.length}`);
console.log(resultadoHabitaciones.valido ? '  -> OK, sin errores.' : `  -> Errores:\n${resultadoHabitaciones.errores.map((e: string) => `     - ${e}`).join('\n')}`);

const resultadoDisponibilidad = validarListaDisponibilidad(disponibilidadMock);
console.log(`\nRegistros de disponibilidad revisados: ${disponibilidadMock.length}`);
console.log(resultadoDisponibilidad.valido ? '  -> OK, sin errores.' : `  -> Errores:\n${resultadoDisponibilidad.errores.map((e: string) => `     - ${e}`).join('\n')}`);

const totalErrores = resultadoHabitaciones.errores.length + resultadoDisponibilidad.errores.length;
console.log(`\nValidación completa. Errores encontrados: ${totalErrores}`);

process.exit(totalErrores > 0 ? 1 : 0);
