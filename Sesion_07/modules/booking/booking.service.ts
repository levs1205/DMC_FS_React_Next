import { BookingOrderByWithRelationInput } from "@/lib/generated/prisma/models";
import { ApiError } from "@/lib/http/api-error";
import {
  bookingRepository,
  type BookingRelations,
} from "@/modules/booking/booking.repository";
import type {
  BookingListItem,
  BookingStatus,
} from "@/modules/booking/booking.types";

const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "RESCHEDULED",
] as const satisfies readonly BookingStatus[];

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toBookingListItem(record: BookingRelations): BookingListItem {
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

function parseBookingId(id: string): number {
  const idNumber = Number(id);

  if (!Number.isInteger(idNumber) || idNumber <= 0) {
    throw new ApiError(400, "El id de habitacion es incorrecto");
  }

  return idNumber;
}

function isBookingStatus(value: unknown): value is BookingStatus {
  return BOOKING_STATUSES.includes(value as BookingStatus);
}

export const bookingService = {
  async listBookings(): Promise<BookingListItem[]> {
    const bookings = await bookingRepository.findAll();
    return bookings.map(toBookingListItem);
  },

  async updateStatus(idRaw: string, status: unknown): Promise<BookingListItem> {
    const id = parseBookingId(idRaw);

    if (!isBookingStatus(status)) {
      throw new ApiError(
        400,
        "El valor de la propiedad status no pertenece al catalogo",
      );
    }

    const current = await bookingRepository.findById(id);

    if (!current) {
      throw new ApiError(404, "La reserva no existe");
    }

    if(current.status === "CANCELLED"){
      throw new ApiError(409, "La reserva ya esta cancelada")
    }

    const updated = await bookingRepository.updateStatus(id, status);

    return toBookingListItem(updated);

  },
};
