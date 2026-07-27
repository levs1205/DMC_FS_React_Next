// ============================================================
// 02_b.ts  —  Los mismos casos, ahora con TypeScript
// Ejecutar:  npx tsc --noEmit && node --experimental-strip-types 02_b.ts
// ============================================================

// 1) Cada parámetro declara su tipo
function greet(name: string, age: number): string {
  return `Hola ${name}, tienes ${age} años`;
}

console.log(greet("Lincoln", 38));
// console.log(greet(123, "treinta")); // Error: Argument of type 'number' is not assignable to parameter of type 'string'
// console.log(greet("Ana"));          // Error: Expected 2 arguments, but got 1
// console.log(greet("Ana", 30, "Lima")); // Error: Expected 2 arguments, but got 3

// 2) Parámetro OPCIONAL con "?" -> el tipo pasa a ser number | undefined
function greetOptional(name: string, age?: number): string {
  // TS obliga a contemplar el caso undefined antes de usarlo
  return age === undefined
    ? `Hola ${name}`
    : `Hola ${name}, tienes ${age} años`;
}

console.log(greetOptional("Ana"));
console.log(greetOptional("Ana", 30));

// 3) Valor por defecto: el tipo se infiere y el parámetro queda opcional al llamar
function calculateTotal(price: number, taxRate: number = 0.18): number {
  return price + price * taxRate;
}

console.log(calculateTotal(100)); // 118
// console.log(calculateTotal("100"));         // Error atrapado ANTES de ejecutar: el bug de JS ya no compila

// 4) Rest tipado: todos los argumentos extra deben ser números
function sum(...numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}

console.log(sum(1, 2, 3)); // 6
// console.log(sum(1, "2", 3));         // Error: 'string' no es asignable a 'number'

// 5) Objeto como parámetro con contrato explícito
interface Booking {
  name: string;
  date: Date;
  dateEnd: Date;
  origin?: string; // opcional
}

function registerBooking({ name, date, dateEnd, origin }: Booking): string {
  return `${name}: ${date.toISOString()} -> ${dateEnd.toISOString()} (${origin ?? "sin origen"})`;
}

console.log(registerBooking({ name: "Lincoln", date: new Date("2024-01-01"), dateEnd: new Date("2024-01-10") }));
// console.log(registerBooking({ name: "Lincoln", from: new Date("2024-01-01"), to: new Date("2024-01-10") }));
// Error: 'from' no existe en el tipo 'Booking'  <- el typo se detecta al escribir

// 6) Extra: unión de tipos para aceptar más de un tipo, pero de forma controlada
function formatId(id: string | number): string {
  return typeof id === "number" ? `ID-${id.toFixed(0)}` : id.toUpperCase();
}

console.log(formatId(45));      // ID-45
console.log(formatId("lim45")); // LIM45

// Conclusión TS: los mismos errores existen, pero se ven al ESCRIBIR el código y el compilador nos avisa antes de ejecutar, evitando bugs en tiempo de ejecución.