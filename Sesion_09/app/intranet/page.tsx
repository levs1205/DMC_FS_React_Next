/**
 * Ruta: "/intranet"
 * Server Component: el layout ya garantizó que hay sesión con rol STUDENT,
 * así que acá solo se lee para saludar por el nombre.
 */
import { getSession } from "@/modules/auth/auth.session";

async function IntranetPage() {
  const session = await getSession();

  return (
    <section className="intranet">
      <h1 className="intranet__title">Intranet del Hotel</h1>
      <p className="intranet__text">
        ¡Bienvenido{session?.name ? `, ${session.name}` : ""}! Acá vas a ver tus
        cursos y comunicados.
      </p>
    </section>
  );
}

export default IntranetPage;
