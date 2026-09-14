import "server-only";

import { Type, type FunctionDeclaration, type Schema } from "@google/genai";
import { BookingStatus, RoomType } from "@/lib/generated/prisma/enums";
import { validateStrict } from "@/lib/http/validate-query";
import {
  MAX_PAGE_SIZE,
  MAX_TOP,
  bookingSearchSchema,
  bookingStatsSchema,
  studentSearchSchema,
} from "@/modules/analytics/analytics.schemas";
import { analyticsService } from "@/modules/analytics/analytics.service";
import { maskEmail, sanitizeToolOutput } from "@/modules/chat/chat.sanitize";
import {
  BOOKING_DATE_FIELDS,
  BOOKING_SORT_FIELDS,
} from "@/modules/analytics/analytics.types";

/**
 * Las herramientas que el modelo puede usar: una por cada consulta de la
 * analítica del paso anterior.
 *
 * Dos decisiones que sostienen todo lo demás:
 *
 * 1. Los argumentos que manda el modelo se validan con EL MISMO esquema de Joi
 *    que valida la query string de los endpoints. No hay un segundo camino con
 *    reglas más flojas: si `pageSize=500` está prohibido por HTTP, también lo
 *    está para el agente.
 * 2. El modelo no escribe SQL ni recibe una conexión a la base. Solo puede
 *    pedir estas tres consultas, con estos filtros y estos topes. Eso es
 *    literalmente todo lo que el chatbot puede llegar a saber.
 */

const STATUS_VALUES = Object.values(BookingStatus).join(", ");
const ROOM_TYPE_VALUES = Object.values(RoomType).join(", ");

/**
 * Filtros compartidos por la búsqueda y las estadísticas. Son los mismos que
 * documenta `/api/analytics/booking`, descritos para que los entienda un
 * modelo: cada descripción dice qué formato tiene y cuándo conviene usarlo.
 */
const filterProperties: Record<string, Schema> = {
  studentId: {
    type: Type.INTEGER,
    description:
      "Id exacto del alumno. Es el filtro preciso: conviene resolver el nombre con buscar_alumnos y usar el id que devuelve.",
  },
  student: {
    type: Type.STRING,
    description:
      'Búsqueda parcial por nombre o usuario del alumno, sin distinguir mayúsculas (ej: "ana"). Útil solo si no se tiene el id.',
  },
  from: {
    type: Type.STRING,
    description:
      'Fecha inicial del rango, formato AAAA-MM-DD. El extremo está INCLUIDO. Ej: "2026-10-01".',
  },
  to: {
    type: Type.STRING,
    description:
      'Fecha final del rango, formato AAAA-MM-DD. El extremo está INCLUIDO. Ej: "2026-10-31".',
  },
  dateField: {
    type: Type.STRING,
    enum: [...BOOKING_DATE_FIELDS],
    description:
      'Contra qué fecha se aplica el rango. "checkIn" (por defecto): reservas que ENTRAN dentro del rango. "checkOut": las que SALEN. "overlap": las que ocupan alguna noche del rango, aunque hayan entrado antes. Para preguntas de ocupación usar "overlap".',
  },
  minAmount: {
    type: Type.NUMBER,
    description: "Importe total mínimo de la reserva, en soles.",
  },
  maxAmount: {
    type: Type.NUMBER,
    description: "Importe total máximo de la reserva, en soles.",
  },
  status: {
    type: Type.STRING,
    description: `Uno o varios estados separados por coma. Valores: ${STATUS_VALUES}. IMPORTANTE: sin este filtro se cuentan TODAS las reservas, incluidas las canceladas y las que fallaron al pagar. Para hablar de ingresos cobrados de verdad hay que usar status=PAID.`,
  },
  roomType: {
    type: Type.STRING,
    description: `Uno o varios tipos de habitación separados por coma. Valores: ${ROOM_TYPE_VALUES}.`,
  },
  roomId: {
    type: Type.INTEGER,
    description: "Id exacto de una habitación.",
  },
};

