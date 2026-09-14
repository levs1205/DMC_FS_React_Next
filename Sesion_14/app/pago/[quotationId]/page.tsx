/**
 * Ruta: "/pago/[quotationId]" (retorno público desde Mercado Pago)
 *
 * Esta pantalla existe por un detalle de cookies que, si no se tiene en
 * cuenta, arruina el final del flujo.
 *
 * El refresh token viaja en una cookie `SameSite=Strict` (defensa contra
 * CSRF). Los navegadores NO mandan ese tipo de cookie cuando la navegación
 * nace en otro sitio, y volver de mercadopago.com es exactamente eso. Si
 * Mercado Pago redirigiera directo a una URL de /intranet y el access token ya
 * hubiera vencido —dura 15 minutos, y pagar puede llevar más— el proxy vería
 * "sin sesión", no encontraría el refresh token y mandaría al login justo
 * después de pagar.
 *
 * Por eso el retorno cae en esta página PÚBLICA, que no muestra ningún dato
 * privado, y desde acá se salta a la zona privada con una navegación del mismo
 * sitio, que sí lleva la cookie Strict y permite renovar la sesión.
 *
 * De paso se aprovecha el viaje para sincronizar el pago contra la API de
 * Mercado Pago: cuando el alumno llega a la pantalla de resultado, el estado
 * ya está actualizado aunque el webhook todavía no haya llegado.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "./page.css";
import { isQuotationId } from "@/modules/payments/payment.quotation";
import { paymentService } from "@/modules/payments/payment.service";
import { RedirectToResult } from "./redirect-to-result";

// Es una URL de paso, no una página de contenido: fuera del índice.
export const metadata: Metadata = {
  title: "Confirmando tu pago",
  robots: { index: false, follow: false },
};

export default async function PaymentReturnPage({
  params,
}: PageProps<"/pago/[quotationId]">) {
  const { quotationId } = await params;

  if (!isQuotationId(quotationId)) notFound();

  /**
   * `syncByQuotation` es seguro de ejecutar sin sesión: no recibe ni devuelve
   * datos del usuario, solo actualiza la cotización con lo que responde
   * Mercado Pago. Y el `quotationId` es un UUID v4: no se adivina.
   */
  await paymentService.syncByQuotation(quotationId);

  const resultPath = `/intranet/pagos/${quotationId}`;

  return (
    <section className="payment-return">
      <RedirectToResult href={resultPath} />

      <p className="payment-return__text">Confirmando tu pago...</p>

      {/* Si el JavaScript está deshabilitado o tarda, el enlace hace lo mismo. */}
      <Link className="payment-return__link" prefetch={false} href={resultPath}>
        Ver el resultado
      </Link>
    </section>
  );
}
