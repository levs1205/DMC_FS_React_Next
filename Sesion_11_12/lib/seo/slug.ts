/**
 * Slugs para URLs legibles.
 *
 * Una URL como /habitaciones/suite-miraflores-5 le dice al usuario (y al
 * buscador) de qué trata la página; /habitaciones/5 no dice nada.
 *
 * El id va al final a propósito: la búsqueda en la base sigue siendo por
 * clave primaria (rápida y sin columna nueva), y si mañana cambia el nombre
 * de la habitación el enlace viejo sigue funcionando —la página detecta que
 * el slug quedó desactualizado y redirige al canónico—.
 */

/** "Suite Miraflores" → "suite-miraflores" */
export function slugify(text: string): string {
  return text
    .normalize("NFD") // separa la letra de su tilde
    .replace(/[\u0300-\u036f]/g, "") // borra la tilde suelta: "habitación" queda "habitacion"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // todo lo que no sea letra o número → guion
    .replace(/^-+|-+$/g, ""); // sin guiones sueltos en los extremos
}

/** ("Suite Miraflores", 5) → "suite-miraflores-5" */
export function buildSlug(name: string, id: number): string {
  return `${slugify(name)}-${id}`;
}

/** "suite-miraflores-5" → 5 (o null si el slug no termina en un id válido). */
export function parseIdFromSlug(slug: string): number | null {
  const id = Number(slug.split("-").pop());

  return Number.isInteger(id) && id > 0 ? id : null;
}
