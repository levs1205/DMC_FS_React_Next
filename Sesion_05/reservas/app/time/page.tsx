/**
 * Ruta: "/time"
 * Renderizado: Static Rendering (SSG), el modo por defecto del App Router.
 * La hora se calcula UNA sola vez en build time: al refrescar el navegador
 * la hora NO cambia hasta el próximo "next build"/deploy.
 */
function Time() {
    const currentTime = new Date().toLocaleTimeString();
    
    return ( <>
    <h1>{ currentTime }</h1>
    </> );
}

export default Time;