import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { BookingStatus } from "@/lib/generated/prisma/enums";

const bookingLIstSelect = {
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

export type BookingRelations = Prisma.BookingGetPayload<{
  select: typeof bookingLIstSelect;
}>;

export const bookingRepository = {
  async findById(id: number): Promise<BookingRelations | null> {
    return prisma.booking.findUnique({
      where: { id },
      select: bookingLIstSelect,
    });
  },

  async findAll(): Promise<BookingRelations[]> {
    return prisma.booking.findMany({
      select: bookingLIstSelect,
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
    });
  },

  async updateStatus(
    id: number,
    status: BookingStatus,
  ): Promise<BookingRelations> {
    return prisma.booking.update({
      where: { id },
      data: { status },
      select: bookingLIstSelect,
    });
  },
};
