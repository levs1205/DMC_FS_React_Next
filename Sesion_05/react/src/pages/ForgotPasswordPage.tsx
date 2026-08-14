// ============================================================================
// ForgotPasswordPage — recuperación de contraseña con MFA (mockeado)
// ============================================================================
// Flujo en dos pasos:
//   1. El usuario ingresa su email y se "envía" un código MFA. Como todo es
//      mock, el código se genera aleatoriamente y se precarga en el
//      formulario (simulando que llegó por SMS/correo).
//   2. El usuario confirma el código MFA y define su nueva contraseña.
// Todo vive en memoria: al recargar la aplicación se pierde el cambio.

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import './ForgotPasswordPage.css';

type Paso = 'solicitar-codigo' | 'restablecer-password';

export function ForgotPasswordPage() {
  const { solicitarCodigoMFA, restablecerPassword } = useAuth();

  const [paso, setPaso] = useState<Paso>('solicitar-codigo');
  const [email, setEmail] = useState('');
  const [codigoMFA, setCodigoMFA] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSolicitarCodigo(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setCargando(true);

    try {
      const codigo = await solicitarCodigoMFA(email);
      if (!codigo) {
        setError('No existe ninguna cuenta con ese correo.');
        return;
      }

      // Mock: en un sistema real este código llegaría por SMS/correo.
      setCodigoMFA(codigo);
      setPaso('restablecer-password');
    } finally {
      setCargando(false);
    }
  }

  async function handleRestablecerPassword(evento: FormEvent) {
    evento.preventDefault();
    setError(null);

    if (nuevaPassword !== confirmarPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setCargando(true);
    try {
      const exito = await restablecerPassword(email, codigoMFA, nuevaPassword);
      if (!exito) {
        setError('El código MFA no es válido.');
        return;
      }

      setMensajeExito('Contraseña actualizada. Ya puedes iniciar sesión.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <section className="forgot-password-page">
      {paso === 'solicitar-codigo' && (
        <form className="forgot-password-page__form" onSubmit={handleSolicitarCodigo}>
          <h1>Recuperar contraseña</h1>
          <p className="forgot-password-page__hint">
            Ingresa tu correo y te enviaremos un código de verificación (MFA).
          </p>

          <label className="forgot-password-page__field">
            Correo electrónico
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          {error && (
            <p className="forgot-password-page__status forgot-password-page__status--error">
              {error}
            </p>
          )}

          <button type="submit" className="forgot-password-page__submit" disabled={cargando}>
            {cargando ? 'Enviando...' : 'Enviar código MFA'}
          </button>

          <Link to="/login" className="forgot-password-page__link">
            Volver a iniciar sesión
          </Link>
        </form>
      )}

      {paso === 'restablecer-password' && !mensajeExito && (
        <form className="forgot-password-page__form" onSubmit={handleRestablecerPassword}>
          <h1>Verificación MFA</h1>
          <p className="forgot-password-page__hint">
            Simulación: el código MFA se precargó automáticamente, como si hubiera llegado por
            SMS/correo. Puedes editarlo para probar un código inválido.
          </p>

          <label className="forgot-password-page__field">
            Código MFA
            <input value={codigoMFA} onChange={(e) => setCodigoMFA(e.target.value)} required />
          </label>

          <label className="forgot-password-page__field">
            Nueva contraseña
            <input
              type="password"
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <label className="forgot-password-page__field">
            Confirmar contraseña
            <input
              type="password"
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          {error && (
            <p className="forgot-password-page__status forgot-password-page__status--error">
              {error}
            </p>
          )}

          <button type="submit" className="forgot-password-page__submit" disabled={cargando}>
            {cargando ? 'Actualizando...' : 'Cambiar contraseña'}
          </button>
        </form>
      )}

      {mensajeExito && (
        <div className="forgot-password-page__form">
          <p className="forgot-password-page__status forgot-password-page__status--success">
            {mensajeExito}
          </p>
          <Link to="/login" className="forgot-password-page__link">
            Ir a iniciar sesión
          </Link>
        </div>
      )}
    </section>
  );
}
