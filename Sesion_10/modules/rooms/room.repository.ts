import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

// Columnas públicas de una habitación: son las que se muestran en el catálogo
// y las que alimentan el JSON-LD. No hay datos sensibles, por eso estas
// páginas pueden ser públicas e indexables.
const roomSelect = {
  id: true,
  name: true,
  type: true,
  capacity: true,
  pricePerNight: true,
  description: true,
} satisfies Prisma.RoomSelect;

export type RoomRecord = Prisma.RoomGetPayload<{ select: typeof roomSelect }>;

export const roomRepository = {
  async findAll(): Promise<RoomRecord[]> {
    return prisma.room.findMany({
      select: roomSelect,
      orderBy: [{ pricePerNight: "asc" }, { id: "asc" }],
    });
  },

  async findById(id: number): Promise<RoomRecord | null> {
    return prisma.room.findUnique({ where: { id }, select: roomSelect });
  },
};
