import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { BookingStatus } from "@/lib/generated/prisma/enums";
import { BLOCKING_BOOKING_STATUSES } from "@/modules/bookings/booking.types";

/**
 * Columnas que necesitan los listados: la reserva, el nombre y el precio de
 * la habitación, el huésped y —para el flujo de pago— el último intento de
 * cobro. Un único SELECT con JOIN, sin consultas extra por fila.
 */
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

export type BookingWithRelations = Prisma.BookingGetPayload<{
  select: typeof bookingListSelect;
}>;

/**
 * Dos rangos semiabiertos [inicio, fin) se pisan si cada uno empieza antes de
 * que termine el otro. Traducido a Prisma: `startDate < end` y `endDate > start`.
 * Así una reserva que hace check-out el día 12 NO choca con otra que hace
 * check-in ese mismo día 12.
 */
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

  // Las reservas de UN usuario, las más recientes primero.
  async findAllByUserId(userId: number): Promise<BookingWithRelations[]> {
    return prisma.booking.findMany({
      where: { userId },
      select: bookingListSelect,
      orderBy: [{ id: "desc" }],
    });
  },

  /**
   * Busca por id Y por dueño en la MISMA consulta. Es deliberado: filtrar
   * después ("traigo la reserva y comparo el userId") deja la puerta abierta a
   * olvidarse la comparación en algún camino. Si no es tuya, no existe.
   */
  async findByIdForUser(
    id: number,
    userId: number
  ): Promise<BookingWithRelations | null> {
    return prisma.booking.findFirst({
      where: { id, userId },
      select: bookingListSelect,
    });
  },

  // Ids de las habitaciones ocupadas en un rango: alimenta la disponibilidad.
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

  /**
   * Crea la reserva solo si la habitación sigue libre, y lo hace dentro de una
   * transacción SERIALIZABLE.
   *
   * Comprobar disponibilidad y después insertar son dos pasos: entre uno y
   * otro puede colarse otra reserva para la misma habitación (dos alumnos
   * haciendo clic al mismo tiempo). Con el nivel SERIALIZABLE, Postgres
   * detecta ese cruce y aborta una de las dos transacciones, que es
   * exactamente lo que queremos. Prisma lo reporta como P2034 y el servicio lo
   * traduce a un 409.
   *
   * Devuelve null si la habitación ya estaba ocupada.
   */
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
