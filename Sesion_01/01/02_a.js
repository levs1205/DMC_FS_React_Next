// ============================================================
// 02_a.js  —  Parámetros en JavaScript
// Ejecutar:  node 02_a.js
// ============================================================

// 1) Los parámetros NO tienen tipo: entra cualquier cosa
function greet(name, age) {
  return `Hola ${name}, tienes ${age}`;
}

console.log(greet("Lincoln", 38)); // Hola Lincoln, tienes 38
console.log(greet(123, "treinta")); // Hola 123, tienes treinta  <- no falla
console.log(greet("Ana")); // Hola Ana, tienes undefined <- falta un argumento y tampoco falla
console.log(greet("Ana", 30, "Lima")); // el tercer argumento simplemente se ignora

// 2) Valor por defecto (sí existe en JS moderno)
function calculateTotal(price, taxRate = 0.18) {
  return price + price * taxRate;
}

console.log(calculateTotal(100));   // 118
console.log(calculateTotal("100")); // "10018"  <- BUG: concatenó texto en vez de sumar

// 3) Como todo es opcional, hay que validar manualmente los parámetros
function calculateTotalSafe(price, taxRate = 0.18) {
  if (typeof price !== "number" || Number.isNaN(price)) {
    throw new TypeError("price debe ser un número");
  }
  return price + price * taxRate;
}

// 4) Cantidad variable de argumentos (rest)
function sum(...numbers) {
  return numbers.reduce((acc, n) => acc + n, 0);
}

console.log(sum(1, 2, 3));   // 6
console.log(sum(1, "2", 3)); // "123" <- otra vez concatenación silenciosa

// 5) Objeto como parámetro: no sabemos qué propiedades trae
function registerBooking({ name, date, dateEnd }) {
  return `${name}: ${date} -> ${dateEnd}`;
}

console.log(registerBooking({ name: "Lincoln", date: "2024-01-01", dateEnd: "2024-01-10" }));
console.log(registerBooking({ name: "Lincoln", from: "2024-01-01", to: "2024-01-10" }));
// "Lincoln: undefined -> undefined"  <- typo en las propiedades, error recién en tiempo de ejecución

// Conclusión JS: todos los errores aparecen al EJECUTAR, no al escribir.