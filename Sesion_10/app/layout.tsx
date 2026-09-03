/**
 * Layout raíz obligatorio de la app (app/layout.tsx).
 * Envuelve TODAS las páginas del proyecto (comparte <html>/<body>, fuentes, etc.).
 * Se renderiza como Server Component y no se vuelve a montar entre navegaciones,
 * por eso su estado se preserva al cambiar de ruta.
 *
 * Es además la raíz del SEO: acá se define la metadata POR DEFECTO que heredan
 * todas las rutas. Cada página después sobreescribe solo lo suyo.
 */
import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/lib/seo/site.config";
import { logoutAction } from "@/modules/auth/auth.actions";
import { getSessionUser } from "@/modules/auth/auth.session";
import { USER_ROLE_LABELS } from "@/modules/users/user.labels";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  /**
   * `metadataBase` es la base para toda URL relativa que aparezca en la
   * metadata (canonical, imágenes de Open Graph...). Sin esto, Next avisa en
   * consola y las redes sociales reciben rutas relativas que no pueden abrir.
   */
  metadataBase: new URL(siteConfig.url),

  /**
   * `template` se aplica a las páginas HIJAS: cada una define su título corto
   * ("Habitaciones") y acá se le agrega la marca → "Habitaciones | Hotel DMC".
   * `default` es el título de las rutas que no definen ninguno.
   */
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: "Hotel DMC" }],

  // Canónica del sitio. Cada página define la suya y pisa a esta.
  alternates: { canonical: "/" },

  // Open Graph: lo que se ve al pegar el enlace en WhatsApp, LinkedIn, etc.
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    url: "/",
    locale: siteConfig.locale,
  },

  // X/Twitter reutiliza el Open Graph; solo hace falta declarar el formato.
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
  },

  /**
   * Indexable por defecto. `max-image-preview: large` es lo que habilita la
   * miniatura grande en los resultados de Google; `max-snippet: -1` deja que
   * el buscador use el fragmento de texto que quiera.
   */
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

// `themeColor` ya no va en `metadata`: desde Next 14 vive en el export
// `viewport` (es la barra del navegador en móvil, no una etiqueta de SEO).
export const viewport: Viewport = {
  themeColor: "#111827",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Al leer la cookie de sesión el layout pasa a renderizarse por request:
  // es lo que permite mostrar quién está conectado en todas las páginas.
  // Se usa `getSessionUser` porque el header muestra el rol, y el rol vive en
  // la base de datos, no en el token.
  const session = await getSessionUser();

  return (
    // `lang` correcto: le dice al buscador (y al lector de pantalla) en qué
    // idioma está el contenido. Estaba en "en" con la página en español.
    <html
      lang="es-PE"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        {/* <header> del sitio: cabecera de la página, no un div cualquiera. */}
        <header className="site-header">
          <Link href="/" className="site-header__brand">
            <Image
              src="/logo.png"
              alt="Hotel DMC"
              width={328}
              height={61}
              priority
              className="site-header__logo"
            />
          </Link>

          {/* <nav> marca el bloque de navegación principal; los <Link> son
              <a href> reales, así que el crawler los sigue y descubre las
              páginas públicas. */}
          <nav className="site-nav" aria-label="Navegación principal">
            <ul className="site-nav__list">
              <li>
                <Link href="/habitaciones">Habitaciones</Link>
              </li>
              <li>
                <Link href="/hotel">El hotel</Link>
              </li>
            </ul>
          </nav>

          {session && (
            <div className="site-header__session">
              <span className="site-header__user">
                {session.name ?? "Usuario"}
                <span className="site-header__role">
                  {USER_ROLE_LABELS[session.role]}
                </span>
              </span>

              {/* Server Action: cierra sesión sin necesidad de JavaScript. */}
              <form action={logoutAction}>
                <button type="submit" className="site-header__logout">
                  Cerrar sesión
                </button>
              </form>
            </div>
          )}
        </header>

        {/* <main>: el contenido único de cada página. Uno solo por documento. */}
        <main className="site-main">{children}</main>

        {/* <footer> con los datos de contacto en HTML plano: el mismo dato que
            el JSON-LD declara para el buscador tiene que estar visible para
            la persona. Datos ocultos = penalización. */}
        <footer className="site-footer">
          <address className="site-footer__address">
            {siteConfig.address.street}, {siteConfig.address.city},{" "}
            {siteConfig.address.region} ·{" "}
            <a href={`tel:${siteConfig.telephone.replace(/\s/g, "")}`}>
              {siteConfig.telephone}
            </a>{" "}
            ·{" "}
            <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
          </address>
          <p className="site-footer__legal">
            © {new Date().getFullYear()} {siteConfig.name}
          </p>
        </footer>
      </body>
    </html>
  );
}
