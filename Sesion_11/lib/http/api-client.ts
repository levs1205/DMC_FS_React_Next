/**
 * `fetch` para las llamadas del navegador a la API propia.
 *
 * Las cookies de sesión son HttpOnly: el JavaScript no puede leerlas ni armar
 * un header Authorization, y no hace falta: el navegador las adjunta solo.
 *
 * Si la API responde 401 (access token vencido), se intenta UNA renovación
 * contra /api/auth/refresh y se repite el pedido. Si la renovación tampoco
 * funciona, devuelve el 401 original para que la pantalla decida qué hacer
 * (normalmente, mandar al login con el router).
 */
export async function apiFetch(
  input: string,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await fetch("/api/auth/refresh", { method: "POST" });

  if (!refreshed.ok) {
    return response;
  }

  return fetch(input, init);
}
