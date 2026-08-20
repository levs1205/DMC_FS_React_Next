
import Link from "next/link";
import "./page.css";
import { loginAction } from "./actions"

interface LoogiPageProps {
    searchParams: Promise<{error?: string}>;
}


async function Login({ searchParams }: LoogiPageProps) {
  const {error} = await searchParams;

  return (
    <section className="login-page">
      <form className="login-page__form" action={loginAction}>
        <h1>Iniciar sesión</h1>

        <label className="login-page__field">
          Correo electrónico
          <input
            type="email"
            name="user"
            autoComplete="username"
            required
          />
        </label>

        <label className="login-page__field">
          Contraseña
          <input
            type="password"
            name="password"
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

        {error && <p className="login-page__status login-page__status--error">{error}</p>}

        <p className="login-page__hint">Demo: estudiante@dmc.pe / 1234</p>
      </form>
    </section>
  );
}

export default Login;
