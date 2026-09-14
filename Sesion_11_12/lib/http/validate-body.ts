import type { ObjectSchema } from "joi";
import { ApiError } from "@/lib/http/api-error";

/**
 * Valida el cuerpo de una petición contra un esquema de Joi.
 * Devuelve el valor ya normalizado (trim, casts) o lanza ApiError 400
 * con todos los mensajes de validación encontrados.
 */
export function validateBody<T>(schema: ObjectSchema<T>, payload: unknown): T {
  const { value, error } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const message = error.details.map((detail) => detail.message).join(" ");
    throw new ApiError(400, message);
  }

  return value;
}
