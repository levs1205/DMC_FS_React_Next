// ============================================================================
// useAvailability — hook de estado reutilizable
// ============================================================================
// Encapsula la carga de habitaciones y disponibilidad (llamando al
// "services/roomsService") y expone un estado tipado y listo para usar en
// cualquier componente de UI.

import { useCallback, useEffect, useState } from 'react';
import { obtenerDisponibilidad, obtenerHabitaciones, obtenerImagenesHabitacion } from '../services/roomsService';
import type { Disponibilidad, Habitacion, ImagenHabitacion } from '../utils/types';

interface UseAvailabilityResult {
  habitaciones: Habitacion[];
  disponibilidad: Disponibilidad[];
  imagenes: ImagenHabitacion[];
  cargando: boolean;
  cargandoImagenes: boolean;
  error: string | null;
  errorImagenes: string | null;
  cargarDisponibilidad: (habitacionId: string) => Promise<void>;
  cargarImagenesHabitacion: (habitacionId: string) => Promise<void>;
}

export function useAvailability(): UseAvailabilityResult {
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad[]>([]);
  const [imagenes, setImagenes] = useState<ImagenHabitacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [cargandoImagenes, setCargandoImagenes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorImagenes, setErrorImagenes] = useState<string | null>(null);

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

  // const cargarImagenesHabitacion = useCallback(async (habitacionId: string) => {
  //   setCargandoImagenes(true);
  //   setErrorImagenes(null);
  //   try {
  //     const datos = await obtenerImagenesHabitacion(habitacionId);
  //     setImagenes(datos);
  //   } catch {
  //     setErrorImagenes('No se pudieron cargar las imágenes de la habitación.');
  //   } finally {
  //     setCargandoImagenes(false);
  //   }
  // }, []);

    const cargarImagenesHabitacion = async (habitacionId: string) => {
    setCargandoImagenes(true);
    setErrorImagenes(null);
    try {
      const datos = await obtenerImagenesHabitacion(habitacionId);
      setImagenes(datos);
    } catch {
      setErrorImagenes('No se pudieron cargar las imágenes de la habitación.');
    } finally {
      setCargandoImagenes(false);
    }
  };

  return {
    habitaciones,
    disponibilidad,
    imagenes,
    cargando,
    cargandoImagenes,
    error,
    errorImagenes,
    cargarDisponibilidad,
    cargarImagenesHabitacion,
  };
}
