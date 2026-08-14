// ============================================================================
// LoginPage — vista de inicio de sesión
// ============================================================================
// Formulario simple de email/password contra el AuthContext (mockeado).
// Si el login es exitoso, redirige a la ruta que el usuario quería visitar
// originalmente (o a "/" si llegó directo a /login).

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import './LoginPage.css';

interface UbicacionConOrigen {
  from?: { pathname: string };
}

export function LoginPage() {
  const { iniciarSesion, cargando } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const rutaOrigen = (location.state as UbicacionConOrigen | null)?.from?.pathname ?? '/';

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    setError(null);

    const usuarioAutenticado = await iniciarSesion(email, password);
    if (!usuarioAutenticado) {
      setError('Correo o contraseña incorrectos.');
      return;
    }

    // El admin siempre entra directo al listado de reservas, nunca a la página de reservar.
    const destino = usuarioAutenticado.rol === 'admin' ? '/admin/reservas' : rutaOrigen;
    navigate(destino, { replace: true });
  }

  return (
    <section className="login-page">
      <form className="login-page__form" onSubmit={handleSubmit}>
        <h1>Iniciar sesión</h1>

        <label className="login-page__field">
          Correo electrónico
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="login-page__field">
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="login-page__status login-page__status--error">{error}</p>}

        <button type="submit" className="login-page__submit" disabled={cargando}>
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>

        <Link to="/forgot-password" className="login-page__link">
          ¿Olvidaste tu contraseña?
        </Link>

        <p className="login-page__hint">
          Demo: estudiante@dmc.pe / 1234 (cliente) · admin@dmc.pe / admin123 (admin)
        </p>
      </form>
    </section>
  );
}
