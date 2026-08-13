// ============================================================================
// Servicio de autenticación — capa de acceso a datos (mockeada)
// ============================================================================
// Simula un backend de autenticación con login e recuperación de contraseña
// vía MFA. Como todo es mock, el código MFA se genera aleatoriamente y se
// devuelve directamente (en un sistema real llegaría por SMS/correo).

import type { Usuario } from '../utils/types';
import { usuariosMock } from './authMockData';

const RETARDO_SIMULADO_MS = 400;

function simularRespuesta<T>(datos: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(datos), RETARDO_SIMULADO_MS);
  });
}

function generarCodigoMFA(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Últimos códigos MFA "enviados" por email (simula el código que llegaría por SMS/correo).
const codigosMFAPorEmail = new Map<string, string>();

/** Simula: POST /auth/login */
export async function iniciarSesion(email: string, password: string): Promise<Usuario | null> {
  const registro = usuariosMock.find(
    (u) => u.usuario.email === email && u.password === password,
  );
  return simularRespuesta(registro ? registro.usuario : null);
}

/** Simula: GET /usuarios — usado por el listado de reservas del administrador. */
export async function obtenerUsuarios(): Promise<Usuario[]> {
  return simularRespuesta(usuariosMock.map((registro) => registro.usuario));
}

/** Simula: POST /auth/forgot-password — genera y "envía" un código MFA. */
export async function solicitarCodigoMFA(email: string): Promise<string | null> {
  const registro = usuariosMock.find((u) => u.usuario.email === email);
  if (!registro) {
    return simularRespuesta(null);
  }

  const codigo = generarCodigoMFA();
  codigosMFAPorEmail.set(email, codigo);
  return simularRespuesta(codigo);
}

/** Simula: POST /auth/reset-password — valida el MFA y actualiza la contraseña. */
export async function restablecerPassword(
  email: string,
  codigoMFA: string,
  nuevaPassword: string,
): Promise<boolean> {
  const registro = usuariosMock.find((u) => u.usuario.email === email);
  const codigoEsperado = codigosMFAPorEmail.get(email);

  if (!registro || !codigoEsperado || codigoEsperado !== codigoMFA) {
    return simularRespuesta(false);
  }

  registro.password = nuevaPassword;
  codigosMFAPorEmail.delete(email);
  return simularRespuesta(true);
}
