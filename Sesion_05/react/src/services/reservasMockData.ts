// ============================================================================
// Datos simulados (mock) — Reservas
// Representan lo que normalmente vendría de un backend / base de datos.
// Se mantiene en un arreglo mutable en memoria: `BookingPage` agrega reservas
// nuevas y `AdminBookingsPage` las lista/cancela desde el mismo arreglo.
// ============================================================================

import type { Reserva } from '../utils/types';

export const reservasMock: Reserva[] = [
  {
    id: 'res-seed-01',
    habitacionId: 'hab-101',
    usuarioId: 'user-01',
    fechaInicio: '2026-08-10',
    fechaFin: '2026-08-12',
    estado: 'confirmada',
    precioTotal: 90,
  },
  {
    id: 'res-seed-02',
    habitacionId: 'hab-303',
    usuarioId: 'user-01',
    fechaInicio: '2026-08-15',
    fechaFin: '2026-08-18',
    estado: 'pendiente',
    precioTotal: 450,
  },
];
