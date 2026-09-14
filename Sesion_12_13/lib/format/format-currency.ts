// El formateador se crea una sola vez a nivel de módulo: instanciar un
// Intl.NumberFormat por cada fila de una tabla es caro.
const currencyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
});

/** Formatea un monto como moneda peruana, p. ej. 1050 → "S/ 1,050.00". */
export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}
