/**
 * Ruta: "/time3"
 * Renderizado: Client Component ("use client").
 * Se ejecuta en el navegador del usuario, por lo que la hora se recalcula
 * cada vez que el componente se monta/renderiza en el cliente (CSR).
 */
"use client";

function Time3() {
    const currentTime = new Date().toLocaleTimeString();
    
    return ( <>
    <h1>{ currentTime }</h1>
    </> );
}

export default Time3;