// src/lib/juegos/campeones/recursos.ts
//
// Lo que el video de Campeones necesita antes del primer cuadro: letras,
// logo y fotos (por la ruta de fotos sin CORS de la Palabra del Día).
import type { CampeonesSemana } from "@/types";
import type { Fuentes } from "@/lib/palabra/video/lienzo";
import { cargarFuentes, cargarImagen, fotoDesdeServidor } from "@/lib/palabra/video/recursos";

export interface Recursos {
  c: CampeonesSemana;
  f: Fuentes;
  logo: HTMLImageElement | null;
  /** Por la URL original del perfil; null = se pone la inicial. */
  fotos: Map<string, HTMLImageElement | null>;
}

/** Ícono de cada juego (emoji: se dibuja igual en el lienzo y en la página). */
export const ICONO = { trivia: "🧠", ahorcado: "✍️", ruleta: "🎡", palabra: "📖" } as const;

export async function cargarRecursos(c: CampeonesSemana): Promise<Recursos> {
  const personas = [...c.juegos.flatMap((j) => j.podio), ...(c.palabra ? [c.palabra.racha, c.palabra.masDias] : [])];
  const urls = [...new Set(personas.map((p) => p.avatar).filter((u): u is string => Boolean(u)))];
  const [f, logo, imagenes] = await Promise.all([
    cargarFuentes(),
    cargarImagen("/icons/icon-192.png"),
    Promise.all(urls.map((u) => cargarImagen(fotoDesdeServidor(u)))),
  ]);
  return { c, f, logo, fotos: new Map(urls.map((u, i) => [u, imagenes[i]])) };
}

export const fotoDe = (r: Recursos, avatar: string | null) => (avatar ? (r.fotos.get(avatar) ?? null) : null);
