// ============================================================================
// Datos simulados (mock) — Autenticación
// Representan lo que normalmente vendría de un backend de usuarios.
// Se mantiene en un arreglo mutable en memoria: los cambios de contraseña
// solo viven mientras la aplicación no se recargue por completo.
// ============================================================================

import type { UsuarioConCredenciales } from '../utils/types';

export const usuariosMock: UsuarioConCredenciales[] = [
  {
    usuario: { id: 'user-01', nombre: 'Estudiante Dmc', email: 'estudiante@dmc.pe', rol: 'cliente' },
    password: '1234',
  },
  {
    usuario: { id: 'user-02', nombre: 'Admin Demo', email: 'admin@dmc.pe', rol: 'admin' },
    password: 'admin123',
  },
];
