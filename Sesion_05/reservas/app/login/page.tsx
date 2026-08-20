"use client";

import Link from "next/link";
import "./page.css";
import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";


function Login() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/user/login",{
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Error al iniciar sesión");
        setIsLoading(false);
        return;
      }

      router.push("/intranet");

    } catch (error) {
      setError("Error al iniciar sesión");
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
            onChange={(e) => setUser(e.target.value)}
          />
        </label>

        <label className="login-page__field">
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <Link href="/booking" className="login-page__link">
          ¿Olvidaste tu contraseña?
        </Link>

        <button type="submit" className="login-page__submit" disabled={isLoading}>
          ({isLoading ? "..Ingresando.." : "Ingresar"})
        </button>

        {error && <p className="login-page__status login-page__status--error">{error}</p>}

        <p className="login-page__hint">Demo: estudiante@dmc.pe / 1234</p>
      </form>
    </section>
  );
}

export default Login;
