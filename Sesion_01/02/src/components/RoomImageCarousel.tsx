// ============================================================================
// RoomImageCarousel — componente hijo de visualización (presentacional)
// ============================================================================
// Muestra una única imagen a la vez del listado de `imagenes` recibido por
// props, ajustándose al tamaño de su contenedor padre. No realiza llamadas a
// servicios: la carga de imágenes vive en hooks/useAvailability.

import { useEffect, useState } from 'react';
import type { ImagenHabitacion } from '../utils/types';
import './RoomImageCarousel.css';

export interface RoomImageCarouselProps {
  imagenes: ImagenHabitacion[];
  cargando?: boolean;
}

export function RoomImageCarousel({ imagenes, cargando = false }: RoomImageCarouselProps) {
  const [indiceActual, setIndiceActual] = useState(0);

  // Vuelve a la primera imagen cuando cambia la habitación (nuevo listado).
  useEffect(() => {
    setIndiceActual(0);
  }, [imagenes]);

  if (cargando) {
    return <div className="room-image-carousel room-image-carousel--placeholder">Cargando imágenes...</div>;
  }

  if (imagenes.length === 0) {
    return <div className="room-image-carousel room-image-carousel--placeholder">Sin imágenes disponibles</div>;
  }

  const imagenActual = imagenes[indiceActual];

  function irAImagenAnterior() {
    setIndiceActual((indice) => (indice === 0 ? imagenes.length - 1 : indice - 1));
  }

  function irAImagenSiguiente() {
    setIndiceActual((indice) => (indice === imagenes.length - 1 ? 0 : indice + 1));
  }

  return (
    <div className="room-image-carousel">
      <img className="room-image-carousel__image" src={imagenActual.url} alt={imagenActual.alt} />

      {imagenes.length > 1 && (
        <>
          <button
            type="button"
            className="room-image-carousel__control room-image-carousel__control--prev"
            onClick={irAImagenAnterior}
            aria-label="Imagen anterior"
          >
            ‹
          </button>
          <button
            type="button"
            className="room-image-carousel__control room-image-carousel__control--next"
            onClick={irAImagenSiguiente}
            aria-label="Imagen siguiente"
          >
            ›
          </button>
          <span className="room-image-carousel__counter">
            {indiceActual + 1} / {imagenes.length}
          </span>
        </>
      )}
    </div>
  );
}
