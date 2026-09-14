import "server-only";

import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/http/api-error";
import { countNights, toIsoDate } from "@/modules/bookings/booking.dates";
import { bookingService } from "@/modules/bookings/booking.service";
import {
  mercadoPagoClient,
  toMercadoPagoDate,
} from "@/modules/payments/mercadopago/mercadopago.client";
import {
  CHECKOUT_EXPIRATION_MINUTES,
  MERCADOPAGO_CURRENCY,
  getPublicBaseUrl,
  isPublicBaseUrlReachable,
} from "@/modules/payments/mercadopago/mercadopago.config";
import type {
  MercadoPagoPayment,
  PreferenceRequest,
} from "@/modules/payments/mercadopago/mercadopago.types";
import {
  isFinalPaymentStatus,
  mapPayment,
} from "@/modules/payments/payment.mapper";
import {
  paymentRepository,
  type PaymentWithBooking,
} from "@/modules/payments/payment.repository";
import type {
  CheckoutRedirect,
  CheckoutView,
} from "@/modules/payments/payment.types";
import { userService } from "@/modules/users/user.service";

/**
 * Orquestación del cobro con Mercado Pago (Checkout Pro).
 *
 * El hilo conductor es el `quotationId`: un UUID que generamos ANTES de
 * hablar con Mercado Pago y que se usa a la vez como clave de idempotencia de
 * la preferencia, como `external_reference` del pago y como identificador de
 * la URL de retorno. Gracias a eso:
 *
 * - hacer clic dos veces en "Pagar" no crea dos preferencias;
 * - el webhook puede llegar repetido o fuera de orden sin romper nada;
 * - la página de resultado puede reconstruir el estado sin confiar en lo que
 *   venga por la query string.
 *
 * Regla de oro de toda la integración: no se le cree a nada que venga del
 * navegador ni del cuerpo del webhook. El estado del pago siempre se le
 * pregunta a la API de Mercado Pago.
 */

const MS_PER_MINUTE = 60 * 1000;

function toCheckoutView(record: PaymentWithBooking): CheckoutView {
  const startDate = toIsoDate(record.booking.startDate);
  const endDate = toIsoDate(record.booking.endDate);

  return {
    payment: {
      quotationId: record.quotationId,
      status: record.status,
      amount: Number(record.amount),
      currency: record.currency,
      statusDetail: record.statusDetail,
      providerPaymentId: record.providerPaymentId,
      paidAt: record.paidAt?.toISOString() ?? null,
    },
    booking: {
      id: record.booking.id,
      status: record.booking.status,
      roomName: record.booking.room.name,
      roomType: record.booking.room.type,
      startDate,
      endDate,
      nights: countNights(startDate, endDate),
      pricePerNight: Number(record.booking.room.pricePerNight),
      totalPrice: Number(record.booking.totalPrice),
    },
  };
}

/**
 * Un intento de cobro se reutiliza mientras siga vivo: mismo monto, todavía
 * sin resolver y dentro de la ventana de expiración de la preferencia. Un
 * intento vencido o rechazado NO se recicla, porque en Mercado Pago ya quedó
 * cerrado: para reintentar hace falta una cotización nueva.
 */
function isReusable(payment: PaymentWithBooking): boolean {
  if (payment.status !== "PENDING" && payment.status !== "IN_PROCESS") {
    return false;
  }

  if (Number(payment.amount) !== Number(payment.booking.totalPrice)) {
    return false;
  }

  return Date.now() - payment.createdAt.getTime() <
    CHECKOUT_EXPIRATION_MINUTES * MS_PER_MINUTE;
}

