// ============================================================
// 01_b.ts  —  Renombrar propiedades en TypeScript respecto a JavaScript
// Ejecutar:  npx tsc --noEmit && node --experimental-strip-types 01_b.ts
// ============================================================

// 1) En TS podemos renombrar propiedades de un objeto, pero debemos declarar un contrato explícito
interface  Booking {
    name: string;
    //user: string; // <- si renombramos la propiedad, el compilador nos avisará
}

const booking: Booking = {
    name: "lizeth"
};

console.log(booking.name); // En un principio no hay problema, pero si renombramos la propiedad, el compilador nos avisará y no compilará