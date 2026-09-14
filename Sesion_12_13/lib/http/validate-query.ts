import type { ObjectSchema } from "joi";
import { ApiError } from "@/lib/http/api-error";

/**
 * Validación de los filtros de lectura, tanto los que llegan por la URL como
 * los que arma el agente al llamar a una herramienta.
 *
 * Se diferencia de `validateBody` en una cosa importante: un campo desconocido
 * NO se descarta en silencio, devuelve 400. Un filtro mal escrito que se
 * ignora calladito produce el peor error posible —una respuesta con datos de
 * más que parece correcta— y quien manda estos filtros es un modelo de IA al
 * que le sobra imaginación para inventar nombres de parámetros. Mejor un error
 * que le explique qué existe, así se corrige en el siguiente intento.
 */
export function validateStrict<T>(
  schema: ObjectSchema<T>,
  payload: unknown
): T {
  const { value, error } = schema.validate(payload, { abortEarly: false });

  if (error) {
    const message = error.details.map((detail) => detail.message).join(" ");
    throw new ApiError(400, message);
  }

  return value;
}

/**
 * Lo mismo, para la query string de un GET.
 *
 * En una URL todo es texto (`?page=2` llega como `"2"`), y de eso se encarga
 * el `convert` de Joi, que está activo por defecto. Lo que sí hay que resolver
 * acá es el parámetro escrito pero vacío (`?student=`): significa "no
 * filtrar", no "filtrar por cadena vacía", así que se descarta antes de
 * validar para que el esquema aplique su valor por defecto.
 */
export function validateQuery<T>(
  schema: ObjectSchema<T>,
  searchParams: URLSearchParams
): T {
  const raw: Record<string, string> = {};

  for (const [key, value] of searchParams.entries()) {
    const trimmed = value.trim();
    if (trimmed !== "") raw[key] = trimmed;
  }

  return validateStrict(schema, raw);
}
