/**
 * Ruta: "/" (raíz del App Router).
 * Renderizado: Server Component (por defecto) -> Static Rendering (SSG).
 * No usa datos dinámicos, así que Next.js pre-renderiza el HTML en build time.
 */
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        hello world
      </main>
    </div>
  );
}
