// src/components/juegos/palabra/colores.ts
import type { PalabraColor } from "@/types";

// Verde/amarillo/gris clásicos de este tipo de juego, con texto blanco para
// buen contraste sobre el fondo oscuro del sitio.
export const COLOR_FONDO: Record<PalabraColor, string> = {
  correct: "#538D4E",
  present: "#B59F3B",
  absent: "#3A3A4C",
};

export const ETIQUETA_COLOR: Record<PalabraColor, string> = {
  correct: "en su lugar",
  present: "en otra posición",
  absent: "no está",
};
