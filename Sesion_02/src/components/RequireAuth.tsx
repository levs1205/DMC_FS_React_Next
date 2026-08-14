// ============================================================================
// RequireAuth — guarda de rutas protegidas
// ============================================================================
// Envuelve las páginas que requieren sesión iniciada. Si no hay un usuario
// autenticado en el AuthContext, redirige a /login conservando la ruta de
// origen para volver a ella después de iniciar sesión.

import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

export interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { usuario } = useAuth();
  const location = useLocation();

  if (!usuario) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
