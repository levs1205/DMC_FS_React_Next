"use server";

import { redirect } from "next/navigation";
import { ApiError } from "@/lib/http/api-error";
import { requireRole } from "@/modules/auth/auth.session";
import { paymentService } from "@/modules/payments/payment.service";

/**
 * Server Action del botón "Pagar con Mercado Pago".
 *
 * Se eligió una Server Action y no un fetch desde el cliente por tres razones:
 *
 * 1. El access token de Mercado Pago solo sale del servidor.
 * 2. El botón funciona aunque el JavaScript todavía no haya hidratado: es un
 *    <form> de verdad.
 * 3. Next verifica el Origin de toda Server Action, así que la protección
 *    contra CSRF viene incluida.
 *
 * El `bookingId` llega por `bind` (no por un campo oculto del formulario) y,
 * de todos modos, el servicio comprueba que la reserva sea de quien la paga:
 * un id ajeno responde 404.
 */
export async function startCheckoutAction(bookingId: string): Promise<void> {
  const session = await requireRole("STUDENT");

  let initPoint: string;

  try {
    const checkout = await paymentService.startCheckout(bookingId, session.id);
    initPoint = checkout.initPoint;
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : "No se pudo iniciar el pago. Intentá nuevamente en unos minutos.";

    if (!(error instanceof ApiError)) console.error(error);

    // El error vuelve a la misma pantalla por la URL: así se puede mostrar sin
    // convertir la página en un Client Component solo para guardar un estado.
    redirect(
      `/intranet/reservas/${bookingId}/pago?error=${encodeURIComponent(message)}`
    );
  }

  // Fuera del try: `redirect` funciona lanzando una excepción interna, y un
  // catch la atraparía por error.
  redirect(initPoint);
}
