/**
 * Ruta: "/time2"
 * Renderizado: Static Rendering + ISR (Incremental Static Regeneration).
 * "revalidate = 10" le indica a Next.js que regenere esta página en el
 * servidor como máximo cada 10 segundos; mientras tanto sirve la versión
 * cacheada (stale-while-revalidate), por eso la hora cambia "a saltos".
 */
export const revalidate = 10; 

function Time2() {
    const currentTime = new Date().toLocaleTimeString();
    
    return ( <>
    <h1>{ currentTime }</h1>
    </> );
}

export default Time2;