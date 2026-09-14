import { ApiError } from "@/lib/http/api-error";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  analyticsRepository,
  buildBookingWhere,
} from "@/modules/analytics/analytics.repository";
import type {
  BookingFilters,
  BookingSearchQuery,
  BookingSearchResult,
  BookingStats,
  BookingStatsQuery,
  BookingTotals,
  StatsBucket,
  StudentBucket,
  StudentSearchQuery,
  StudentSummary,
} from "@/modules/analytics/analytics.types";
import {
  countNightsBetween,
  toIsoDate,
  toUtcDate,
} from "@/modules/bookings/booking.dates";
import { BOOKING_STATUS_LABELS } from "@/modules/bookings/booking.labels";
import { toBookingListItem } from "@/modules/bookings/booking.service";
import { ROOM_TYPE_LABELS } from "@/modules/rooms/room.labels";
import { roomRepository } from "@/modules/rooms/room.repository";

/**
 * Reglas y cálculos de la analítica que consume el agente.
 *
 * El servicio devuelve números YA resueltos —promedios, porcentajes, totales—
 * en vez de filas crudas. Es deliberado: un modelo de lenguaje redacta muy
 * bien y calcula muy mal, así que cuanta menos aritmética le toque hacer,
 * menos estadísticas inventadas va a contar.
 */

const MONTH_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Decimal de Postgres → number de JSON (y null → 0 para poder sumar). */
function toAmount(value: Prisma.Decimal | null): number {
  return round2(Number(value ?? 0));
}

