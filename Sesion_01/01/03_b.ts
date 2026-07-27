// ============================================================
// 03_b.ts  —  El mismo consumo de API, ahora con TypeScript
// Ejecutar:  npx tsc --noEmit && node --experimental-strip-types 03_b.ts
// ============================================================

const BASE_URL = "https://jsonplaceholder.typicode.com";

// 1) Describimos la forma de los datos externos ANTES de usarlos
interface Company {
  name: string;
  catchPhrase: string;
}

interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  phone?: string; // opcional: puede no venir
  company: Company;
}

interface Post {
  id: number;
  userId: number;
  title: string;
  body: string;
}

// 2) response.json() devuelve Promise<any>: TS no adivina la forma,
//    el "as User" es una promesa que hace el programador.
async function getUser(id: number): Promise<User> {
  const response = await fetch(`${BASE_URL}/users/${id}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} al pedir el usuario ${id}`);
  }
  return (await response.json()) as User;
}

// 3) Función genérica: un solo fetch tipado para cualquier recurso
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} en ${url}`);
  }
  return (await response.json()) as T;
}

// 4) Con el tipo puesto hay autocompletado y los typos se ven al escribir
function describeUser(user: User): string {
  // user.phone es string | undefined -> TS obliga a contemplar el caso
  const phone = user.phone ?? "sin teléfono";
  return `${user.name} (${user.email}) - ${phone} - empresa: ${user.company.name}`;
  // user.mail;         // Error: Property 'mail' does not exist on type 'User'
  // user.company.ruc;  // Error: Property 'ruc' does not exist on type 'Company'
}

// 5) OJO: "as" no valida nada en tiempo de ejecución.
//    Para datos externos reales conviene un type guard.
function isUser(value: unknown): value is User {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "number" &&
    typeof candidate.name === "string" &&
    typeof candidate.email === "string" &&
    typeof candidate.company === "object" &&
    candidate.company !== null
  );
}

async function getUserValidated(id: number): Promise<User> {
  const data: unknown = await fetchJson<unknown>(`${BASE_URL}/users/${id}`);
  if (!isUser(data)) {
    throw new Error(`La respuesta no tiene la forma esperada de User`);
  }
  return data; // recién aquí TS lo trata como User
}

async function main(): Promise<void> {
  const user = await getUser(1);
  console.log(describeUser(user));

  // user.userName; // Error: ¿quisiste decir 'username'?

  const posts = await fetchJson<Post[]>(`${BASE_URL}/posts?userId=1`);
  console.log(posts.slice(0, 2).map((post) => post.title.toUpperCase()));

  const validated = await getUserValidated(1);
  console.log("Validado en runtime:", validated.username);

  try {
    await getUser(9999); // 404
  } catch (error) {
    // En modo strict, "error" es unknown: hay que estrecharlo antes de usarlo
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error controlado:", message);
  }
}

main();

// Conclusión TS: la interface documenta el contrato de la API y detecta typos
// al escribir, pero solo el type guard garantiza que el dato real cumple.