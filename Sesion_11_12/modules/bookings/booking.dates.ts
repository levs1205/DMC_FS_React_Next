/**
 * Aritmética de fechas de una estadía.
 *
 * `start_date` y `end_date` son columnas DATE: un día calendario, sin hora ni
 * zona horaria. Para que no aparezcan corrimientos de un día (Perú es UTC-5)
 * TODO se maneja en UTC: las fechas se parsean como medianoche UTC y se
 * vuelven a serializar cortando el ISO en 10 caracteres.
 *
 * Convención de hotelería: el rango es semiabierto [check-in, check-out). Una
 * reserva del 10 al 12 son 2 noches y libera la habitación el día 12, así que
 * otra reserva puede empezar ese mismo 12.
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Noches máximas por reserva y cuánto se puede reservar a futuro. */
export const MAX_NIGHTS = 30;
export const MAX_ADVANCE_DAYS = 365;

/** Date → "2026-09-10" (siempre en UTC). */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "2026-09-10" → Date en medianoche UTC, o null si no es una fecha real. */
export function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE_PATTERN.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) return null;

  // Descarta fechas imposibles que el constructor "corrige" solo
  // (por ejemplo "2026-02-31", que se convertiría en marzo).
  return toIsoDate(date) === value ? date : null;
}

/** El día de hoy en UTC, que es contra lo que se compara el check-in. */
export function todayIsoDate(): string {
  return toIsoDate(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T00:00:00.000Z`).getTime();

  return toIsoDate(new Date(base + days * MS_PER_DAY));
}

/** Noches entre dos fechas ISO. ("2026-09-10", "2026-09-12") → 2. */
export function countNights(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00.000Z`).getTime();
  const end = new Date(`${endIso}T00:00:00.000Z`).getTime();

  return Math.round((end - start) / MS_PER_DAY);
}
