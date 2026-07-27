// ============================================================
// 01_a.js  —  Renombrar propiedades en TypeScript respecto a JavaScript
// Ejecutar:  node 01_a.js
// ============================================================

// 1) En JS podemos renombrar propiedades de un objeto sin problema
let booking = {
    name: "lincoln",
    //user: "lincoln",
};

console.log(booking.name); // En un principio no hay problema, pero si renombramos la propiedad, el código se ejecutará sin errores, pero no funcionará como esperamos