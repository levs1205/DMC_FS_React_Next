import type { RoomType } from "@/lib/generated/prisma/enums";

// Se reexporta para que las páginas no importen del cliente generado.
export type { RoomType };

/**
 * Habitación lista para pintarse en una página pública.
 *
 * `slug` no existe en la base: lo calcula el servicio a partir del nombre y
 * del id. Es la URL canónica de la habitación, así que conviene que viaje
 * junto al resto de los datos y no se recalcule en cada componente.
 *
 * `pricePerNight` viaja como number (en la BD es DECIMAL y Prisma lo entrega
 * como Decimal, que no es serializable hacia el cliente).
 */
export interface RoomListItem {
  id: number;
  slug: string;
  name: string;
  type: RoomType;
  capacity: number;
  pricePerNight: number;
  description: string;
}

/**
 * La habitación más su disponibilidad para un rango concreto, con el total
 * que costaría esa estadía. Lo consume el formulario de nueva reserva.
 *
 * El total lo calcula el servidor —nunca el navegador— porque es el mismo
 * número que después se le va a cobrar al alumno.
 */
export interface RoomAvailabilityItem extends RoomListItem {
  available: boolean;
  nights: number;
  totalPrice: number;
}
