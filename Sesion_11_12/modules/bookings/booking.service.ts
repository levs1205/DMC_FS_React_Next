import { ApiError } from "@/lib/http/api-error";
import {
  MAX_ADVANCE_DAYS,
  MAX_NIGHTS,
  addDays,
  countNights,
  parseIsoDate,
  toIsoDate,
  todayIsoDate,
} from "@/modules/bookings/booking.dates";
import {
  bookingRepository,
  type BookingWithRelations,
} from "@/modules/bookings/booking.repository";
import type {
  BookingListItem,
  BookingStatus,
  BookingWithPayment,
  CreateBookingInput,
} from "@/modules/bookings/booking.types";
import { roomRepository } from "@/modules/rooms/room.repository";

// Valores válidos del enum booking_status (mismo orden que en el schema).
const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "RESCHEDULED",
  "PAID",
  "PAYMENT_FAILED",
] as const satisfies readonly BookingStatus[];

function isBookingStatus(value: unknown): value is BookingStatus {
  return BOOKING_STATUSES.includes(value as BookingStatus);
}

function toBookingListItem(record: BookingWithRelations): BookingListItem {
  const startDate = toIsoDate(record.startDate);
  const endDate = toIsoDate(record.endDate);

  return {
    id: record.id,
    roomId: record.roomId,
    roomName: record.room.name,
    roomType: record.room.type,
    userId: record.userId,
    userName: record.user.name ?? record.user.login,
    startDate,
    endDate,
    status: record.status,
    nights: countNights(startDate, endDate),
    pricePerNight: Number(record.room.pricePerNight),
    totalPrice: Number(record.totalPrice),
  };
}

function toBookingWithPayment(record: BookingWithRelations): BookingWithPayment {
  const [payment] = record.payments;

  return {
    ...toBookingListItem(record),
    payment: payment
      ? {
          quotationId: payment.quotationId,
          status: payment.status,
          amount: Number(payment.amount),
          currency: payment.currency,
          statusDetail: payment.statusDetail,
          providerPaymentId: payment.providerPaymentId,
          paidAt: payment.paidAt?.toISOString() ?? null,
        }
      : null,
  };
}

function parseBookingId(rawId: string): number {
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "El identificador de la reserva no es válido.");
  }

  return id;
}

/**
 * Reglas de negocio del rango de fechas, y cantidad de noches que resulta.
 *
 * Se validan SIEMPRE en el servidor aunque el formulario ya las controle: el
 * navegador es del usuario y cualquiera puede mandar un POST a mano.
 */
export function validateStay(startDate: string, endDate: string): number {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);

  if (!start || !end) {
    throw new ApiError(400, "Las fechas deben tener el formato AAAA-MM-DD.");
  }

  const nights = countNights(startDate, endDate);

  if (nights <= 0) {
    throw new ApiError(
      400,
      "La fecha de salida tiene que ser posterior a la de entrada."
    );
  }

  if (startDate < todayIsoDate()) {
    throw new ApiError(400, "La fecha de entrada no puede estar en el pasado.");
  }

  if (nights > MAX_NIGHTS) {
    throw new ApiError(
      400,
      `La estadía no puede superar las ${MAX_NIGHTS} noches.`
    );
  }

  if (startDate > addDays(todayIsoDate(), MAX_ADVANCE_DAYS)) {
    throw new ApiError(
      400,
      `Solo se puede reservar con hasta ${MAX_ADVANCE_DAYS} días de anticipación.`
    );
  }

  return nights;
}

export const bookingService = {
  async listBookings(): Promise<BookingListItem[]> {
    const bookings = await bookingRepository.findAll();
    return bookings.map(toBookingListItem);
  },

  /** Listado "mis reservas": solo las del usuario logueado, con su pago. */
  async listBookingsForUser(userId: number): Promise<BookingWithPayment[]> {
    const bookings = await bookingRepository.findAllByUserId(userId);
    return bookings.map(toBookingWithPayment);
  },

  /**
   * Una reserva del usuario logueado. Devuelve 404 —y no 403— cuando la
   * reserva existe pero es de otra persona: confirmar "existe, pero no es
   * tuya" ya es filtrar información.
   */
  async findBookingForUser(
    rawId: string,
    userId: number
  ): Promise<BookingWithPayment> {
    const id = parseBookingId(rawId);
    const record = await bookingRepository.findByIdForUser(id, userId);

    if (!record) {
      throw new ApiError(404, "La reserva no existe.");
    }

    return toBookingWithPayment(record);
  },

  /**
   * Crea una reserva en estado PENDING a nombre del usuario logueado.
   *
   * El `userId` NO viene del cuerpo de la petición sino de la sesión: si
   * viniera del body, cualquiera podría reservar a nombre de otro. El precio
   * tampoco se acepta del cliente, se calcula con el precio vigente de la
   * habitación.
   */
  async createBooking(
    userId: number,
    input: CreateBookingInput
  ): Promise<BookingWithPayment> {
    const nights = validateStay(input.startDate, input.endDate);
    const room = await roomRepository.findById(input.roomId);

    if (!room) {
      throw new ApiError(404, "La habitación no existe.");
    }

    const totalPrice = (Number(room.pricePerNight) * nights).toFixed(2);

    let created: BookingWithRelations | null;

    try {
      created = await bookingRepository.createIfAvailable({
        roomId: room.id,
        userId,
        startDate: new Date(`${input.startDate}T00:00:00.000Z`),
        endDate: new Date(`${input.endDate}T00:00:00.000Z`),
        totalPrice,
      });
    } catch (error) {
      // P2034: Postgres abortó la transacción serializable porque otra reserva
      // para la misma habitación se coló en paralelo.
      if ((error as { code?: string } | null)?.code === "P2034") {
        throw new ApiError(
          409,
          "Otra persona reservó esa habitación en el mismo momento. Probá de nuevo."
        );
      }

      throw error;
    }

    if (!created) {
      throw new ApiError(
        409,
        "La habitación ya está reservada en esas fechas. Elegí otras fechas u otra habitación."
      );
    }

    return toBookingWithPayment(created);
  },

  async updateStatus(rawId: string, status: unknown): Promise<BookingListItem> {
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
