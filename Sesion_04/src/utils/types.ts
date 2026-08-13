// ============================================================================
// Modelado de dominio — Sistema de reservas de hoteles
// Taller 1: Modelado de dominio con TypeScript
// ============================================================================
// Estos tipos representan las entidades principales del negocio.
// Se definen ANTES de tocar React: primero el dominio, luego la UI.

/** Tipos de habitación que ofrece el hotel. */
export type TipoHabitacion = 'individual' | 'doble' | 'suite';

/** Estados posibles del ciclo de vida de una reserva. */
export type EstadoReserva = 'pendiente' | 'confirmada' | 'cancelada';

/** Rol del usuario dentro del sistema: define qué páginas puede visitar. */
export type RolUsuario = 'admin' | 'cliente';

/** Usuario que realiza una reserva. */
export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
}

/** Usuario mockeado junto a su contraseña, usado solo en la capa de autenticación simulada. */
export interface UsuarioConCredenciales {
  usuario: Usuario;
  password: string;
}

/** Catálogo de servicio: una habitación disponible para reservar. */
export interface Habitacion {
  id: string;
  nombre: string;
  tipo: TipoHabitacion;
  capacidad: number;
  precioPorNoche: number;
  descripcion: string;
}

/** Disponibilidad de una habitación para una fecha puntual (día). */
export interface Disponibilidad {
  habitacionId: string;
  /** Fecha en formato ISO corto: 'YYYY-MM-DD'. */
  fecha: string;
  disponible: boolean;
}

/** Reserva de una habitación realizada por un usuario. */
export interface Reserva {
  id: string;
  habitacionId: string;
  usuarioId: string;
  /** Fecha de entrada en formato ISO corto: 'YYYY-MM-DD'. */
  fechaInicio: string;
  /** Fecha de salida en formato ISO corto: 'YYYY-MM-DD'. */
  fechaFin: string;
  estado: EstadoReserva;
  precioTotal: number;
}
