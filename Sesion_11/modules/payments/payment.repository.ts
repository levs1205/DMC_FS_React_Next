import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import type {
  BookingStatus,
  PaymentStatus,
} from "@/lib/generated/prisma/enums";

/**
 * Columnas del intento de cobro más los datos de la reserva que lo originó.
 *
 * La página de resultado necesita mostrar habitación, fechas y total, y el
 * webhook necesita saber a qué reserva pertenece el pago: con este select
 * ambas cosas salen de una sola consulta.
 */
const paymentDetailSelect = {
  id: true,
  quotationId: true,
  bookingId: true,
  status: true,
  amount: true,
  currency: true,
  preferenceId: true,
  initPoint: true,
  providerPaymentId: true,
  statusDetail: true,
  paidAt: true,
  createdAt: true,
  booking: {
    select: {
      id: true,
      userId: true,
      status: true,
      startDate: true,
      endDate: true,
      totalPrice: true,
      room: { select: { name: true, type: true, pricePerNight: true } },
    },
  },
} satisfies Prisma.PaymentSelect;

export type PaymentWithBooking = Prisma.PaymentGetPayload<{
  select: typeof paymentDetailSelect;
}>;

export const paymentRepository = {
  async create(data: {
    quotationId: string;
    bookingId: number;
    amount: string;
    currency: string;
  }): Promise<PaymentWithBooking> {
    return prisma.payment.create({ data, select: paymentDetailSelect });
  },

  async findByQuotationId(
    quotationId: string
  ): Promise<PaymentWithBooking | null> {
    return prisma.payment.findUnique({
      where: { quotationId },
      select: paymentDetailSelect,
    });
  },

  /** Último intento de cobro de una reserva (el que decide si se reutiliza). */
  async findLastForBooking(
    bookingId: number
  ): Promise<PaymentWithBooking | null> {
    return prisma.payment.findFirst({
      where: { bookingId },
      orderBy: { id: "desc" },
      select: paymentDetailSelect,
    });
  },

  /** Guarda la preferencia recién creada en Mercado Pago. */
  async attachPreference(
    quotationId: string,
    data: { preferenceId: string; initPoint: string }
  ): Promise<PaymentWithBooking> {
    return prisma.payment.update({
      where: { quotationId },
      data,
      select: paymentDetailSelect,
    });
  },

  /**
   * Escribe el resultado del cobro y el nuevo estado de la reserva EN UNA
   * TRANSACCIÓN.
   *
   * Que las dos tablas se muevan juntas no es un detalle: si se guardara el
   * pago como aprobado y fallara la actualización de la reserva, quedaría un
   * alumno que pagó y una reserva que sigue figurando como pendiente.
   */
  async applyResult(data: {
    quotationId: string;
    bookingId: number;
    paymentStatus: PaymentStatus;
    statusDetail: string | null;
    providerPaymentId: string | null;
    paidAt: Date | null;
    bookingStatus: BookingStatus | null;
  }): Promise<PaymentWithBooking> {
    return prisma.$transaction(async (tx) => {
      if (data.bookingStatus) {
        await tx.booking.update({
          where: { id: data.bookingId },
          data: { status: data.bookingStatus },
        });
      }

      return tx.payment.update({
        where: { quotationId: data.quotationId },
        data: {
          status: data.paymentStatus,
          statusDetail: data.statusDetail,
          providerPaymentId: data.providerPaymentId,
          paidAt: data.paidAt,
        },
        select: paymentDetailSelect,
      });
    });
  },
};
