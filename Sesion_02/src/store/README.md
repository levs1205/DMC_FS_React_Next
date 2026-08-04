# store/

Carpeta reservada para el estado global de la aplicación (por ejemplo,
Redux, Zustand o React Context).

En esta primera clase el estado se maneja de forma local con `useState`
dentro de `hooks/useAvailability.ts` y `pages/BookingPage.tsx`, ya que el
flujo es simple y no necesita compartirse entre múltiples páginas todavía.

Cuando el proyecto crezca (por ejemplo, para compartir el usuario
autenticado o el carrito de reservas entre varias vistas), la lógica de
estado global se agregará aquí.
