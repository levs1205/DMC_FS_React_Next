import type { Metadata } from "next";

/**
 * El layout existe solo para poner la metadata del login.
 *
 * `app/login/page.tsx` es un Client Component ("use client") y los Client
 * Components NO pueden exportar `metadata`: Next la resuelve en el servidor,
 * antes de renderizar. El patrón es este: un layout (o una page) de servidor
 * que declara la metadata y adentro el componente interactivo.
 *
 * Un formulario de acceso no aporta nada en los resultados de búsqueda, así
 * que se marca como no indexable.
 */
export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Acceso al panel de reservas del Hotel DMC.",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: LayoutProps<"/login">) {
  return children;
}
