// ============================================================================
// useReservas — hook de estado reutilizable
// ============================================================================
// Encapsula la carga y cancelación de reservas (llamando a
// "services/reservasService") y expone un estado tipado listo para usar en
// AdminBookingsPage.

import { useCallback, useEffect, useState } from 'react';
import { cancelarReserva, obtenerReservas } from '../services/reservasService';
import type { Reserva } from '../utils/types';

interface UseReservasResult {
  reservas: Reserva[];
  cargando: boolean;
  error: string | null;
  cancelandoId: string | null;
  cancelar: (id: string) => Promise<void>;
}

export function useReservas(): UseReservasResult {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  const cargarReservas = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await obtenerReservas();
      setReservas(datos);
    } catch {
      setError('No se pudo cargar el listado de reservas.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarReservas();
  }, [cargarReservas]);

  const cancelar = useCallback(async (id: string) => {
    setCancelandoId(id);
    try {
      await cancelarReserva(id);
      setReservas((actuales) =>
        actuales.map((reserva) =>
          reserva.id === id ? { ...reserva, estado: 'cancelada' } : reserva,
        ),
      );
    } finally {
      setCancelandoId(null);
    }
  }, []);

  return { reservas, cargando, error, cancelandoId, cancelar };
}
