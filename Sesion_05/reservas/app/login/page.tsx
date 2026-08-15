/**
 * Ruta estática: "/login"
 * Renderizado: Server Component (por defecto) -> Static Rendering (SSG),
 * ya que no depende de datos dinámicos ni tiene "use client".
 */
import Link from "next/link";
import "./page.css";

function Login() {
  return (
    <section className="login-page">
      <form className="login-page__form">
        <h1>Iniciar sesión</h1>

        <label className="login-page__field">
          Correo electrónico
          <input
            type="email"
            autoComplete="username"
            required
          />
        </label>

        <label className="login-page__field">
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            required
          />
        </label>

        <Link href="/booking" className="login-page__link">
          ¿Olvidaste tu contraseña?
        </Link>

        <button type="submit" className="login-page__submit">
          Ingresar
        </button>

        <p className="login-page__hint">Demo: estudiante@dmc.pe / 1234</p>
      </form>
    </section>
  );
}

export default Login;
