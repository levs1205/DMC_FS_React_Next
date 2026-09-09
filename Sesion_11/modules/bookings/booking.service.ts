import { ApiError } from "@/lib/http/api-error";
import {
  bookingRepository,
  type BookingWithRelations,
} from "@/modules/bookings/booking.repository";
import type {
  BookingListItem,
  BookingStatus,
} from "@/modules/bookings/booking.types";

// Valores válidos del enum booking_status (mismo orden que en el schema).
const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "RESCHEDULED",
] as const satisfies readonly BookingStatus[];

function isBookingStatus(value: unknown): value is BookingStatus {
  return BOOKING_STATUSES.includes(value as BookingStatus);
}

// Las columnas son DATE, así que Prisma devuelve la medianoche UTC de ese día:
// cortar el ISO en 10 caracteres da el "YYYY-MM-DD" original sin desfases.
function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toBookingListItem(record: BookingWithRelations): BookingListItem {
  return {
    id: record.id,
    roomId: record.roomId,
    roomName: record.room.name,
    roomType: record.room.type,
    userId: record.userId,
    userName: record.user.name ?? record.user.login,
    startDate: toIsoDate(record.startDate),
    endDate: toIsoDate(record.endDate),
    status: record.status,
    totalPrice: Number(record.totalPrice),
  };
}

function parseBookingId(rawId: string): number {
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "El identificador de la reserva no es válido.");
  }

  return id;
}

export const bookingService = {
  async listBookings(): Promise<BookingListItem[]> {
    const bookings = await bookingRepository.findAll();
    return bookings.map(toBookingListItem);
  },

  async updateStatus(
    rawId: string,
    status: unknown
  ): Promise<BookingListItem> {
    const id = parseBookingId(rawId);

    if (!isBookingStatus(status)) {
      throw new ApiError(
        400,
        `El campo "status" debe ser uno de: ${BOOKING_STATUSES.join(", ")}.`
      );
    }

    const current = await bookingRepository.findById(id);

    if (!current) {
      throw new ApiError(404, "La reserva no existe.");
    }

    // Cancelar es un estado final: no se reactiva ni se vuelve a cancelar.
    if (current.status === "CANCELLED") {
      throw new ApiError(409, "La reserva ya está cancelada.");
    }

    const updated = await bookingRepository.updateStatus(id, status);
    return toBookingListItem(updated);
  },
};
