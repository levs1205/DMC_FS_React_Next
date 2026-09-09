import "server-only";

import { siteConfig } from "@/lib/seo/site.config";

/**
 * Configuración de la integración con Mercado Pago.
 *
 * A diferencia de `lib/config/env.ts` —que valida sus variables al importarse
 * y tira la app abajo si falta alguna— acá la lectura es PEREZOSA: la app
 * tiene que poder arrancar y mostrar el catálogo aunque nadie haya cargado
 * todavía las credenciales de Mercado Pago. El error aparece recién cuando se
 * intenta cobrar, diciendo exactamente qué variable falta.
 *
 * `import "server-only"` es la barrera importante: si por accidente alguien
 * importa este archivo desde un Client Component, el build falla en vez de
 * empaquetar el access token dentro del JavaScript que baja al navegador.
 */

export const MERCADOPAGO_API_URL = "https://api.mercadopago.com";

// Moneda de la integración. Mercado Pago valida que coincida con el país de
// la cuenta, así que vive junto al resto de la configuración del proveedor.
export const MERCADOPAGO_CURRENCY = "PEN";

// Cuánto vive una preferencia antes de que Mercado Pago la dé por vencida.
// Es también el tiempo que la reserva queda esperando ese intento de cobro.
export const CHECKOUT_EXPIRATION_MINUTES = 30;

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Falta configurar la variable de entorno "${name}" para poder cobrar con Mercado Pago.`
    );
  }

  return value;
}

/** Access token privado de la aplicación (TEST-... o APP_USR-...). */
export function getAccessToken(): string {
  return readRequiredEnv("MP_ACCESS_TOKEN");
}

/**
 * Claves secretas con las que se firman los webhooks.
 *
 * Devuelve una LISTA porque el panel de Mercado Pago genera una clave por cada
 * modo (prueba y productivo), y cuál de los dos dispara depende de con qué
 * credenciales se cobró. Aceptar varias evita tener que adivinar: se admite
 * `MP_WEBHOOK_SECRET` con los valores separados por coma.
 *
 * Es además el mecanismo estándar para ROTAR una clave sin ventana de caída:
 * durante la rotación conviven la vieja y la nueva, y después se borra la vieja.
 */
export function getWebhookSecrets(): string[] {
  return (process.env.MP_WEBHOOK_SECRET ?? "")
    .split(",")
    .map((secret) => secret.trim())
    .filter(Boolean);
}

/**
 * Base pública del sitio para las URLs que Mercado Pago tiene que poder
 * abrir: el retorno del comprador (`back_urls`) y el webhook
 * (`notification_url`).
 *
 * Desde el 29/03/2025 la API de preferencias RECHAZA con 400 cualquier URL
 * en http, así que en desarrollo hay que exponer el localhost por un túnel
 * https (ngrok, cloudflared) y ponerlo en MP_PUBLIC_BASE_URL. Si la base no
 * es https simplemente no se envían esos campos: la preferencia se crea igual
 * y el flujo sigue funcionando porque la página de resultado le consulta el
 * estado del pago directamente a la API (ver `payment.service`).
 */
export function getPublicBaseUrl(): string {
  const raw = process.env.MP_PUBLIC_BASE_URL?.trim() || siteConfig.url;

  return raw.replace(/\/+$/, "");
}

export function isPublicBaseUrlReachable(): boolean {
  return getPublicBaseUrl().startsWith("https://");
}
