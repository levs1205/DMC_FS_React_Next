// ============================================================
// 04_a.js  —  Diseño de estados en JavaScript
// Modelamos el estado de una petición (idle / loading / success / error)
// Ejecutar:  node 04_a.js
// ============================================================

// Simulamos la carga de un usuario (sin red, para la clase)
function loadUser(id) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (id > 0) resolve({ id, name: "Leanne Graham" });
      else reject(new Error("Usuario inválido"));
    }, 300);
  });
}

// 1) El clásico: un objeto con banderas booleanas sueltas
let state = {
  isLoading: false,
  isError: false,
  data: null,
  error: null,
};

// 2) Nada impide armar combinaciones que NO deberían existir
const impossibleState = {
  isLoading: true,   // cargando...
  isError: true,     // ...y con error al mismo tiempo
  data: { id: 1, name: "Leanne Graham" }, // ...y con datos
  error: "Se cayó la API",
};
console.log("Estado imposible, pero JS lo acepta:", impossibleState);

// 3) Las transiciones son manuales: si olvidas limpiar un campo, queda basura
function startLoading() {
  state = { ...state, isLoading: true }; // BUG: no limpia error ni isError anteriores
}

function setSuccess(data) {
  state = { isLoading: false, isError: false, data, error: null };
}

function setError(message) {
  state = { isLoading: false, isError: true, data: null, error: message };
}

// 4) Al leer el estado, el ORDEN de los if decide qué se muestra
function render(s) {
  if (s.isLoading) return "Cargando...";
  if (s.isError) return `Error: ${s.error}`;
  if (s.data) return `Usuario: ${s.data.name}`;
  return "Sin datos";
}

// 5) Variante con string suelto: el typo no lo detecta nadie
function renderByStatus(s) {
  switch (s.status) {
    case "loading":
      return "Cargando...";
    case "sucess": // typo: nunca va a entrar aquí
      return `Usuario: ${s.data.name}`;
    case "error":
      return `Error: ${s.error}`;
    default:
      return "Sin datos";
  }
}

async function main() {
  try {
    setError("Se cayó la API"); // error previo
    startLoading();             // "recargamos"...
    console.log("Estado real:", state);
    // { isLoading: true, isError: true, data: null, error: 'Se cayó la API' }
    // -> cargando Y con error a la vez; render() lo tapa por el orden de los if
    console.log("Se ve:", render(state));

    const user = await loadUser(1);
    setSuccess(user);
    console.log("Se ve:", render(state));

    console.log("Con string:", renderByStatus({ status: "success", data: user }));
    // "Sin datos" <- por el typo "sucess", cae al default sin avisar
  } catch (error) {
    console.error(error.message);
  }
}

main();

// Conclusión JS: el estado permite combinaciones imposibles y typos silenciosos;
// la disciplina depende 100% del programador.