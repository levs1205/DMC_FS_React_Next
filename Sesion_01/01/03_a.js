// ============================================================
// 03_a.js  —  Consumo de APIs en JavaScript
// API pública: https://jsonplaceholder.typicode.com
// Ejecutar:  node 03_a.js
// ============================================================

const BASE_URL = "https://jsonplaceholder.typicode.com";

// 1) fetch básico: la respuesta es una caja negra
async function getUser(id) {
  const response = await fetch(`${BASE_URL}/users/${id}`);
  const data = await response.json(); // <- no sabemos qué trae "data"
  return data;
}

// 2) fetch NO lanza error con 404 o 500: hay que controlarlo manualmente
async function getUserSafe(id) {
  const response = await fetch(`${BASE_URL}/users/${id}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} al pedir el usuario ${id}`);
  }
  return response.json();
}

// 3) Un typo en una propiedad no se detecta hasta ejecutar
function describeUser(user) {
  return `${user.name} (${user.email}) - empresa: ${user.company.name}`;
  // user.mail      -> undefined
  // user.Company.name -> TypeError en tiempo de ejecución
}

// 4) Listas: nada garantiza la forma de cada elemento
async function getPostTitles(userId) {
  const response = await fetch(`${BASE_URL}/posts?userId=${userId}`);
  const posts = await response.json();
  return posts.map((post) => post.title.toUpperCase());
  // si un post viniera sin "title" -> Cannot read properties of undefined
}

async function main() {
  const user = await getUser(1);
  console.log(describeUser(user));

  console.log(user.username); // Bret
  console.log(user.userName); // undefined <- el editor no avisa nada

  const titles = await getPostTitles(1);
  console.log(titles.slice(0, 2));

  try {
    await getUserSafe(9999); // usuario inexistente -> 404
  } catch (error) {
    console.error("Error controlado:", error.message);
  }
}

main();

// Conclusión JS: la API puede cambiar o devolver otra cosa
// y el código se entera recién cuando explota en producción.