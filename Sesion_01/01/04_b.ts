// ============================================================
// 04_b.ts  —  Diseño de estados con TypeScript
// Ejecutar:  npx tsc --noEmit && node --experimental-strip-types 04_b.ts
// ============================================================

interface User {
  id: number;
  name: string;
}

function loadUser(id: number): Promise<User> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (id > 0) resolve({ id, name: "Leanne Graham" });
      else reject(new Error("Usuario inválido"));
    }, 300);
  });
}

// 1) UNIÓN DISCRIMINADA: cada estado lista SOLO los campos que le corresponden.
//    El campo "status" es el discriminante.
type RequestState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string };

// 2) Los estados imposibles ya no se pueden ni escribir
// const impossibleState: RequestState<User> = {
//   status: "loading",
//   data: { id: 1, name: "Leanne Graham" }, // Error: 'data' no existe en { status: "loading" }
// };
// const typo: RequestState<User> = { status: "sucess", data: user };
//   Error: Type '"sucess"' is not assignable to '"idle" | "loading" | "success" | "error"'

// 3) Transiciones tipadas: devolver un estado nuevo, nunca mutar campos sueltos
function toLoading<T>(): RequestState<T> {
  return { status: "loading" }; // imposible arrastrar el error anterior
}

function toSuccess<T>(data: T): RequestState<T> {
  return { status: "success", data };
}

function toError<T>(error: string): RequestState<T> {
  return { status: "error", error };
}

// 4) Al leer, TS estrecha el tipo (narrowing): .data solo existe dentro de "success"
function render(state: RequestState<User>): string {
  switch (state.status) {
    case "idle":
      return "Sin datos";
    case "loading":
      return "Cargando...";
      // state.data;  // Error: 'data' no existe en este caso
    case "success":
      return `Usuario: ${state.data.name}`; // aquí sí existe, y con autocompletado
    case "error":
      return `Error: ${state.error}`;
    default:
      // 5) EXHAUSTIVIDAD: si mañana agregamos { status: "refreshing" } a la unión,
      //    este assertNever falla al COMPILAR y nos señala el switch incompleto.
      return assertNever(state);
  }
}

function assertNever(value: never): never {
  throw new Error(`Estado no contemplado: ${JSON.stringify(value)}`);
}

async function main(): Promise<void> {
  let state: RequestState<User> = { status: "idle" };
  console.log("Se ve:", render(state));

  state = toError<User>("Se cayó la API");
  console.log("Se ve:", render(state));

  state = toLoading<User>(); // el error anterior desaparece por construcción
  console.log("Estado real:", state); // { status: 'loading' }
  console.log("Se ve:", render(state));

  try {
    const user = await loadUser(1);
    state = toSuccess(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state = toError<User>(message);
  }

  console.log("Se ve:", render(state));
}

main();

// Conclusión TS: el tipo hace que los estados inválidos NO se puedan representar,
// y el compilador obliga a cubrir todos los casos al leerlos.