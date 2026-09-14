import Joi from "joi";
import { MAX_HISTORY_MESSAGES } from "@/modules/chat/chat.config";
import type { ChatRequest } from "@/modules/chat/chat.types";

/**
 * Cuerpo de POST /api/chat.
 *
 * Los topes no son burocracia: el historial y el mensaje se le mandan tal cual
 * al modelo, y todo lo que entra se paga en tokens. Sin un límite, cualquiera
 * con sesión de admin podría pegar un libro entero en el cuadro de texto.
 */
export const chatRequestSchema = Joi.object<ChatRequest>({
  message: Joi.string().trim().min(1).max(2000).required().messages({
    "string.base": 'El campo "message" debe ser texto.',
    "string.empty": "Escribí una pregunta.",
    "string.max": "La pregunta no puede superar los 2000 caracteres.",
    "any.required": 'El campo "message" es obligatorio.',
  }),

  // El historial lo manda el navegador, así que se valida como cualquier otra
  // entrada: acá adentro no hay nada "de confianza".
  history: Joi.array()
    .items(
      Joi.object({
        role: Joi.string().valid("user", "model").required().messages({
          "any.only": 'Cada mensaje del historial debe tener el rol "user" o "model".',
          "any.required": "Cada mensaje del historial necesita un rol.",
        }),
        text: Joi.string().allow("").max(8000).required().messages({
          "string.base": "El texto de cada mensaje del historial debe ser texto.",
          "string.max": "Un mensaje del historial no puede superar los 8000 caracteres.",
          "any.required": "Cada mensaje del historial necesita un texto.",
        }),
      })
    )
    .max(MAX_HISTORY_MESSAGES)
    .default([])
    .messages({
      "array.base": 'El campo "history" debe ser una lista de mensajes.',
      "array.max": `El historial no puede superar los ${MAX_HISTORY_MESSAGES} mensajes.`,
    }),
})
  .required()
  .messages({
    "object.base": "El cuerpo de la solicitud debe ser un objeto JSON.",
    "any.required": "El cuerpo de la solicitud es obligatorio.",
  });
