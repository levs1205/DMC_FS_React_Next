// ============================================================================
// AvailabilityPreview — componente de visualización (presentacional)
// ============================================================================
// Taller 4: Tipado de props en componentes de visualización.
// Taller 5: Modelado básico de estado en UI de componentes de disponibilidad.
//
// Este componente NO tiene lógica de negocio ni llamadas a servicios: solo
// recibe props ya calculadas y las muestra. Toda la lógica vive en
// utils/businessLogic.ts y en la página que lo usa (pages/BookingPage.tsx).

import type { Habitacion } from '../utils/types';
import { RoomImageCarousel } from './RoomImageCarousel';
import './AvailabilityPreview.css';

export interface AvailabilityPreviewProps {
  habitacion: Habitacion;
  imagenes: string[];
  noches: number;
  precioTotal: number;
  disponible: boolean;
}

export function AvailabilityPreview({
  habitacion,
  imagenes,
  noches,
  precioTotal,
  disponible,
}: AvailabilityPreviewProps) {
  return (
    <article className={`availability-preview ${disponible ? 'is-available' : 'is-unavailable'}`}>
      <header className="availability-preview__header">
        <h3>{habitacion.nombre}</h3>
        <span className="availability-preview__badge">
          {disponible ? 'Disponible' : 'No disponible'}
        </span>
      </header>

      <div className="availability-preview__gallery">
        <RoomImageCarousel imagenes={imagenes} nombreHabitacion={habitacion.nombre} />
      </div>

      <p className="availability-preview__description">{habitacion.descripcion}</p>

      <dl className="availability-preview__details">
        <div>
          <dt>Capacidad</dt>
          <dd>{habitacion.capacidad} persona(s)</dd>
        </div>
        <div>
          <dt>Precio por noche</dt>
          <dd>${habitacion.precioPorNoche}</dd>
        </div>
        <div>
          <dt>Noches seleccionadas</dt>
          <dd>{noches}</dd>
        </div>
        <div>
          <dt>Total estimado</dt>
          <dd>${precioTotal}</dd>
        </div>
      </dl>
    </article>
  );
}
