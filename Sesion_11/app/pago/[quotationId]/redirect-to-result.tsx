/**
 * Salta de la página pública de retorno a la zona privada.
 *
 * Se usa `window.location.replace` (navegación completa) y no el router de
 * Next a propósito: si la sesión venció mientras el alumno pagaba, esa
 * navegación tiene que pasar por el proxy para que renueve el access token con
 * el refresh token. `replace` además saca esta pantalla del historial, así el
 * botón "atrás" no devuelve al limbo del retorno.
 */
"use client";

import { useEffect } from "react";

export function RedirectToResult({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return null;
}