function percentageOf(part: number, total: number): number {
  if (total <= 0) return 0;

  return Math.round((part / total) * 1000) / 10;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Coherencia entre filtros que se piden de a pares. Son errores típicos de un
 * agente que traduce lenguaje natural ("del 30 al 1"), y conviene devolverle
 * un 400 explicando el problema antes que una lista vacía que va a interpretar
 * como "no hubo reservas".
 */
function assertCoherentFilters(filters: BookingFilters): void {
  if (filters.from && filters.to && filters.from > filters.to) {
    throw new ApiError(
      400,
      'El filtro "from" no puede ser posterior a "to". Revisá el orden de las fechas.'
    );
  }

  if (
    filters.minAmount !== undefined &&
    filters.maxAmount !== undefined &&
    filters.minAmount > filters.maxAmount
  ) {
    throw new ApiError(
      400,
      'El filtro "minAmount" no puede ser mayor que "maxAmount".'
    );
  }
}

/**
 * Los filtros que de verdad se aplicaron, sin los que quedaron en `undefined`.
 * Viajan de vuelta en la respuesta para que el chatbot pueda decir "encontré
 * 12 reservas de Ana en octubre" citando el criterio real y no el que creyó
 * haber mandado.
 */
function appliedFilters(filters: BookingFilters): BookingFilters {
  const applied = Object.entries(filters).filter(
    ([, value]) => value !== undefined
  );

  return Object.fromEntries(applied) as BookingFilters;
}

function byRevenueDesc(a: StatsBucket, b: StatsBucket): number {
  return b.revenue - a.revenue || b.bookings - a.bookings;
}

export const analyticsService = {
  /**
   * Listado paginado de reservas que cumplen el filtro.
   *
   * Devuelve las reservas con la MISMA forma que el resto de la API
   * (`BookingListItem`): el agente no tiene que aprender un segundo formato y
   * cualquier campo que se agregue allá aparece acá sin tocar este módulo.
   */
  async searchBookings(query: BookingSearchQuery): Promise<BookingSearchResult> {
    assertCoherentFilters(query);

    const { page, pageSize, sort, order, ...filters } = query;
    const where = buildBookingWhere(query);

    // El total y la página son dos consultas independientes: en paralelo.
    const [total, records] = await Promise.all([
      analyticsRepository.countBookings(where),
      analyticsRepository.findBookings(where, {
        skip: (page - 1) * pageSize,
        take: pageSize,
        sort,
        order,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      filters: appliedFilters(filters),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
      bookings: records.map(toBookingListItem),
    };
  },

  /**
   * Estadísticas del MISMO conjunto de reservas que devolvería `searchBookings`
   * con esos filtros. Esa simetría es la que permite que el chatbot diga "son
   * 12 reservas por S/ 9.800" y, si le piden el detalle, liste exactamente esas
   * 12 sin que los números bailen.
   */
  async getBookingStats(query: BookingStatsQuery): Promise<BookingStats> {
    assertCoherentFilters(query);

    const { top, ...filters } = query;
    const where = buildBookingWhere(query);

    const [
      aggregate,
      statusGroups,
      roomGroups,
      stayGroups,
      studentGroups,
      rooms,
    ] = await Promise.all([
      analyticsRepository.aggregateBookings(where),
      analyticsRepository.groupByStatus(where),
      analyticsRepository.groupByRoom(where),
      analyticsRepository.groupByStay(where),
      analyticsRepository.groupByStudent(where),
      roomRepository.findAll(),
    ]);

    const bookings = aggregate._count._all;
    const revenue = toAmount(aggregate._sum.totalPrice);

    // Las noches no son una columna sino una resta, así que se suman sobre los
    // rangos DISTINTOS multiplicando por cuántas reservas comparten cada uno.
    const nights = stayGroups.reduce(
      (total, group) =>
        total +
        countNightsBetween(group.startDate, group.endDate) * group._count._all,
      0
    );

    const totals: BookingTotals = {
      bookings,
      students: studentGroups.length,
      nights,
      revenue,
      averageTicket: bookings > 0 ? round2(revenue / bookings) : 0,
      averageNights: bookings > 0 ? round2(nights / bookings) : 0,
      minAmount:
        aggregate._min.totalPrice === null
          ? null
          : toAmount(aggregate._min.totalPrice),
      maxAmount:
        aggregate._max.totalPrice === null
          ? null
          : toAmount(aggregate._max.totalPrice),
      firstCheckIn: aggregate._min.startDate
        ? toIsoDate(aggregate._min.startDate)
        : null,
      lastCheckIn: aggregate._max.startDate
        ? toIsoDate(aggregate._max.startDate)
        : null,
    };

    const byStatus = statusGroups
      .map((group) => {
        const groupRevenue = toAmount(group._sum.totalPrice);

        return {
          key: group.status,
          label: BOOKING_STATUS_LABELS[group.status],
          bookings: group._count._all,
          revenue: groupRevenue,
          share: percentageOf(groupRevenue, revenue),
        };
      })
      .sort(byRevenueDesc);

    // El tipo de habitación vive en la tabla `room`, no en `booking`: se agrupa
    // por habitación (que sí es una columna de la reserva) y se pliega por tipo
    // con el catálogo, que son seis filas y ya está en memoria.
    const roomsById = new Map(rooms.map((room) => [room.id, room]));
    const typeTotals = new Map<string, { bookings: number; revenue: number }>();

    const topRooms = roomGroups
      .map((group) => {
        const room = roomsById.get(group.roomId);
        const groupRevenue = toAmount(group._sum.totalPrice);

        if (room) {
          const current = typeTotals.get(room.type) ?? {
            bookings: 0,
            revenue: 0,
          };

          typeTotals.set(room.type, {
            bookings: current.bookings + group._count._all,
            revenue: round2(current.revenue + groupRevenue),
          });
        }

        return {
          key: String(group.roomId),
          label: room?.name ?? `Habitación ${group.roomId}`,
          bookings: group._count._all,
          revenue: groupRevenue,
          share: percentageOf(groupRevenue, revenue),
        };
      })
      .sort(byRevenueDesc)
      .slice(0, top);

    const byRoomType = [...typeTotals.entries()]
      .map(([type, value]) => ({
        key: type,
        label: ROOM_TYPE_LABELS[type as keyof typeof ROOM_TYPE_LABELS],
        bookings: value.bookings,
        revenue: value.revenue,
        share: percentageOf(value.revenue, revenue),
      }))
      .sort(byRevenueDesc);

    const monthTotals = new Map<string, { bookings: number; revenue: number }>();

    for (const group of stayGroups) {
      const key = toIsoDate(group.startDate).slice(0, 7);
      const current = monthTotals.get(key) ?? { bookings: 0, revenue: 0 };

      monthTotals.set(key, {
        bookings: current.bookings + group._count._all,
        revenue: round2(current.revenue + toAmount(group._sum.totalPrice)),
      });
    }

    // Cronológico, no por importe: una serie temporal desordenada es ilegible
    // para cualquiera, humano o modelo.
    const byMonth = [...monthTotals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({
        key,
        label: capitalize(MONTH_FORMATTER.format(toUtcDate(`${key}-01`))),
        bookings: value.bookings,
        revenue: value.revenue,
        share: percentageOf(value.revenue, revenue),
      }));

    const rankedStudents = [...studentGroups]
      .sort(
        (a, b) =>
          Number(b._sum.totalPrice ?? 0) - Number(a._sum.totalPrice ?? 0) ||
          b._count._all - a._count._all
      )
      .slice(0, top);

    // Los nombres se piden en UNA consulta para todo el ranking, no de a uno
    // por fila.
    const names = await analyticsRepository.findStudentNames(
      rankedStudents.map((group) => group.userId)
    );
    const namesById = new Map(names.map((user) => [user.id, user]));

    const topStudents: StudentBucket[] = rankedStudents.map((group) => {
      const user = namesById.get(group.userId);
      const studentRevenue = toAmount(group._sum.totalPrice);

      return {
        key: String(group.userId),
        userId: group.userId,
        label: user?.name ?? user?.login ?? `Alumno ${group.userId}`,
        bookings: group._count._all,
        revenue: studentRevenue,
        share: percentageOf(studentRevenue, revenue),
      };
    });

    return {
      filters: appliedFilters(filters),
      totals,
      byStatus,
      byRoomType,
      byMonth,
      topStudents,
      topRooms,
    };
  },

  /**
   * Alumnos que coinciden con un texto, con su actividad resumida.
   *
   * Existe para el paso previo de casi cualquier conversación: el usuario dice
   * "Ana" y el agente necesita un id. Devolverle las coincidencias le permite
   * repreguntar ("¿Ana Torres o Ana Quispe?") en vez de elegir una al azar y
   * dar un número equivocado con total seguridad.
   */
  async searchStudents(query: StudentSearchQuery): Promise<StudentSummary[]> {
    const students = await analyticsRepository.searchStudents(
      query.q,
      query.limit
    );

    if (students.length === 0) return [];

    const groups = await analyticsRepository.groupByStudent({
      userId: { in: students.map((student) => student.id) },
    });
    const groupsById = new Map(groups.map((group) => [group.userId, group]));

    return students
      .map((student) => {
        const group = groupsById.get(student.id);

        return {
          id: student.id,
          name: student.name,
          login: student.login,
          bookings: group?._count._all ?? 0,
          revenue: toAmount(group?._sum.totalPrice ?? null),
          firstCheckIn: group?._min.startDate
            ? toIsoDate(group._min.startDate)
            : null,
          lastCheckIn: group?._max.startDate
            ? toIsoDate(group._max.startDate)
            : null,
        };
      })
      .sort((a, b) => b.bookings - a.bookings || a.id - b.id);
  },
};
