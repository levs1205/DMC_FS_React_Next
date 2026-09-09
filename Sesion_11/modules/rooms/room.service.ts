import { cache } from "react";
import { buildSlug, parseIdFromSlug } from "@/lib/seo/slug";
import { roomRepository, type RoomRecord } from "@/modules/rooms/room.repository";
import type { RoomListItem } from "@/modules/rooms/room.types";

function toRoomListItem(record: RoomRecord): RoomListItem {
  return {
    id: record.id,
    slug: buildSlug(record.name, record.id),
    name: record.name,
    type: record.type,
    capacity: record.capacity,
    pricePerNight: Number(record.pricePerNight),
    description: record.description,
  };
}

/**
 * `cache` (de React, no de Next) memoriza el resultado durante UN render.
 *
 * La página de detalle consulta la habitación dos veces: una en
 * `generateMetadata` —para el <title> y las etiquetas Open Graph— y otra en
 * el componente. Sin `cache` serían dos consultas idénticas a la base por
 * cada visita; con `cache`, la segunda reutiliza la primera.
 */
export const listRooms = cache(async (): Promise<RoomListItem[]> => {
  const rooms = await roomRepository.findAll();
  return rooms.map(toRoomListItem);
});

/**
 * Busca por slug ("suite-miraflores-5"): el id va al final, así que la
 * consulta sigue siendo por clave primaria. Devuelve null si el slug está
 * mal formado o la habitación no existe, para que la página llame a
 * `notFound()` y responda 404 de verdad (un 200 con "no encontrado" haría
 * que el buscador indexe una página vacía).
 */
export const findRoomBySlug = cache(
  async (slug: string): Promise<RoomListItem | null> => {
    const id = parseIdFromSlug(slug);

    if (id === null) return null;

    const record = await roomRepository.findById(id);
    return record ? toRoomListItem(record) : null;
  }
);
