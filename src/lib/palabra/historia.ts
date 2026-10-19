// src/lib/palabra/historia.ts
//
// Imagen vertical (1080×1920) para compartir en historias de Instagram,
// WhatsApp o TikTok al resolver la Palabra del Día: "¡Resolví la Palabra
// del Día en X intentos!", la fecha, la cuadrícula de colores, la racha y
// "Juega en elimlldm.net · @elimlldm". NUNCA lleva la palabra ni las letras
// de los intentos (solo colores), para no arruinarla a nadie.
//
// Instagram tapa unos 250 px arriba y 340 px abajo en las historias: todo
// va entre ZONA.arriba y ZONA.abajo, centrado según cuántos renglones haya.
import type { PalabraColor, PalabraIntento } from "@/types";
import { COLOR_FONDO } from "@/components/juegos/palabra/colores";
import { REDES_USUARIO } from "@/lib/redes";
import { numeroDelDia } from "./logica";
import { ALTO, ANCHO, CENTRO_X, COLOR, fondo, rectRedondo, texto, type Ctx, type Fuentes } from "./video/lienzo";
import { cargarFuentes } from "./video/recursos";

const ZONA = { arriba: 260, abajo: 1620 } as const;
const FICHA = 64;
const ESPACIO = 10;
const RENGLON_TITULO = 96;

export interface DatosHistoria {
  fecha: string;
  intentos: PalabraIntento[];
  racha: number;
}

/** "2026-10-18" → "Domingo 18 de octubre de 2026". */
export function fechaLarga(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const largo = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
  return largo.charAt(0).toLocaleUpperCase("es") + largo.slice(1);
}

function cargarLogo(): Promise<HTMLImageElement | null> {
  return new Promise((listo) => {
    const img = new Image();
    img.onload = () => listo(img);
    img.onerror = () => listo(null);
    img.src = "/icons/icon-192.png";
  });
}

function cuadricula(ctx: Ctx, colores: PalabraColor[][], arriba: number): void {
  colores.forEach((fila, r) => {
    const ancho = fila.length * FICHA + (fila.length - 1) * ESPACIO;
    fila.forEach((c, i) => {
      const x = CENTRO_X - ancho / 2 + i * (FICHA + ESPACIO);
      ctx.fillStyle = COLOR_FONDO[c];
      rectRedondo(ctx, x, arriba + r * (FICHA + ESPACIO), FICHA, FICHA, 10);
      ctx.fill();
    });
  });
}

function pastillaRacha(ctx: Ctx, f: Fuentes, racha: number, centroY: number): void {
  const contenido = `🔥 Racha de ${racha} ${racha === 1 ? "día" : "días"}`;
  ctx.font = `800 46px ${f.texto}`;
  const ancho = Math.min(ctx.measureText(contenido).width + 96, ANCHO - 160);
  rectRedondo(ctx, CENTRO_X - ancho / 2, centroY - 48, ancho, 96, 48);
  ctx.fillStyle = "rgba(212,160,23,0.14)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLOR.oro;
  ctx.stroke();
  texto(ctx, contenido, CENTRO_X, centroY + 2, { f, peso: 800, tam: 46, color: COLOR.oroClaro, max: ancho - 60 });
}

function dibujar(ctx: Ctx, f: Fuentes, logo: HTMLImageElement | null, d: DatosHistoria): void {
  fondo(ctx, 3);
  const n = d.intentos.length;
  const altoCuadricula = n * FICHA + (n - 1) * ESPACIO;
  // Alto de cada bloque (con su espacio de abajo), para centrar todo en la zona.
  const bloques = [110 + 22, 70 + 10, 40 + 56, RENGLON_TITULO * 3 + 20, 50 + 56, altoCuadricula + 64, 96 + 64, 44];
  let y = ZONA.arriba + Math.max((ZONA.abajo - ZONA.arriba - bloques.reduce((a, b) => a + b, 0)) / 2, 0);

  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(CENTRO_X, y + 55, 55, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logo, CENTRO_X - 55, y, 110, 110);
    ctx.restore();
  }
  y += bloques[0];
  texto(ctx, "Elim LLDM", CENTRO_X, y + 35, { f, peso: 700, tam: 60, color: COLOR.oro, titulo: true, espacio: 4 });
  y += bloques[1];
  texto(ctx, `PALABRA DEL DÍA  #${numeroDelDia(d.fecha)}`, CENTRO_X, y + 20, { f, peso: 600, tam: 32, color: COLOR.apagado, espacio: 6 });
  y += bloques[2];

  const intentos = `en ${n} ${n === 1 ? "intento" : "intentos"}!`;
  ["¡Resolví la", "Palabra del Día", intentos].forEach((linea, i) => {
    texto(ctx, linea, CENTRO_X, y + RENGLON_TITULO * (i + 0.5), {
      f,
      peso: 800,
      tam: 88,
      color: i === 2 ? COLOR.oroClaro : COLOR.texto,
      max: ANCHO - 140,
    });
  });
  y += bloques[3];
  texto(ctx, fechaLarga(d.fecha), CENTRO_X, y + 25, { f, peso: 500, tam: 40, color: COLOR.suave });
  y += bloques[4];
  cuadricula(ctx, d.intentos.map((i) => i.colores), y);
  y += bloques[5];
  pastillaRacha(ctx, f, d.racha, y + 48);
  y += bloques[6];
  texto(ctx, `Juega en elimlldm.net · ${REDES_USUARIO}`, CENTRO_X, y + 22, { f, peso: 700, tam: 38, color: COLOR.texto });
}

/** La imagen lista para compartir o descargar (PNG). */
export async function crearHistoria(d: DatosHistoria): Promise<File> {
  const [f, logo] = await Promise.all([cargarFuentes(), cargarLogo()]);
  const lienzo = document.createElement("canvas");
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("Sin lienzo");
  dibujar(ctx, f, logo, d);
  const blob = await new Promise<Blob | null>((listo) => lienzo.toBlob(listo, "image/png"));
  if (!blob) throw new Error("No se pudo crear la imagen");
  return new File([blob], `palabra-del-dia-${d.fecha}.png`, { type: "image/png" });
}