export const chatToolDeclarations: FunctionDeclaration[] = [
  {
    name: "buscar_alumnos",
    description:
      "Busca alumnos por nombre o usuario y devuelve, de cada uno, su id, cuántas reservas tiene, cuánto suman y las fechas de su primera y última entrada. Usar SIEMPRE esto primero cuando la persona nombre a un alumno, para obtener su id. Si devuelve varias coincidencias, hay que preguntarle al usuario a cuál se refiere en lugar de elegir una.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        q: {
          type: Type.STRING,
          description:
            "Texto a buscar en el nombre o el usuario. Si se omite, devuelve los primeros alumnos.",
        },
        limit: {
          type: Type.INTEGER,
          description: `Cuántos alumnos devolver como máximo (tope ${MAX_TOP}, por defecto 10).`,
        },
      },
    },
  },
  {
    name: "obtener_estadisticas",
    description:
      "Devuelve estadísticas agregadas de las reservas que cumplen los filtros: totales (cantidad, alumnos distintos, noches, importe, ticket promedio, mínimo y máximo) y desgloses por estado, por tipo de habitación, por mes, y los rankings de alumnos y de habitaciones. Es la herramienta correcta para cualquier pregunta de cuánto, cuántos, promedio, ranking o evolución: ya viene todo sumado y con los porcentajes calculados, no hay que hacer cuentas a mano.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        ...filterProperties,
        top: {
          type: Type.INTEGER,
          description: `Cuántas filas traen los rankings de alumnos y habitaciones (tope ${MAX_TOP}, por defecto 5).`,
        },
      },
    },
  },
  {
    name: "buscar_reservas",
    description:
      "Devuelve la LISTA de reservas que cumplen los filtros, paginada, con el detalle de cada una (alumno, habitación, fechas, noches, estado e importe). Usar cuando piden ver reservas concretas o un detalle. Para contar o sumar conviene obtener_estadisticas: acepta los mismos filtros y no obliga a recorrer páginas. El campo `pagination.total` dice cuántas hay en total, aunque la página devuelta sea más corta.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        ...filterProperties,
        page: {
          type: Type.INTEGER,
          description: "Página a devolver, empieza en 1.",
        },
        pageSize: {
          type: Type.INTEGER,
          description: `Reservas por página (tope ${MAX_PAGE_SIZE}, por defecto 20). Conviene pedir pocas: solo las que se van a mostrar.`,
        },
        sort: {
          type: Type.STRING,
          enum: [...BOOKING_SORT_FIELDS],
          description: "Campo por el que ordenar. Por defecto startDate.",
        },
        order: {
          type: Type.STRING,
          enum: ["asc", "desc"],
          description: "Sentido del orden. Por defecto desc.",
        },
      },
    },
  },
];

/** Texto que ve el usuario mientras se ejecuta cada herramienta. */
export const TOOL_LABELS: Record<string, string> = {
  buscar_alumnos: "Buscando alumnos",
  obtener_estadisticas: "Calculando estadísticas",
  buscar_reservas: "Consultando reservas",
};

/**
 * Normaliza lo que manda el modelo antes de validarlo.
 *
 * Son dos manías conocidas de los LLM que no vale la pena castigar con un
 * error: mandar `null` para un filtro que decidió no usar, y mandar
 * `["PAID","PENDING"]` donde el esquema espera `"PAID,PENDING"`. Traducirlas
 * acá evita una vuelta entera de corrección contra la API.
 */
function normalizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    if (value === null || value === undefined || value === "") continue;

    normalized[key] = Array.isArray(value) ? value.join(",") : value;
  }

  return normalized;
}

/**
 * Ejecuta una herramienta y devuelve lo que hay que mandarle de vuelta al
 * modelo.
 *
 * Un filtro inválido NO tira la conversación abajo: vuelve como `{ error }` y
 * el modelo lo lee, lo corrige y reintenta. Por eso los mensajes de validación
 * dicen qué valores son válidos —los escribimos para que los pueda leer una
 * persona, y resulta que al modelo le sirven igual—.
 */
export async function runTool(
  name: string,
  rawArgs: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const args = normalizeArgs(rawArgs);

  // Rastro de auditoría: qué consultó el agente y con qué filtros. Es lo que
  // permite reconstruir después de dónde salió un número raro.
  console.info(`[chat] herramienta ${name}`, JSON.stringify(args));

  try {
    switch (name) {
      case "buscar_alumnos": {
        const students = await analyticsService.searchStudents(
          validateStrict(studentSearchSchema, args)
        );

        return {
          output: sanitizeToolOutput(
            students.map((student) => ({
              ...student,
              login: maskEmail(student.login),
            }))
          ),
        };
      }

      case "obtener_estadisticas":
        return {
          output: sanitizeToolOutput(
            await analyticsService.getBookingStats(
              validateStrict(bookingStatsSchema, args)
            )
          ),
        };

      case "buscar_reservas":
        return {
          output: sanitizeToolOutput(
            await analyticsService.searchBookings(
              validateStrict(bookingSearchSchema, args)
            )
          ),
        };

      default:
        return { error: `La herramienta "${name}" no existe.` };
    }
  } catch (error) {
    // El detalle técnico queda en el log del servidor; al modelo se le manda
    // solo el mensaje, que es el que le sirve para corregirse.
    console.error(`[chat] falló la herramienta ${name}`, error);

    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo ejecutar la consulta.",
    };
  }
}
