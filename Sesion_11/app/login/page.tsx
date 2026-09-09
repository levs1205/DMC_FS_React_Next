/**
 * Ruta: "/login"
 * Client Component: envía las credenciales a POST /api/user/login. Si son
 * válidas, la respuesta trae la ruta que le toca al rol ("/backoffice" para
 * admin, "/intranet" para estudiante) y los tokens llegan como cookies
 * HttpOnly; si no, muestra el error debajo del formulario.
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";
import "./page.css";

function Login() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/user/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "No se pudo iniciar sesión.");
        return;
      }

      // El servidor decide el destino según el rol; el cliente no lo adivina.
      router.push(data.redirectTo);
      // Refresca el árbol de Server Components para que el header muestre
      // de inmediato al usuario recién logueado.
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="login-page">
      <form className="login-page__form" onSubmit={handleSubmit}>
        <h1>Iniciar sesión</h1>

        <label className="login-page__field">
          Correo electrónico
          <input
            type="email"
            autoComplete="username"
            required
            value={user}
            onChange={(event) => setUser(event.target.value)}
          />
        </label>

        <label className="login-page__field">
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <Link href="/booking" className="login-page__link">
          ¿Olvidaste tu contraseña?
        </Link>

        <button
          type="submit"
          className="login-page__submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Ingresando..." : "Ingresar"}
        </button>

        {error && (
          <p className="login-page__status login-page__status--error">
            {error}
          </p>
        )}

        <p className="login-page__hint">
          Demo: estudiante@dmc.pe / 1234 (intranet) &middot; admin@dmc.pe /
          admin123 (reservas)
        </p>
      </form>
    </section>
  );
}

export default Login;
