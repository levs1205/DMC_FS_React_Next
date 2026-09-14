import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { toUtcDate } from "@/modules/bookings/booking.dates";
import {
  bookingCoreSelect,
  type BookingCore,
} from "@/modules/bookings/booking.repository";
import type {
  BookingFilters,
  BookingSortField,
  SortOrder,
} from "@/modules/analytics/analytics.types";

/**
 * Acceso a datos de la analítica. Solo lecturas: acá no hay un solo create ni
 * update, y es a propósito —el agente consulta, no toca la reserva de nadie—.
 *
 * Las cuentas las hace Postgres (`aggregate` y `groupBy`), no JavaScript. Con
 * seis habitaciones da igual, pero "traigo todas las reservas y las sumo en
 * memoria" es la respuesta equivocada en cuanto la tabla crece, y el agente va
 * a pedir estadísticas sobre rangos grandes todo el tiempo.
 */

/**
 * Traduce los filtros del agente a un WHERE de Prisma.
 *
 * Es EL punto único donde se decide qué reservas ve una consulta: el listado y
 * las estadísticas llaman a esta misma función, así que el total que reporta
 * el chatbot siempre corresponde a las filas que puede listar.
 */
export function buildBookingWhere(
  filters: BookingFilters
): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = {};

  if (filters.studentId !== undefined) where.userId = filters.studentId;
  if (filters.roomId !== undefined) where.roomId = filters.roomId;
  if (filters.status) where.status = { in: filters.status };
  if (filters.roomType) where.room = { type: { in: filters.roomType } };

  // Búsqueda por nombre: `insensitive` lo resuelve Postgres con ILIKE, así no
  // hay que normalizar nada del lado de la app.
  if (filters.student) {
    where.user = {
      OR: [
        { name: { contains: filters.student, mode: "insensitive" } },
        { login: { contains: filters.student, mode: "insensitive" } },
      ],
    };
  }

  const from = filters.from ? toUtcDate(filters.from) : null;
  const to = filters.to ? toUtcDate(filters.to) : null;

  if (from || to) {
    if (filters.dateField === "overlap") {
      // La estadía es [check-in, check-out) y el rango pedido es [from, to]
      // con los dos extremos incluidos. Se pisan si la reserva empieza como
      // muy tarde el último día del rango y termina DESPUÉS del primero: una
      // salida el mismo día `from` no ocupó ninguna noche del rango.
      if (to) where.startDate = { lte: to };
      if (from) where.endDate = { gt: from };
    } else {
      const range = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };

      if (filters.dateField === "checkOut") where.endDate = range;
      else where.startDate = range;
    }
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.totalPrice = {
      ...(filters.minAmount !== undefined ? { gte: filters.minAmount } : {}),
      ...(filters.maxAmount !== undefined ? { lte: filters.maxAmount } : {}),
    };
  }

  return where;
}

export const analyticsRepository = {
  countBookings(where: Prisma.BookingWhereInput): Promise<number> {
    return prisma.booking.count({ where });
  },

  findBookings(
    where: Prisma.BookingWhereInput,
    options: {
      skip: number;
      take: number;
      sort: BookingSortField;
      order: SortOrder;
    }
  ): Promise<BookingCore[]> {
    // El id como segundo criterio deja el orden estable: sin él, dos reservas
    // que empiezan el mismo día podrían cambiar de página entre dos llamadas.
    const orderBy: Prisma.BookingOrderByWithRelationInput[] =
      options.sort === "id"
        ? [{ id: options.order }]
        : [{ [options.sort]: options.order }, { id: options.order }];

    return prisma.booking.findMany({
      where,
      select: bookingCoreSelect,
      orderBy,
      skip: options.skip,
      take: options.take,
    });
  },

  /** Totales de una sola pasada: cuántas, cuánto, mínimo, máximo y extremos. */
  aggregateBookings(where: Prisma.BookingWhereInput) {
    return prisma.booking.aggregate({
      where,
      _count: { _all: true },
      _sum: { totalPrice: true },
      _min: { totalPrice: true, startDate: true },
      _max: { totalPrice: true, startDate: true },
    });
  },

  groupByStatus(where: Prisma.BookingWhereInput) {
    return prisma.booking.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
      _sum: { totalPrice: true },
    });
  },

  groupByRoom(where: Prisma.BookingWhereInput) {
    return prisma.booking.groupBy({
      by: ["roomId"],
      where,
      _count: { _all: true },
      _sum: { totalPrice: true },
    });
  },

  /**
   * Agrupa por rango de estadía (entrada + salida).
   *
   * De acá salen dos cosas que no se pueden pedir de otra forma: el desglose
   * por mes —Prisma no sabe agrupar por `date_trunc`— y el total de noches,
   * que no es una columna sino una resta. Las filas son los rangos DISTINTOS
   * del filtro, no las reservas: un grupo escolar de veinte alumnos con las
   * mismas fechas es una sola fila.
   */
  groupByStay(where: Prisma.BookingWhereInput) {
    return prisma.booking.groupBy({
      by: ["startDate", "endDate"],
      where,
      _count: { _all: true },
      _sum: { totalPrice: true },
    });
  },

  /**
   * Un grupo por alumno, sin recortar: son pocos (uno por alumno con reservas)
   * y de la misma consulta salen el ranking y el "cuántos alumnos distintos".
   */
  groupByStudent(where: Prisma.BookingWhereInput) {
    return prisma.booking.groupBy({
      by: ["userId"],
      where,
      _count: { _all: true },
      _sum: { totalPrice: true },
      _min: { startDate: true },
      _max: { startDate: true },
    });
  },

  findStudentNames(ids: number[]) {
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, login: true },
    });
  },

  /** Alumnos que coinciden con un texto: resuelve "Ana" → id 7. */
  searchStudents(query: string | undefined, limit: number) {
    return prisma.user.findMany({
      where: {
        role: "STUDENT",
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" as const } },
                { login: { contains: query, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, login: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: limit,
    });
  },
};
