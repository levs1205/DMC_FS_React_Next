// ============================================================================
// AuthContext — estado global de autenticación (mockeado)
// ============================================================================
// Guarda el usuario autenticado con `useContext` para que cualquier página
// pueda leerlo (por ejemplo, BookingPage o las rutas protegidas). Todo el
// estado vive en memoria: al recargar la aplicación se pierde la sesión.

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Usuario } from '../utils/types';

interface AuthContextValue {
  usuario: Usuario | null;
  iniciarSesion: (email: string, password: string) => Promise<boolean>;
  obtenerUsuario: () => Promise<Usuario | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const iniciarSesion = useCallback(async (email: string, password: string) => {

    try {
      let usuarioEncontrado: Usuario;
      usuarioEncontrado = {
        id: '1',
        nombre: 'Luis',
        email: 'lvs@gmail.com',
      };

      setUsuario(usuarioEncontrado);
      return usuarioEncontrado !== null;
    } finally {
    }
  }, []);

  const obtenerUsuario = useCallback(async () => {
    return usuario;
  }, [usuario]);

  const value = useMemo<AuthContextValue>(
    () => ({
      usuario,
      iniciarSesion,
      obtenerUsuario,
    }),
    [usuario, iniciarSesion, obtenerUsuario],
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