/** Aplica en la base el resultado que devolvió Mercado Pago. Idempotente. */
async function applyProviderPayment(
  stored: PaymentWithBooking,
  providerPayment: MercadoPagoPayment
): Promise<PaymentWithBooking> {
  // Un estado final no retrocede: si llega tarde la notificación de "pending"
  // de un pago que ya sabemos aprobado, se ignora.
  if (isFinalPaymentStatus(stored.status)) {
    return stored;
  }

  /**
   * Control de monto. El importe a cobrar lo fija el servidor al crear la
   * preferencia; si el pago que vuelve no coincide con la cotización, algo se
   * manipuló en el camino y no se marca nada como pagado.
   */
  if (Number(providerPayment.transaction_amount) !== Number(stored.amount)) {
    console.error("[pagos] el monto del pago no coincide con la cotización", {
      quotationId: stored.quotationId,
      esperado: Number(stored.amount),
      recibido: providerPayment.transaction_amount,
    });

    throw new ApiError(409, "El monto del pago no coincide con la reserva.");
  }

  const outcome = mapPayment(providerPayment);

  return paymentRepository.applyResult({
    quotationId: stored.quotationId,
    bookingId: stored.bookingId,
    paymentStatus: outcome.paymentStatus,
    statusDetail: providerPayment.status_detail,
    providerPaymentId: String(providerPayment.id),
    paidAt: outcome.paidAt,
    // Una reserva cancelada por el hotel no vuelve sola a la vida por un pago
    // que llegó tarde: eso lo resuelve una persona desde el backoffice.
    bookingStatus:
      stored.booking.status === "CANCELLED" ? null : outcome.bookingStatus,
  });
}

