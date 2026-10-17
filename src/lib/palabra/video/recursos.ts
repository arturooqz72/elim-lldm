// src/lib/palabra/video/recursos.ts
//
// Carga lo que el video necesita antes del primer cuadro: las letras de
// Elim LLDM (Inter y Cinzel, de next/font) y las imágenes. Las fotos de
// perfil (Google, Facebook) se piden a nuestra ruta /api/admin/palabra/
// tiktok/foto, que las baja en grande y las sirve desde nuestro dominio:
// así el lienzo no queda "sucio" por CORS y se puede grabar. Si una foto
// no se puede bajar, se pone la inicial.
import type { PalabraTarjetaTikTok } from "@/types";
import type { Fuentes } from "./lienzo";
import type { Recursos } from "./listas";

const RESPALDO = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function familia(variable: string, respaldo: string): string {
  const valor = getComputedStyle(document.body).getPropertyValue(variable).trim();
  return valor ? `${valor}, ${respaldo}` : respaldo;
}

async function cargarFuentes(): Promise<Fuentes> {
  const f = {
    texto: familia("--font-inter", RESPALDO),
    titulo: familia("--font-cinzel", `Georgia, serif`),
  };
  await Promise.all([
    ...[400, 500, 600, 700, 800].map((peso) => document.fonts.load(`${peso} 40px ${f.texto}`)),
    document.fonts.load(`700 40px ${f.titulo}`),
  ]).catch(() => undefined);
  return f;
}

const fotoDesdeServidor = (avatar: string) => `/api/admin/palabra/tiktok/foto?url=${encodeURIComponent(avatar)}`;

function cargarImagen(src: string): Promise<HTMLImageElement | null> {
  return new Promise((listo) => {
    const img = new Image();
    // La primera vez el servidor baja la foto y la guarda en B2: puede tardar.
    const plazo = setTimeout(() => listo(null), 15000);
    img.onload = () => {
      clearTimeout(plazo);
      listo(img);
    };
    img.onerror = () => {
      clearTimeout(plazo);
      listo(null);
    };
    img.src = src;
  });
}

export async function cargarRecursos(t: PalabraTarjetaTikTok): Promise<Recursos> {
  const urls = [
    ...new Set([t.ganador, ...t.top3, ...t.top3Semana].map((p) => p?.avatar).filter((u): u is string => Boolean(u))),
  ];
  const [f, logo, imagenes] = await Promise.all([
    cargarFuentes(),
    cargarImagen("/icons/icon-192.png"),
    Promise.all(urls.map((u) => cargarImagen(fotoDesdeServidor(u)))),
  ]);
  return { t, f, logo, fotos: new Map(urls.map((u, i) => [u, imagenes[i]])) };
}
