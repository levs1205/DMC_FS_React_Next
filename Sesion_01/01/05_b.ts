// ============================================================
// 05_b.ts  —  Refactorización MASIVA con TypeScript
// Ejecutar:  npx tsc --noEmit && node --experimental-strip-types 05_b.ts
// ============================================================

// ---------- CONTRATO DE LOS COMPONENTES ----------
// Un solo lugar define la forma de las props. Cambiarlo aquí
// hace que el compilador señale TODOS los usos afectados.

type Variant = "primary" | "secondary" | "danger";
type Size = "sm" | "md" | "lg";

interface BaseProps {
  variant: Variant;
  size: Size;
}

interface ButtonProps extends BaseProps {
  text: string; // antes se llamaba "label"
}

interface IconButtonProps extends ButtonProps {
  icon: string;
}

interface CardProps {
  title: string;
  body: string;
  action?: ButtonProps; // opcional
}

interface ModalProps {
  title: string;
  body: string;
  confirmButton: ButtonProps;
  cancelButton: ButtonProps;
}

// ---------- LIBRERÍA DE COMPONENTES ----------

function Button(props: ButtonProps): string {
  return `<button class="btn btn-${props.variant} btn-${props.size}">${props.text}</button>`;
}

function IconButton(props: IconButtonProps): string {
  return `<button class="btn btn-${props.variant} btn-${props.size}" aria-label="${props.text}">
  <i class="icon-${props.icon}"></i>
</button>`;
}

function Card(props: CardProps): string {
  return `<div class="card">
  <h3>${props.title}</h3>
  <p>${props.body}</p>
  ${props.action ? Button(props.action) : ""}
</div>`;
}

function Modal(props: ModalProps): string {
  return `<dialog>
  <h2>${props.title}</h2>
  ${props.body}
  ${Button(props.confirmButton)}
  ${Button(props.cancelButton)}
</dialog>`;
}

// ---------- LUGARES DE USO (call sites) ----------

function renderToolbar(): string {
  return [
    Button({ text: "Guardar", variant: "primary", size: "md" }),
    Button({ text: "Cancelar", variant: "secondary", size: "md" }),
    IconButton({ text: "Eliminar", icon: "trash", variant: "danger", size: "sm" }),
  ].join("\n");
}

function renderDashboard(): string {
  return Card({
    title: "Vuelos de hoy",
    body: "128 operaciones registradas",
    action: { text: "Ver detalle", variant: "primary", size: "md" },
    // action: { label: "Ver detalle", variant: "primary", size: "md" },
    // Error: Object literal may only specify known properties,
    //        and 'label' does not exist in type 'ButtonProps'
  });
}

function renderCheckout(): string {
  return Modal({
    title: "Confirmar operación",
    body: "<p>¿Desea continuar?</p>",
    confirmButton: { text: "Sí, continuar", variant: "primary", size: "lg" },
    cancelButton: { text: "Volver", variant: "secondary", size: "md" },
    // cancelButton: { text: "Volver", variant: "secondary" },
    // Error: Property 'size' is missing in type ... but required in type 'ButtonProps'
  });
}

function renderAlert(): string {
  return Button({ text: "Reintentar", variant: "danger", size: "md" });
  // variant: "danger " -> Error: Type '"danger "' is not assignable to type 'Variant'
}

// ---------- UTILIDADES QUE ACOMPAÑAN AL REFACTOR ----------

// Omit / Pick: derivar variantes del contrato sin duplicarlo.
// Un botón dentro de una barra ya hereda el tamaño del contenedor:
type ToolbarButtonProps = Omit<ButtonProps, "size">;

function ToolbarButton(props: ToolbarButtonProps): string {
  return Button({ ...props, size: "sm" });
}

// Migración gradual: se puede marcar la prop vieja como deprecated
// y opcional, para que el equipo migre por partes sin romper el build.
interface LegacyButtonProps extends BaseProps {
  /** @deprecated usar "text" */
  label?: string;
  text?: string;
}

function LegacyButton(props: LegacyButtonProps): string {
  const text = props.text ?? props.label ?? "";
  return Button({ ...props, text });
}

console.log(renderToolbar());
console.log(renderDashboard());
console.log(renderCheckout());
console.log(renderAlert());
console.log(ToolbarButton({ text: "Exportar", variant: "secondary" }));
console.log(LegacyButton({ label: "Botón antiguo", variant: "primary", size: "md" }));

// Conclusión TS: el contrato vive en un solo lugar. Al cambiarlo, el compilador
// arma la lista completa de usos rotos y el refactor se vuelve mecánico:
// corregir hasta que "tsc" quede en cero errores.