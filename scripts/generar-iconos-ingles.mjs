// scripts/generar-iconos-ingles.mjs
// Genera los íconos de la app instalable de Elim English (public/ingles/icons)
// a partir del birrete de lucide (GraduationCap) en dorado sobre fondo oscuro,
// igual al ícono que muestra /ingles. Uso: node scripts/generar-iconos-ingles.mjs

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

// sharp viene con Next (no es dependencia directa del proyecto).
const sharp = createRequire(import.meta.resolve("next/package.json"))("sharp");

const FONDO = "#0A0A12";
const DORADO = "#f5c842";
const SALIDA = "public/ingles/icons";

// Trazos de lucide-react "graduation-cap" (viewBox 24x24).
const BIRRETE = `
  <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
  <path d="M22 10v6"/>
  <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>`;

/**
 * @param tam    tamaño final en px
 * @param circulo radio del círculo dorado, como fracción del tamaño
 * @param birrete ancho del birrete, como fracción del tamaño
 */
function svg(tam, circulo, birrete) {
  const c = tam / 2;
  const r = tam * circulo;
  const escala = (tam * birrete) / 24;
  const x = c - 12 * escala;
  const y = c - 12 * escala;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 ${tam} ${tam}">
  <rect width="${tam}" height="${tam}" fill="${FONDO}"/>
  <circle cx="${c}" cy="${c}" r="${r}" fill="${DORADO}" fill-opacity="0.1" stroke="${DORADO}" stroke-opacity="0.33" stroke-width="${tam * 0.012}"/>
  <g transform="translate(${x} ${y}) scale(${escala})" fill="none" stroke="${DORADO}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${BIRRETE}
  </g>
</svg>`;
}

const iconos = [
  // "any": el círculo casi llena el cuadro.
  { archivo: "icon-192.png", tam: 192, circulo: 0.42, birrete: 0.52 },
  { archivo: "icon-512.png", tam: 512, circulo: 0.42, birrete: 0.52 },
  // "maskable": todo dentro de la zona segura (círculo central del 80%).
  { archivo: "icon-512-maskable.png", tam: 512, circulo: 0.32, birrete: 0.4 },
  // iPhone redondea las esquinas solo; fondo opaco sin transparencia.
  { archivo: "apple-touch-icon.png", tam: 180, circulo: 0.4, birrete: 0.5 },
];

mkdirSync(SALIDA, { recursive: true });
for (const i of iconos) {
  await sharp(Buffer.from(svg(i.tam, i.circulo, i.birrete))).png().toFile(`${SALIDA}/${i.archivo}`);
  console.log(`${SALIDA}/${i.archivo}`);
}
