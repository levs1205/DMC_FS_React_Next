import "./LoginPage.css";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../store/AuthContext";
import type { SubmitEvent } from "react";

export function LoginPage() {
  const { iniciarSesion, usuario } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function handleSubmit(evento: SubmitEvent) {
    evento.preventDefault();
    setError(null);

    const exito = iniciarSesion(email, password);
    if (exito) {
      console.log("Inicio de sesión exitoso");

      navigate("/booking", { replace: true });
    } else {
      setError("Correo o contraseña incorrectos.");
    }
  }
  console.log("Usuario:", usuario);
  return (
    <section className="login-page">
      <form className="login-page__form" onSubmit={handleSubmit}>
        <h1>Iniciar sesión</h1>

        <label className="login-page__field">
          Correo electrónico
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="login-page__field">
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <Link to="/booking" className="login-page__link">
          ¿Olvidaste tu contraseña?
        </Link>

        {error && (
          <p className="login-page__status login-page__status--error">
            {error}
          </p>
        )}

        <button type="submit" className="login-page__submit">
          Ingresar
        </button>

        <p className="login-page__hint">Demo: estudiante@dmc.pe / 1234</p>
      </form>
    </section>
  );
}
