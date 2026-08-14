// ============================================================================
// AuthContext — estado global de autenticación (mockeado)
// ============================================================================
// Guarda el usuario autenticado con `useContext` para que cualquier página
// pueda leerlo (por ejemplo, BookingPage o las rutas protegidas). Todo el
// estado vive en memoria: al recargar la aplicación se pierde la sesión.

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  iniciarSesion as iniciarSesionService,
  restablecerPassword as restablecerPasswordService,
  solicitarCodigoMFA as solicitarCodigoMFAService,
} from '../services/authService';
import type { Usuario } from '../utils/types';

interface AuthContextValue {
  usuario: Usuario | null;
  cargando: boolean;
  iniciarSesion: (email: string, password: string) => Promise<Usuario | null>;
  cerrarSesion: () => void;
  solicitarCodigoMFA: (email: string) => Promise<string | null>;
  restablecerPassword: (email: string, codigoMFA: string, nuevaPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(false);

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    setCargando(true);
    try {
      const usuarioEncontrado = await iniciarSesionService(email, password);
      setUsuario(usuarioEncontrado);
      return usuarioEncontrado;
    } finally {
      setCargando(false);
    }
  }, []);

  const cerrarSesion = useCallback(() => {
    setUsuario(null);
  }, []);

  const solicitarCodigoMFA = useCallback(async (email: string) => {
    return solicitarCodigoMFAService(email);
  }, []);

  const restablecerPassword = useCallback(
    async (email: string, codigoMFA: string, nuevaPassword: string) => {
      return restablecerPasswordService(email, codigoMFA, nuevaPassword);
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      usuario,
      cargando,
      iniciarSesion,
      cerrarSesion,
      solicitarCodigoMFA,
      restablecerPassword,
    }),
    [usuario, cargando, iniciarSesion, cerrarSesion, solicitarCodigoMFA, restablecerPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook de acceso al contexto de autenticación. Debe usarse dentro de `AuthProvider`. */
export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de un <AuthProvider>.');
  }
  return contexto;
}