export const paymentService = {
  /**
   * Devuelve la cotización vigente de una reserva, creándola si hace falta.
   *
   * Es lo primero que corre al entrar a la página de pago: al llegar ahí el
   * alumno ya tiene su número de pedido, aunque todavía no haya apretado el
   * botón de pagar.
   */
  async ensureQuotation(
    rawBookingId: string,
    userId: number
  ): Promise<CheckoutView> {
    const booking = await bookingService.findBookingForUser(rawBookingId, userId);

    if (booking.status === "PAID") {
      throw new ApiError(409, "Esta reserva ya está pagada.");
    }

    if (booking.status === "CANCELLED") {
      throw new ApiError(
        409,
        "Esta reserva está cancelada y no se puede pagar."
      );
    }

    const last = await paymentRepository.findLastForBooking(booking.id);

    if (last && isReusable(last)) {
      return toCheckoutView(last);
    }

    const created = await paymentRepository.create({
      quotationId: randomUUID(),
      bookingId: booking.id,
      amount: booking.totalPrice.toFixed(2),
      currency: MERCADOPAGO_CURRENCY,
    });

    return toCheckoutView(created);
  },

  /**
   * Crea (o recupera) la preferencia de Checkout Pro y devuelve la URL a la
   * que hay que mandar al comprador.
   *
   * Si la cotización ya tiene preferencia se devuelve la misma: por eso dos
   * clics seguidos en el botón llevan al mismo checkout y no generan dos
   * pedidos en Mercado Pago.
   */
  async startCheckout(
    rawBookingId: string,
    userId: number
  ): Promise<CheckoutRedirect> {
    const { payment, booking } = await this.ensureQuotation(rawBookingId, userId);
    const stored = await paymentRepository.findByQuotationId(payment.quotationId);

    if (stored?.initPoint) {
      return { quotationId: stored.quotationId, initPoint: stored.initPoint };
    }

    const user = await userService.findById(userId);
    const baseUrl = getPublicBaseUrl();
    const now = Date.now();

    const preference: PreferenceRequest = {
      items: [
        {
          id: `booking-${booking.id}`,
          title: booking.roomName,
          description: `Estadía del ${booking.startDate} al ${booking.endDate}`,
          category_id: "travels",
          // Una noche = una unidad: así el detalle que ve el comprador en
          // Mercado Pago muestra el mismo precio por noche que la web.
          quantity: booking.nights,
          unit_price: booking.pricePerNight,
          currency_id: payment.currency,
        },
      ],
      payer: { name: user?.name ?? undefined, email: user?.login ?? undefined },
      // El número de pedido con el que Mercado Pago nos va a hablar de vuelta.
      external_reference: payment.quotationId,
      statement_descriptor: "HOTEL DMC",
      metadata: {
        quotation_id: payment.quotationId,
        booking_id: booking.id,
        user_id: userId,
      },
      // `binary_mode` fuerza que el pago termine aprobado o rechazado, sin
      // estados intermedios en revisión: para una demo evita esperas largas.
      binary_mode: true,
      expires: true,
      expiration_date_from: toMercadoPagoDate(new Date(now)),
      expiration_date_to: toMercadoPagoDate(
        new Date(now + CHECKOUT_EXPIRATION_MINUTES * MS_PER_MINUTE)
      ),
    };

    /**
     * `back_urls` y `notification_url` solo se mandan si hay una base https
     * accesible desde internet: desde el 29/03/2025 Mercado Pago rechaza con
     * 400 cualquier URL http. En desarrollo, sin túnel, la preferencia se crea
     * igual y el flujo se apoya en la consulta directa a la API que hace la
     * página de resultado.
     */
    if (isPublicBaseUrlReachable()) {
      const returnUrl = `${baseUrl}/pago/${payment.quotationId}`;

      preference.back_urls = {
        success: returnUrl,
        failure: returnUrl,
        pending: returnUrl,
      };
      preference.auto_return = "approved";
      preference.notification_url = `${baseUrl}/api/payment/webhook`;
    }

    const created = await mercadoPagoClient.createPreference(
      preference,
      // Clave de idempotencia: el mismo quotationId devuelve siempre la misma
      // preferencia, aunque el pedido se repita por un reintento de red.
      payment.quotationId
    );

    const updated = await paymentRepository.attachPreference(
      payment.quotationId,
      { preferenceId: created.id, initPoint: created.init_point }
    );

    return {
      quotationId: updated.quotationId,
      initPoint: updated.initPoint ?? created.init_point,
    };
  },

  /**
   * Sincroniza una cotización preguntándole a Mercado Pago por su último pago.
   *
   * Es el camino que usa la página de retorno, y la red de seguridad para
   * cuando el webhook todavía no llegó (o cuando en desarrollo no hay un túnel
   * https que lo reciba): el usuario ve el resultado real en vez de un
   * "pendiente" eterno. Los errores se silencian porque esto es un "mejor
   * esfuerzo": si Mercado Pago no responde, la página igual tiene que pintarse.
   */
  async syncByQuotation(quotationId: string): Promise<void> {
    const stored = await paymentRepository.findByQuotationId(quotationId);

    if (!stored || isFinalPaymentStatus(stored.status)) return;

    try {
      const providerPayment =
        await mercadoPagoClient.findLastPaymentByQuotation(quotationId);

      if (providerPayment) {
        await applyProviderPayment(stored, providerPayment);
      }
    } catch (error) {
      console.error("[pagos] no se pudo sincronizar la cotización", {
        quotationId,
        error,
      });
    }
  },

  /**
   * Camino del webhook: Mercado Pago avisa "pasó algo con el pago N" y acá se
   * consulta ese pago para saber QUÉ pasó realmente.
   *
   * La notificación solo aporta el id; el estado nunca se toma de su cuerpo,
   * que podría venir manipulado.
   */
  async applyNotification(providerPaymentId: string): Promise<void> {
    const providerPayment = await mercadoPagoClient.getPayment(providerPaymentId);
    const quotationId = providerPayment.external_reference;

    if (!quotationId) {
      console.warn("[pagos] pago sin external_reference", { providerPaymentId });
      return;
    }

    const stored = await paymentRepository.findByQuotationId(quotationId);

    if (!stored) {
      console.warn("[pagos] cotización desconocida", { quotationId });
      return;
    }

    await applyProviderPayment(stored, providerPayment);
  },

  /**
   * Cotización de un usuario, para la pantalla de resultado. Igual que con las
   * reservas, se filtra por dueño: una cotización ajena responde 404.
   */
  async findCheckoutForUser(
    quotationId: string,
    userId: number
  ): Promise<CheckoutView> {
    const stored = await paymentRepository.findByQuotationId(quotationId);

    if (!stored || stored.booking.userId !== userId) {
      throw new ApiError(404, "La operación de pago no existe.");
    }

    return toCheckoutView(stored);
  },
};
