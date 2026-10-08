// scripts/generar-iconos-radio.mjs
// Genera los íconos de la app instalable de Radio Elim (public/escuchar/icons)
// a partir de la antena de lucide (RadioTower) en dorado sobre fondo oscuro.
// Distinto al de Elim English (birrete dentro de un círculo): aquí la antena
// va sobre un resplandor dorado, sin círculo.
// Uso: node scripts/generar-iconos-radio.mjs

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

// sharp viene con Next (no es dependencia directa del proyecto).
const sharp = createRequire(import.meta.resolve("next/package.json"))("sharp");

const FONDO = "#0A0A12";
const DORADO = "#D4A017";
const DORADO_CLARO = "#EDB84A";
const SALIDA = "public/escuchar/icons";

// Trazos de lucide-react "radio-tower" (viewBox 24x24).
const ANTENA = `
  <path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9"/>
  <path d="M7.8 4.7a6.14 6.14 0 0 0-.8 7.5"/>
  <circle cx="12" cy="9" r="2"/>
  <path d="M16.2 4.8c2 2 2.26 5.11.8 7.47"/>
  <path d="M19.1 1.9a9.96 9.96 0 0 1 0 14.1"/>
  <path d="M9.5 18h5"/>
  <path d="m8 22 4-11 4 11"/>`;

/**
 * @param tam    tamaño final en px
 * @param antena ancho de la antena, como fracción del tamaño
 */
function svg(tam, antena) {
  const c = tam / 2;
  const escala = (tam * antena) / 24;
  const x = c - 12 * escala;
  const y = c - 12 * escala;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 ${tam} ${tam}">
  <defs>
    <radialGradient id="brillo" cx="50%" cy="42%" r="50%">
      <stop offset="0%" stop-color="${DORADO}" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="${DORADO}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="oro" gradientUnits="userSpaceOnUse" x1="0" y1="1" x2="0" y2="23">
      <stop offset="0%" stop-color="${DORADO_CLARO}"/>
      <stop offset="100%" stop-color="${DORADO}"/>
    </linearGradient>
  </defs>
  <rect width="${tam}" height="${tam}" fill="${FONDO}"/>
  <rect width="${tam}" height="${tam}" fill="url(#brillo)"/>
  <g transform="translate(${x} ${y}) scale(${escala})" fill="none" stroke="url(#oro)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ANTENA}
  </g>
</svg>`;
}

const iconos = [
  // "any": la antena casi llena el cuadro.
  { archivo: "icon-192.png", tam: 192, antena: 0.66 },
  { archivo: "icon-512.png", tam: 512, antena: 0.66 },
  // "maskable": todo dentro de la zona segura (círculo central del 80%).
  { archivo: "icon-512-maskable.png", tam: 512, antena: 0.5 },
  // iPhone redondea las esquinas solo; fondo opaco sin transparencia.
  { archivo: "apple-touch-icon.png", tam: 180, antena: 0.62 },
];

mkdirSync(SALIDA, { recursive: true });
for (const i of iconos) {
  await sharp(Buffer.from(svg(i.tam, i.antena))).png().toFile(`${SALIDA}/${i.archivo}`);
  console.log(`${SALIDA}/${i.archivo}`);
}
