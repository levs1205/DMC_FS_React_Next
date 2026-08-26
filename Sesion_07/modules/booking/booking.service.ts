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
    roomType: record.room.typeR,
    userId: record.userId,
    userName: record.user.name ?? record.user.login,
    startDate: toIsoDate(record.startDate),
    endDate: toIsoDate(record.endDate),
    status: record.status,
    totalPrice: Number(record.totalPrice),
  };
}


export const bookingService = {
    async listBookings(): Promise<BookingListItem[]>{
        const bookings = await bookingRepository.findAll()
        return bookings.map(toBookingListItem)
    },
}