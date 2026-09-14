/**
 * El `quotationId` llega por la URL, así que antes de tocar la base conviene
 * comprobar que tenga forma de UUID.
 *
 * No es cosmético: la columna `quotation_id` es de tipo UUID en Postgres y una
 * consulta con un texto cualquiera termina en un error de la base en vez de en
 * un 404 limpio. Validar el formato acá convierte una URL manipulada en una
 * página "no encontrada", que es lo que corresponde.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isQuotationId(value: string): boolean {
  return UUID_PATTERN.test(value);
}
