import type { BookingStatus, RoomType } from "@/modules/booking/booking.types"

export const BOOKING_STATUS_LABELS: Record <BookingStatus, string> = {
    PENDING: "Pendiente",
    CONFIRMED: "Confirmado",
    CANCELLED: "Cancelado",
    RESCHEDULED: "Reprogramado",
}

export const ROOM_TYPE_LABELS: Record <RoomType, string> = {
    DOUBLE: "Doble",
    SINGLE: "Solitario",
    SUITE: "Suite"
}

