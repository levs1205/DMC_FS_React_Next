/**
 * Ruta dinámica: "/test/[id]" -> ej. /test/123, /test/abc
 * La carpeta "[id]" es un Dynamic Segment: cualquier valor en esa
 * posición de la URL se recibe en "params.id".
 * Renderizado: Server Component; al depender de "params" (dato que llega
 * en cada request) se resuelve con Dynamic Rendering.
 */
interface TestProps {
  params: { id: string };
}

async function Test({ params }: TestProps) {
    const {id} = await params;
    return ( <><div>Hola Usuario Id: {id}</div></> );
}

export default Test;