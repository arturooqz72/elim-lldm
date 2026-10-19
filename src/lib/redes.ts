// src/lib/redes.ts
//
// Redes sociales de Elim LLDM. Un solo lugar para los enlaces: los usan el
// menú, el pie de página, el aviso de la portada y la imagen para
// historias de la Palabra del Día.

export const REDES_USUARIO = "@elimlldm";

export const INSTAGRAM_URL = "https://www.instagram.com/elimlldm/";
export const TIKTOK_URL = "https://www.tiktok.com/@elimlldm";

export interface RedSocial {
  id: "instagram" | "tiktok";
  nombre: string;
  url: string;
}

export const REDES: RedSocial[] = [
  { id: "instagram", nombre: "Instagram", url: INSTAGRAM_URL },
  { id: "tiktok", nombre: "TikTok", url: TIKTOK_URL },
];
