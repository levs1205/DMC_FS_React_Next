import Joi from "joi";
import { BookingStatus, RoomType } from "@/lib/generated/prisma/enums";
import { parseIsoDate } from "@/modules/bookings/booking.dates";
import {
  BOOKING_DATE_FIELDS,
  BOOKING_SORT_FIELDS,
  SORT_ORDERS,
  type BookingSearchQuery,
  type BookingStatsQuery,
  type StudentSearchQuery,
} from "@/modules/analytics/analytics.types";

/**
 * Validación de la query string de los endpoints de analítica.
 *
 * El cliente de estos endpoints va a ser un modelo de IA, así que el esquema
 * cumple dos funciones: rechazar lo que no entiende —un LLM inventa nombres de
 * parámetros con total naturalidad— y devolver un mensaje de error que
 * explique qué valores sí existen, para que el agente pueda corregirse solo en
 * el siguiente intento.
 *
 * Los topes (`pageSize`, `top`) no son decoración: son el "leer información
 * limitada" del enunciado. Ninguna llamada puede vaciar la tabla de reservas
 * dentro del contexto del modelo.
 */

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_TOP = 20;

const BOOKING_STATUSES = Object.values(BookingStatus);
const ROOM_TYPES = Object.values(RoomType);

/**
 * Lista separada por comas (`status=PAID,PENDING`) validada contra un enum.
 * Se normaliza a mayúsculas porque el agente escribe lo que le dictó el
 * usuario, y "paid" es la misma intención que "PAID".
 */
function csvEnum<T extends string>(field: string, allowed: readonly T[]) {
  return Joi.string()
    .custom((raw: string, helpers) => {
      const items = raw
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean);

      if (items.length === 0) return helpers.error("any.invalid");

      for (const item of items) {
        if (!allowed.includes(item as T)) return helpers.error("any.invalid");
      }

      return [...new Set(items)];
    })
    .messages({
      "string.base": `El filtro "${field}" debe ser texto.`,
      "any.invalid": `El filtro "${field}" admite solo estos valores, separados por coma: ${allowed.join(
        ", "
      )}.`,
    });
}

/**
 * Fecha AAAA-MM-DD que además tiene que existir en el calendario.
 * A diferencia de las fechas de una reserva nueva, acá SÍ se admite el pasado:
 * casi todas las preguntas de estadística miran hacia atrás.
 */
function isoDateFilter(field: string) {
  return Joi.string()
    .custom((raw: string, helpers) =>
      parseIsoDate(raw) ? raw : helpers.error("any.invalid")
    )
    .messages({
      "string.base": `El filtro "${field}" debe ser texto.`,
      "any.invalid": `El filtro "${field}" debe ser una fecha real con formato AAAA-MM-DD.`,
    });
}

function positiveId(field: string) {
  return Joi.number().integer().positive().messages({
    "number.base": `El filtro "${field}" debe ser un número.`,
    "number.integer": `El filtro "${field}" debe ser un número entero.`,
    "number.positive": `El filtro "${field}" debe ser mayor que cero.`,
  });
}

function amount(field: string) {
  return Joi.number().min(0).messages({
    "number.base": `El filtro "${field}" debe ser un número.`,
    "number.min": `El filtro "${field}" no puede ser negativo.`,
  });
}

// Filtros comunes al listado y a las estadísticas: las dos preguntas miran
// siempre el mismo conjunto de reservas.
const bookingFilterKeys = {
  studentId: positiveId("studentId"),
  student: Joi.string().trim().max(120).messages({
    "string.base": 'El filtro "student" debe ser texto.',
    "string.max": 'El filtro "student" no puede superar los 120 caracteres.',
  }),
  roomId: positiveId("roomId"),
  roomType: csvEnum("roomType", ROOM_TYPES),
  status: csvEnum("status", BOOKING_STATUSES),
  from: isoDateFilter("from"),
  to: isoDateFilter("to"),
  dateField: Joi.string()
    .valid(...BOOKING_DATE_FIELDS)
    .default("checkIn")
    .messages({
      "any.only": `El filtro "dateField" debe ser uno de: ${BOOKING_DATE_FIELDS.join(
        ", "
      )}.`,
    }),
  minAmount: amount("minAmount"),
  maxAmount: amount("maxAmount"),
};

export const bookingSearchSchema = Joi.object<BookingSearchQuery>({
  ...bookingFilterKeys,
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": 'El parámetro "page" debe ser un número.',
    "number.min": 'El parámetro "page" empieza en 1.',
  }),
  pageSize: Joi.number()
    .integer()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .messages({
      "number.base": 'El parámetro "pageSize" debe ser un número.',
      "number.min": 'El parámetro "pageSize" empieza en 1.',
      "number.max": `El parámetro "pageSize" no puede superar ${MAX_PAGE_SIZE}.`,
    }),
  sort: Joi.string()
    .valid(...BOOKING_SORT_FIELDS)
    .default("startDate")
    .messages({
      "any.only": `El parámetro "sort" debe ser uno de: ${BOOKING_SORT_FIELDS.join(
        ", "
      )}.`,
    }),
  order: Joi.string()
    .valid(...SORT_ORDERS)
    .default("desc")
    .messages({
      "any.only": `El parámetro "order" debe ser "asc" o "desc".`,
    }),
}).messages({
    "object.unknown": "El parámetro {#label} no existe en este endpoint.",
  });

export const bookingStatsSchema = Joi.object<BookingStatsQuery>({
  ...bookingFilterKeys,
  top: Joi.number().integer().min(1).max(MAX_TOP).default(5).messages({
    "number.base": 'El parámetro "top" debe ser un número.',
    "number.min": 'El parámetro "top" empieza en 1.',
    "number.max": `El parámetro "top" no puede superar ${MAX_TOP}.`,
  }),
}).messages({
    "object.unknown": "El parámetro {#label} no existe en este endpoint.",
  });

export const studentSearchSchema = Joi.object<StudentSearchQuery>({
  q: Joi.string().trim().max(120).messages({
    "string.base": 'El parámetro "q" debe ser texto.',
    "string.max": 'El parámetro "q" no puede superar los 120 caracteres.',
  }),
  limit: Joi.number().integer().min(1).max(MAX_TOP).default(10).messages({
    "number.base": 'El parámetro "limit" debe ser un número.',
    "number.min": 'El parámetro "limit" empieza en 1.',
    "number.max": `El parámetro "limit" no puede superar ${MAX_TOP}.`,
  }),
}).messages({
    "object.unknown": "El parámetro {#label} no existe en este endpoint.",
  });
