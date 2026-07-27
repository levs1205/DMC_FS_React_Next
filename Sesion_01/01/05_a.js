// ============================================================
// 05_a.js  —  Refactorización INDIVIDUAL en JavaScript
// Un "componente" = función que recibe props y devuelve HTML
// Ejecutar:  node 05_a.js
// ============================================================

// ---------- LIBRERÍA DE COMPONENTES ----------

// Ya aplicamos el refactor: la prop "label" ahora se llama "text",
// y agregamos la prop obligatoria "size".
function Button(props) {
  return `<button class="btn btn-${props.variant} btn-${props.size}">${props.text}</button>`;
}

function IconButton(props) {
  return `<button class="btn btn-${props.variant} btn-${props.size}" aria-label="${props.text}">
  <i class="icon-${props.icon}"></i>
</button>`;
}

function Card(props) {
  return `<div class="card">
  <h3>${props.title}</h3>
  <p>${props.body}</p>
  ${props.action ? Button(props.action) : ""}
</div>`;
}

function Modal(props) {
  return `<dialog>
  <h2>${props.title}</h2>
  ${props.body}
  ${Button(props.confirmButton)}
  ${Button(props.cancelButton)}
</dialog>`;
}

// ---------- LUGARES DE USO (call sites) ----------

function renderToolbar() {
  return [
    Button({ text: "Guardar", variant: "primary", size: "md" }),
    Button({ text: "Cancelar", variant: "secondary", size: "md" }),
    IconButton({ text: "Eliminar", icon: "trash", variant: "danger", size: "sm" }),
  ].join("\n");
}

function renderDashboard() {
  return Card({
    title: "Reservas de hoy",
    body: "128 reservas registradas",
    // BUG 1: este uso quedó sin migrar, sigue mandando "label"
    action: { label: "Ver detalle", variant: "primary", size: "md" },
  });
}

function renderCheckout() {
  return Modal({
    title: "Confirmar operación",
    body: "<p>¿Desea continuar?</p>",
    confirmButton: { text: "Sí, continuar", variant: "primary", size: "lg" },
    // BUG 2: nos olvidamos de agregar "size" en este uso
    cancelButton: { text: "Volver", variant: "secondary" },
  });
}

// BUG 3: typo en el variant, nadie lo detecta
function renderAlert() {
  return Button({ text: "Reintentar", variant: "danger ", size: "md" });
}

console.log(renderToolbar());
console.log(renderDashboard()); // >undefined</button>  <- prop vieja
console.log(renderCheckout()); // btn-undefined         <- prop faltante
console.log(renderAlert()); // btn-danger  (con espacio) <- clase inválida

// Conclusión JS: el refactor es buscar y reemplazar a mano, archivo por archivo.
// Los usos que se escapan no fallan: renderizan "undefined" y siguen de largo.
// Con 4 componentes se puede revisar; con 200 componentes es imposible.