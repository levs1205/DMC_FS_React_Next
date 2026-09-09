import Joi from "joi";
import type { LoginCredentials } from "@/modules/users/user.types";

/**
 * Esquema del cuerpo de POST /api/user/login.
 * "user" debe ser un correo electrónico válido; "password" un texto no vacío.
 * tlds.allow = false evita cargar la lista completa de dominios de primer nivel
 * en el bundle del servidor; el formato del correo se valida igual.
 */
export const loginSchema = Joi.object<LoginCredentials>({
  user: Joi.string()
    .trim()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      "string.base": 'El campo "user" debe ser un texto.',
      "string.empty": 'El campo "user" es obligatorio.',
      "string.email": 'El campo "user" debe ser un correo electrónico válido.',
      "any.required": 'El campo "user" es obligatorio.',
    }),
  password: Joi.string()
    .required()
    .messages({
      "string.base": 'El campo "password" debe ser un texto.',
      "string.empty": 'El campo "password" es obligatorio.',
      "any.required": 'El campo "password" es obligatorio.',
    }),
})
  .required()
  .messages({
    "object.base": "El cuerpo de la solicitud debe ser un objeto JSON.",
    "any.required": "El cuerpo de la solicitud es obligatorio.",
  });
