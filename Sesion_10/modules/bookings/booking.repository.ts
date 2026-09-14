import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { BookingStatus } from "@/lib/generated/prisma/enums";
import { BLOCKING_BOOKING_STATUSES } from "@/modules/bookings/booking.types";

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
  room: { select: { name: true, type: true, pricePerNight: true } },
  user: { select: { name: true, login: true } },
  payments: {
    // El último intento es el que manda: si el primero fue rechazado y el
    // segundo aprobado, la reserva está pagada.
    orderBy: { id: "desc" },
    take: 1,
    select: {
      quotationId: true,
      status: true,
      amount: true,
      currency: true,
      statusDetail: true,
      providerPaymentId: true,
      paidAt: true,
    },
  },
} satisfies Prisma.BookingSelect;

function overlapWhere(
  roomId: number,
  startDate: Date,
  endDate: Date
): Prisma.BookingWhereInput {
  return {
    roomId,
    status: { in: [...BLOCKING_BOOKING_STATUSES] },
    startDate: { lt: endDate },
    endDate: { gt: startDate },
  };
}

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

  async findAllByUserId(userId: number): Promise<BookingWithRelations[]> {
    return prisma.booking.findMany({
      where: { userId },
      select: bookingListSelect,
      orderBy: [{ id: "desc" }],
    });
  },

  async findByIdForUser(
    id: number,
    userId: number
  ): Promise<BookingWithRelations | null> {
    return prisma.booking.findFirst({
      where: { id, userId },
      select: bookingListSelect,
    });
  },

  async findBookedRoomIds(startDate: Date, endDate: Date): Promise<number[]> {
    const rows = await prisma.booking.findMany({
      where: {
        status: { in: [...BLOCKING_BOOKING_STATUSES] },
        startDate: { lt: endDate },
        endDate: { gt: startDate },
      },
      select: { roomId: true },
      distinct: ["roomId"],
    });

    return rows.map((row) => row.roomId);
  },

async createIfAvailable(data: {
    roomId: number;
    userId: number;
    startDate: Date;
    endDate: Date;
    totalPrice: string;
  }): Promise<BookingWithRelations | null> {
    return prisma.$transaction(
      async (tx) => {
        const conflicts = await tx.booking.count({
          where: overlapWhere(data.roomId, data.startDate, data.endDate),
        });

        if (conflicts > 0) return null;

        return tx.booking.create({ data, select: bookingListSelect });
      },
      { isolationLevel: "Serializable" }
    );
  },


};
