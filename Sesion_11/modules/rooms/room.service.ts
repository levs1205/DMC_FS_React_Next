import { cache } from "react";
import { buildSlug, parseIdFromSlug } from "@/lib/seo/slug";
import { bookingRepository } from "@/modules/bookings/booking.repository";
import { validateStay } from "@/modules/bookings/booking.service";
import { roomRepository, type RoomRecord } from "@/modules/rooms/room.repository";
import type {
  RoomAvailabilityItem,
  RoomListItem,
} from "@/modules/rooms/room.types";

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

/**
 * Catálogo con la disponibilidad calculada para un rango de fechas.
 *
 * Son dos consultas y no una por habitación: se traen todas las habitaciones
 * y, aparte, los ids de las que están ocupadas en ese rango. Con seis
 * habitaciones da igual, con seiscientas es la diferencia entre 2 consultas y
 * 601.
 *
 * El total por habitación se calcula acá, del lado del servidor: es el mismo
 * número que después va a viajar a Mercado Pago, así que no puede depender de
 * lo que diga el navegador.
 */
export async function listRoomsWithAvailability(
  startDate: string,
  endDate: string
): Promise<RoomAvailabilityItem[]> {
  const nights = validateStay(startDate, endDate);

  const [rooms, bookedRoomIds] = await Promise.all([
    listRooms(),
    bookingRepository.findBookedRoomIds(
      new Date(`${startDate}T00:00:00.000Z`),
      new Date(`${endDate}T00:00:00.000Z`)
    ),
  ]);

  const booked = new Set(bookedRoomIds);

  return rooms.map((room) => ({
    ...room,
    available: !booked.has(room.id),
    nights,
    totalPrice: Number((room.pricePerNight * nights).toFixed(2)),
  }));
}
