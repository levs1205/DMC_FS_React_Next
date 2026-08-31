import Joi from "joi";
import type { LoginCredentials } from "@/modules/users/user.types";

export const loginSchema = Joi.object<LoginCredentials>({
  user: Joi.string().trim().email().required().messages({
    "string.base": "El campo user debe ser una cadena",
    "string.empty": "El campo user no puede ser vacio",
    "string.email": "El campo user debe ser un correo valido",
    "any.required": "El campo user es obligatorio",
  }),
  password: Joi.string().required().messages({
    "string.base": "El password debe ser un texto",
    "string.empty": "El password no puede ser vacio",
    "any.required": "El password es requerido",
  }),
})
  .required()
  .messages({
    "object.base": "El cuerpoo no es JSON",
    "any.required": "El cuerpo es obligatorio",
  });
