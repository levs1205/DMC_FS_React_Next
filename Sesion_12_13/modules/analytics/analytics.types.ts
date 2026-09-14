import type {
  BookingListItem,
  BookingStatus,
  RoomType,
} from "@/modules/bookings/booking.types";

/**
 * Contrato de lectura que va a consumir el agente (el futuro chatbot).
 *
 * Todo lo de este módulo es SOLO LECTURA y sobre un recorte deliberado de la
 * base: reservas, habitaciones y el nombre del alumno. Nada de contraseñas,
 * tokens ni identificadores de Mercado Pago. Cuando el modelo de IA redacte
 * la respuesta, solo puede contar lo que estas funciones le dejaron ver.
 */

/**
 * Contra qué fecha se compara el rango `from`/`to`. Es ambiguo en lenguaje
 * natural —"las reservas de octubre" pueden ser las que ENTRAN, las que SALEN
 * o las que se SOLAPAN con octubre— así que se decide explícitamente en vez
 * de adivinar.
 */
export const BOOKING_DATE_FIELDS = ["checkIn", "checkOut", "overlap"] as const;
export type BookingDateField = (typeof BOOKING_DATE_FIELDS)[number];

export const BOOKING_SORT_FIELDS = [
  "startDate",
  "endDate",
  "totalPrice",
  "id",
] as const;
export type BookingSortField = (typeof BOOKING_SORT_FIELDS)[number];

export const SORT_ORDERS = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/**
 * Los filtros que entienden TODOS los endpoints de analítica. El listado y
 * las estadísticas comparten exactamente este juego: así "dame las reservas
 * de Ana en octubre" y "dame el total de Ana en octubre" miran las mismas
 * filas y los números nunca se contradicen.
 */
export interface BookingFilters {
  /** Alumno exacto por id. Es el filtro fiable una vez resuelto el nombre. */
  studentId?: number;
  /** Búsqueda parcial por nombre o usuario, sin distinguir mayúsculas. */
  student?: string;
  roomId?: number;
  roomType?: RoomType[];
  status?: BookingStatus[];
  /** Rango de fechas inclusivo, en formato AAAA-MM-DD. */
  from?: string;
  to?: string;
  dateField: BookingDateField;
  /** Rango de importes sobre el total de la reserva. */
  minAmount?: number;
  maxAmount?: number;
}

export interface BookingSearchQuery extends BookingFilters {
  page: number;
  pageSize: number;
  sort: BookingSortField;
  order: SortOrder;
}

export interface BookingStatsQuery extends BookingFilters {
  /** Cuántas filas devuelven los rankings (alumnos y habitaciones). */
  top: number;
}

export interface StudentSearchQuery {
  q?: string;
  limit: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * La respuesta viaja con los filtros que se aplicaron de verdad. No es
 * decorativo: el chatbot tiene que poder decir "encontré 12 reservas de Ana
 * entre el 1 y el 31 de octubre" sin inventarse el criterio, y si el usuario
 * escribió un filtro que no existe, acá se ve que no se aplicó.
 */
export interface BookingSearchResult {
  filters: BookingFilters;
  pagination: Pagination;
  bookings: BookingListItem[];
}

/** Una fila de cualquier desglose: estado, tipo de habitación, mes... */
export interface StatsBucket {
  key: string;
  label: string;
  bookings: number;
  revenue: number;
  /** Porcentaje del importe total, ya calculado: los LLM no saben dividir. */
  share: number;
}

export interface StudentBucket extends StatsBucket {
  userId: number;
}

export interface BookingTotals {
  bookings: number;
  /** Alumnos distintos dentro del filtro. */
  students: number;
  nights: number;
  revenue: number;
  averageTicket: number;
  averageNights: number;
  minAmount: number | null;
  maxAmount: number | null;
  /** Primera y última fecha de entrada del conjunto filtrado. */
  firstCheckIn: string | null;
  lastCheckIn: string | null;
}

export interface BookingStats {
  filters: BookingFilters;
  totals: BookingTotals;
  byStatus: StatsBucket[];
  byRoomType: StatsBucket[];
  byMonth: StatsBucket[];
  topStudents: StudentBucket[];
  topRooms: StatsBucket[];
}

/** Ficha mínima de un alumno: sirve para resolver "Ana" → id 7. */
export interface StudentSummary {
  id: number;
  name: string | null;
  login: string | null;
  bookings: number;
  revenue: number;
  firstCheckIn: string | null;
  lastCheckIn: string | null;
}
