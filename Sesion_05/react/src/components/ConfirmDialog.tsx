// ============================================================================
// ConfirmDialog — dialog box de confirmación (presentacional, reutilizable)
// ============================================================================
// Usa el elemento nativo <dialog> (showModal/close) para evitar dependencias
// externas. Se controla por props: el padre decide cuándo está `abierto` y
// qué pasa al confirmar/cancelar.

import { useEffect, useRef } from 'react';
import './ConfirmDialog.css';

export interface ConfirmDialogProps {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ConfirmDialog({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (abierto && !dialog.open) {
      dialog.showModal();
    } else if (!abierto && dialog.open) {
      dialog.close();
    }
  }, [abierto]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      onCancel={(evento) => {
        evento.preventDefault();
        onCancelar();
      }}
    >
      <h2 className="confirm-dialog__titulo">{titulo}</h2>
      <p className="confirm-dialog__mensaje">{mensaje}</p>
      <div className="confirm-dialog__acciones">
        <button type="button" className="confirm-dialog__cancelar" onClick={onCancelar}>
          {textoCancelar}
        </button>
        <button type="button" className="confirm-dialog__confirmar" onClick={onConfirmar}>
          {textoConfirmar}
        </button>
      </div>
    </dialog>
  );
}
