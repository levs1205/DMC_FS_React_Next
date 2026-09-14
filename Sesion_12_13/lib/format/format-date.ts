const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Formatea una fecha ISO corta ("YYYY-MM-DD") para mostrarla al usuario.
 *
 * Se interpreta y se formatea en UTC a propósito: son columnas DATE, sin hora.
 * Si se dejara la zona horaria local, en Perú (UTC-5) "2026-09-01" se leería
 * como el 31 de agosto.
 */
export function formatIsoDate(isoDate: string): string {
  return dateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}
