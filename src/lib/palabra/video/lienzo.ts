// src/lib/palabra/video/lienzo.ts
//
// Herramientas de dibujo para el video de TikTok de la Palabra del Día:
// colores de Elim LLDM, curvas de animación, texto que se ajusta al
// ancho, fotos redondas y confeti. Todo se dibuja en un lienzo de
// 1080×1920 (9:16), el tamaño que pide TikTok.

export const ANCHO = 1080;
export const ALTO = 1920;
export const CENTRO_X = ANCHO / 2;

export const COLOR = {
  fondo: "#0A0A12",
  superficie: "#1C1C2E",
  oro: "#D4A017",
  oroClaro: "#EDB84A",
  oroOscuro: "#A07810",
  texto: "#F8F8FF",
  suave: "#C9C4B5",
  apagado: "#9090A8",
} as const;

/** Familias de letra ya cargadas (Inter y Cinzel de next/font). */
export interface Fuentes {
  texto: string;
  titulo: string;
}

export type Ctx = CanvasRenderingContext2D;

export const limitar = (v: number, min = 0, max = 1) => Math.min(Math.max(v, min), max);
/** Avance de 0 a 1 entre `desde` y `desde + dura` segundos. */
export const avance = (t: number, desde: number, dura: number) => limitar((t - desde) / dura);
export const suave = (x: number) => 1 - Math.pow(1 - x, 3);
/** Se pasa un poquito y regresa: para que las cosas "salten" al aparecer. */
export const rebote = (x: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

export function fuente(f: Fuentes, peso: number, tam: number, titulo = false): string {
  return `${peso} ${tam}px ${titulo ? f.titulo : f.texto}`;
}

/** Texto centrado (o alineado) que se achica hasta caber en `max` px de ancho. */
export function texto(
  ctx: Ctx,
  contenido: string,
  x: number,
  y: number,
  opciones: { f: Fuentes; peso: number; tam: number; color: string; max?: number; titulo?: boolean; alinear?: CanvasTextAlign; espacio?: number }
): void {
  const { f, peso, color, max = ANCHO - 160, titulo = false, alinear = "center", espacio = 0 } = opciones;
  let tam = opciones.tam;
  ctx.textAlign = alinear;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.letterSpacing = `${espacio}px`;
  ctx.font = fuente(f, peso, tam, titulo);
  while (tam > 20 && ctx.measureText(contenido).width > max) {
    tam -= 2;
    ctx.font = fuente(f, peso, tam, titulo);
  }
  ctx.fillText(contenido, x, y);
  ctx.letterSpacing = "0px";
}

/** Parte un texto en renglones de `max` px; si no cabe en `lineas`, termina en "…". */
export function renglones(ctx: Ctx, contenido: string, max: number, lineas: number): string[] {
  const palabras = contenido.split(/\s+/).filter(Boolean);
  const salida: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width <= max || !actual) {
      actual = prueba;
    } else {
      salida.push(actual);
      actual = p;
    }
  }
  if (actual) salida.push(actual);
  if (salida.length <= lineas) return salida;
  const cortado = salida.slice(0, lineas);
  let ultima = cortado[lineas - 1];
  while (ultima.length > 1 && ctx.measureText(`${ultima}…`).width > max) ultima = ultima.slice(0, -1);
  cortado[lineas - 1] = `${ultima.replace(/[\s,.;:]+$/, "")}…`;
  return cortado;
}

