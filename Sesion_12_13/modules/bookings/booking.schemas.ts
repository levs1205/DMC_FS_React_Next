import Joi from "joi";
import type { CreateBookingInput } from "@/modules/bookings/booking.types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Esquema del cuerpo de POST /api/booking.
 *
 * Acá se valida el FORMATO (que sea un "AAAA-MM-DD" y un id positivo). Las
 * reglas de negocio —que el check-out sea posterior al check-in, que no sea
 * una fecha pasada, que la habitación esté libre— viven en el servicio, que
 * es quien puede consultar la base de datos.
 */
const isoDateField = (field: string) =>
  Joi.string()
    .trim()
    .pattern(ISO_DATE)
    .required()
    .messages({
      "string.base": `El campo "${field}" debe ser un texto.`,
      "string.empty": `El campo "${field}" es obligatorio.`,
      "string.pattern.base": `El campo "${field}" debe tener el formato AAAA-MM-DD.`,
      "any.required": `El campo "${field}" es obligatorio.`,
    });

export const createBookingSchema = Joi.object<CreateBookingInput>({
  roomId: Joi.number().integer().positive().required().messages({
    "number.base": "El campo roomId debe ser un número.",
    "number.integer": "El campo roomId debe ser un número entero.",
    "number.positive": "El campo roomId debe ser mayor que cero.",
    "any.required": "El campo roomId es obligatorio.",
  }),
  startDate: isoDateField("startDate"),
  endDate: isoDateField("endDate"),
})
  .required()
  .messages({
    "object.base": "El cuerpo de la solicitud debe ser un objeto JSON.",
    "any.required": "El cuerpo de la solicitud es obligatorio.",
  });
