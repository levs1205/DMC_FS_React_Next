// ============================================================================
// useAvailability — hook de estado reutilizable
// ============================================================================
// Encapsula la carga de habitaciones y disponibilidad (llamando al
// "services/roomsService") y expone un estado tipado y listo para usar en
// cualquier componente de UI.

import { useCallback, useEffect, useState } from 'react';
import { obtenerDisponibilidad, obtenerHabitaciones } from '../services/roomsService';
import type { Disponibilidad, Habitacion } from '../utils/types';

interface UseAvailabilityResult {
  habitaciones: Habitacion[];
  disponibilidad: Disponibilidad[];
  cargando: boolean;
  error: string | null;
  cargarDisponibilidad: (habitacionId: string) => Promise<void>;
}

export function useAvailability(): UseAvailabilityResult {
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    obtenerHabitaciones()
      .then(setHabitaciones)
      .catch(() => setError('No se pudo cargar el catálogo de habitaciones.'))
      .finally(() => setCargando(false));
  }, []);

  const cargarDisponibilidad = useCallback(async (habitacionId: string) => {
    setCargando(true);
    setError(null);
    try {
      const datos = await obtenerDisponibilidad(habitacionId);
      setDisponibilidad(datos);
    } catch {
      setError('No se pudo cargar la disponibilidad de la habitación.');
    } finally {
      setCargando(false);
    }
  }, []);

  return { habitaciones, disponibilidad, cargando, error, cargarDisponibilidad };
}
