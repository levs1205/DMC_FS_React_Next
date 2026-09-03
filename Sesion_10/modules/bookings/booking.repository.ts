import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { BookingStatus } from "@/lib/generated/prisma/enums";

// Columnas que necesita el listado del backoffice: la reserva más el nombre de
// la habitación y del huésped. Un único SELECT con JOIN, sin consultas extra.
const bookingListSelect = {
  id: true,
  roomId: true,
  userId: true,
  startDate: true,
  endDate: true,
  status: true,
  totalPrice: true,
  room: { select: { name: true, type: true } },
  user: { select: { name: true, login: true } },
} satisfies Prisma.BookingSelect;

export type BookingWithRelations = Prisma.BookingGetPayload<{
  select: typeof bookingListSelect;
}>;

export const bookingRepository = {
  async findAll(): Promise<BookingWithRelations[]> {
    return prisma.booking.findMany({
      select: bookingListSelect,
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
    });
  },

  async findById(id: number): Promise<BookingWithRelations | null> {
    return prisma.booking.findUnique({
      where: { id },
      select: bookingListSelect,
    });
  },

  async updateStatus(
    id: number,
    status: BookingStatus
  ): Promise<BookingWithRelations> {
    return prisma.booking.update({
      where: { id },
      data: { status },
      select: bookingListSelect,
    });
  },
};
