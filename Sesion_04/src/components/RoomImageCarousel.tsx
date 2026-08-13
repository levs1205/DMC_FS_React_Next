// ============================================================================
// RoomImageCarousel — carrusel de imágenes de una habitación (presentacional)
// ============================================================================
// Muestra una única imagen a la vez y se ajusta al tamaño de su contenedor
// padre. No realiza llamadas a servicios: recibe las URLs ya cargadas desde
// AvailabilityPreview (que a su vez las recibe de BookingPage/useAvailability).

import { useState } from 'react';
import './RoomImageCarousel.css';

export interface RoomImageCarouselProps {
  imagenes: string[];
  nombreHabitacion: string;
}

export function RoomImageCarousel({ imagenes, nombreHabitacion }: RoomImageCarouselProps) {
  const [indice, setIndice] = useState(0);

  if (imagenes.length === 0) {
    return (
      <div className="room-image-carousel room-image-carousel--empty">
        Sin imágenes disponibles
      </div>
    );
  }

  function irAAnterior() {
    setIndice((actual) => (actual === 0 ? imagenes.length - 1 : actual - 1));
  }

  function irASiguiente() {
    setIndice((actual) => (actual === imagenes.length - 1 ? 0 : actual + 1));
  }

  return (
    <div className="room-image-carousel">
      <img
        className="room-image-carousel__image"
        src={imagenes[indice]}
        alt={`${nombreHabitacion} - foto ${indice + 1} de ${imagenes.length}`}
      />

      {imagenes.length > 1 && (
        <>
          <button
            type="button"
            className="room-image-carousel__control room-image-carousel__control--prev"
            onClick={irAAnterior}
            aria-label="Imagen anterior"
          >
            ‹
          </button>
          <button
            type="button"
            className="room-image-carousel__control room-image-carousel__control--next"
            onClick={irASiguiente}
            aria-label="Siguiente imagen"
          >
            ›
          </button>

          <div className="room-image-carousel__dots">
            {imagenes.map((imagen, i) => (
              <button
                key={imagen}
                type="button"
                className={`room-image-carousel__dot ${i === indice ? 'is-active' : ''}`}
                aria-label={`Ir a la imagen ${i + 1}`}
                onClick={() => setIndice(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
