/**
 * Ruta: "/intranet"
 * Server Component: el layout ya garantizó que hay sesión con rol STUDENT,
 * así que acá solo se lee para saludar por el nombre y ofrecer los accesos
 * del flujo de reservas.
 */
import Link from "next/link";
import { getSession } from "@/modules/auth/auth.session";

async function IntranetPage() {
  const session = await getSession();

  return (
    <section className="intranet">
      <h1 className="intranet__title">Intranet del Hotel</h1>
      <p className="intranet__text">
        ¡Bienvenido{session?.name ? `, ${session.name}` : ""}! Desde acá podés
        reservar una habitación y pagarla online.
      </p>

      <p className="intranet__actions">
        <Link className="intranet__cta" href="/intranet/reservas/nueva">
          Reservar una habitación
        </Link>
        <Link className="intranet__link" href="/intranet/reservas">
          Ver mis reservas
        </Link>
      </p>
    </section>
  );
}

export default IntranetPage;
