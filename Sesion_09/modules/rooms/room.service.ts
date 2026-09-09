import { cache } from "react";
import { buildSlug, parseIdFromSlug } from "@/lib/seo/slug"
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

export const listRooms = cache(async (): Promise<RoomListItem[]> => {
  const rooms = await roomRepository.findAll();
  return rooms.map(toRoomListItem);
});


export const findRoomBySlug = cache(
  async (slug: string): Promise<RoomListItem | null> => {
    const id = parseIdFromSlug(slug);

    if (id === null) return null;

    const record = await roomRepository.findById(id);
    return record ? toRoomListItem(record) : null;
  }
);