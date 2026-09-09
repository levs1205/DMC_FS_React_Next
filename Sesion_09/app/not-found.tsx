import type { Metadata } from "next";
import Link from "next/link";

/**
 * app/not-found.tsx: la página que se muestra cuando una ruta no existe o
 * cuando un Server Component llama a `notFound()`.
 *
 * Next responde con status 404 de verdad. Eso es lo que importa para el SEO:
 * el crawler ve el 404 y saca la URL del índice, en lugar de guardar una
 * página "vacía pero con status 200" (soft 404).
 */
export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="home">
      <section className="home__hero">
        <h1 className="home__title">No encontramos esa página</h1>
        <p className="home__lead">
          Puede que el enlace esté viejo o que la habitación ya no se publique.
        </p>
        <p className="home__actions">
          <Link className="home__cta" href="/habitaciones">
            Ver habitaciones
          </Link>
          <Link className="home__link" href="/">
            Volver al inicio
          </Link>
        </p>
      </section>
    </div>
  );
}
