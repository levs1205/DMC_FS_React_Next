/**
 * Botón + <dialog> con el motivo por el que Mercado Pago no cobró.
 *
 * Es un Client Component porque `<dialog>` se abre de forma imperativa
 * (`showModal()` es lo que activa el fondo oscuro, el foco atrapado y el
 * cierre con Escape). Se usa tanto en el listado de reservas como en la
 * pantalla de resultado, así que vive en `_components`: las carpetas que
 * empiezan con guion bajo quedan fuera del enrutador.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./payment-error-dialog.css";
import { describePaymentDetail } from "@/modules/payments/payment.labels";

interface PaymentErrorDialogProps {
  quotationId: string;
  statusDetail: string | null;
  providerPaymentId: string | null;
  /** Texto del botón que abre el diálogo. */
  label?: string;
}

export function PaymentErrorDialog({
  quotationId,
  statusDetail,
  providerPaymentId,
  label = "Ver por qué falló",
}: PaymentErrorDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const close = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        className="payment-error__trigger"
        onClick={() => setIsOpen(true)}
      >
        {label}
      </button>

      <dialog
        ref={dialogRef}
        className="payment-error"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <h2 className="payment-error__title">El pago no se completó</h2>

        <p className="payment-error__text">
          {describePaymentDetail(statusDetail)}
        </p>

        {/* Los códigos crudos van al final y en letra chica: al alumno le
            sirve el texto de arriba, pero estos datos son los que pide el
            soporte de Mercado Pago si hay que reclamar. */}
        <dl className="payment-error__meta">
          <div>
            <dt>N.º de pedido</dt>
            <dd>{quotationId}</dd>
          </div>
          {providerPaymentId && (
            <div>
              <dt>N.º de pago</dt>
              <dd>{providerPaymentId}</dd>
            </div>
          )}
          {statusDetail && (
            <div>
              <dt>Código</dt>
              <dd>{statusDetail}</dd>
            </div>
          )}
        </dl>

        <div className="payment-error__actions">
          <button
            type="button"
            className="payment-error__button"
            onClick={close}
          >
            Entendido
          </button>
        </div>
      </dialog>
    </>
  );
}
