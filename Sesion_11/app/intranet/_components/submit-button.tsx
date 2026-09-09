/**
 * Botón de envío que se deshabilita solo mientras corre la Server Action.
 *
 * `useFormStatus` lee el estado del <form> más cercano, así que el formulario
 * puede seguir siendo un Server Component: el único trozo de cliente es este
 * botón. Sin esto, el alumno puede hacer doble clic en "Pagar" mientras se
 * crea la preferencia (que igual es idempotente, pero la espera sin feedback
 * se siente como que la página se colgó).
 */
"use client";

import { useFormStatus } from "react-dom";

interface SubmitButtonProps {
  className?: string;
  children: React.ReactNode;
  pendingLabel: string;
}

export function SubmitButton({
  className,
  children,
  pendingLabel,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