export function rectRedondo(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Foto redonda con borde dorado; sin foto (o si no se pudo usar), la inicial. */
export function foto(
  ctx: Ctx,
  img: HTMLImageElement | null,
  nombre: string,
  x: number,
  y: number,
  r: number,
  f: Fuentes
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
  if (img) {
    ctx.save();
    ctx.clip();
    // Recorte cuadrado del centro, como object-fit: cover.
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - lado) / 2;
    const sy = (img.naturalHeight - lado) / 2;
    ctx.drawImage(img, sx, sy, lado, lado, x - r, y - r, r * 2, r * 2);
    ctx.restore();
  } else {
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, "#2A2440");
    g.addColorStop(1, "#16121F");
    ctx.fillStyle = g;
    ctx.fill();
    texto(ctx, inicial(nombre), x, y + r * 0.04, { f, peso: 800, tam: r * 0.95, color: COLOR.oro, max: r * 1.6 });
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(r * 0.07, 4);
  ctx.strokeStyle = COLOR.oro;
  ctx.stroke();
  ctx.restore();
}

function inicial(nombre: string): string {
  // "Hermano/a participante" no tiene foto ni inicial propia: una paloma.
  if (nombre.startsWith("Hermano/a")) return "🕊";
  return [...nombre.trim()][0]?.toLocaleUpperCase("es") ?? "?";
}

/** Número pseudoaleatorio fijo por semilla: el confeti sale igual en la vista previa y en el video. */
export function azar(semilla: number): number {
  const x = Math.sin(semilla * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const COLORES_CONFETI = [COLOR.oro, COLOR.oroClaro, "#FFF4D6", "#F8F8FF", "#C99A2E"];

/** Explosión de confeti desde (x, y); `u` = segundos desde que estalló. */
export function confeti(ctx: Ctx, x: number, y: number, u: number, cantidad = 150): void {
  if (u < 0 || u > 4.5) return;
  const gravedad = 900;
  for (let i = 0; i < cantidad; i++) {
    const angulo = azar(i + 1) * Math.PI * 2;
    const fuerza = 500 + azar(i + 101) * 1100;
    const vx = Math.cos(angulo) * fuerza;
    const vy = Math.sin(angulo) * fuerza - 600;
    // Freno del aire: se abre rápido y luego cae despacio.
    const freno = (1 - Math.exp(-2.2 * u)) / 2.2;
    const px = x + vx * freno;
    const py = y + vy * freno + 0.5 * gravedad * u * u * 0.55;
    if (py > ALTO + 40) continue;
    const giro = u * (4 + azar(i + 7) * 8) + i;
    const alfa = limitar(1.6 - u / 2.8);
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.translate(px, py);
    ctx.rotate(giro);
    ctx.scale(1, Math.cos(giro * 1.7));
    ctx.fillStyle = COLORES_CONFETI[i % COLORES_CONFETI.length];
    if (i % 3 === 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-14, -6, 28, 12);
    }
    ctx.restore();
  }
}

/** Fondo de todas las escenas: noche con un resplandor dorado arriba y polvo de oro flotando. */
export function fondo(ctx: Ctx, t: number): void {
  ctx.fillStyle = COLOR.fondo;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  const brillo = ctx.createRadialGradient(CENTRO_X, -120, 40, CENTRO_X, -120, 1250);
  brillo.addColorStop(0, "rgba(212,160,23,0.34)");
  brillo.addColorStop(0.45, "rgba(212,160,23,0.08)");
  brillo.addColorStop(1, "rgba(212,160,23,0)");
  ctx.fillStyle = brillo;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  const abajo = ctx.createRadialGradient(CENTRO_X, ALTO + 200, 40, CENTRO_X, ALTO + 200, 900);
  abajo.addColorStop(0, "rgba(160,120,16,0.16)");
  abajo.addColorStop(1, "rgba(160,120,16,0)");
  ctx.fillStyle = abajo;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  for (let i = 0; i < 46; i++) {
    const x = azar(i + 300) * ANCHO + Math.sin(t * 0.6 + i) * 18;
    const y = (azar(i + 500) * ALTO - t * (14 + azar(i + 700) * 26) + ALTO) % ALTO;
    const r = 1.5 + azar(i + 900) * 3.5;
    ctx.globalAlpha = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(t * 1.4 + i * 2.1));
    ctx.fillStyle = COLOR.oroClaro;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
