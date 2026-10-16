// src/lib/palabra/video/listas.ts
//
// Escenas con renglones del video de TikTok: "Top 3 del día" y "Va
// adelante esta semana". Cada renglón entra deslizándose desde la derecha.
import type { PalabraTarjetaTikTok } from "@/types";
import { avance, COLOR, foto, rectRedondo, suave, texto, type Ctx, type Fuentes } from "./lienzo";

export interface Recursos {
  t: PalabraTarjetaTikTok;
  f: Fuentes;
  /** Fotos ya cargadas por URL; null = no se pudo usar (se pone la inicial). */
  fotos: Map<string, HTMLImageElement | null>;
  logo: HTMLImageElement | null;
}

const MEDALLAS = ["🥇", "🥈", "🥉"];
const ALTO_RENGLON = 180;
const SEPARACION = 28;
const PRIMER_RENGLON = 560;

interface Renglon {
  posicion: number;
  nombre: string;
  avatar: string | null;
  derecha: string;
  debajo: string | null;
}

export function titulo(ctx: Ctx, r: Recursos, u: number, contenido: string, y = 430): void {
  const p = suave(avance(u, 0.05, 0.4));
  const alfa = ctx.globalAlpha;
  ctx.globalAlpha = alfa * p;
  texto(ctx, contenido, 540, y + (1 - p) * 30, { f: r.f, peso: 800, tam: 46, color: COLOR.oro, espacio: 8 });
  ctx.globalAlpha = alfa;
}

function dibujarRenglones(ctx: Ctx, r: Recursos, u: number, filas: Renglon[]): number {
  filas.forEach((fila, i) => {
    const p = suave(avance(u, 0.35 + i * 0.3, 0.55));
    if (p <= 0) return;
    const y = PRIMER_RENGLON + i * (ALTO_RENGLON + SEPARACION);
    const dx = (1 - p) * 700;
    const centro = y + ALTO_RENGLON / 2;
    const alfa = ctx.globalAlpha;
    ctx.globalAlpha = alfa * p;
    ctx.save();
    ctx.translate(dx, 0);

    const primero = fila.posicion === 1;
    rectRedondo(ctx, 70, y, 940, ALTO_RENGLON, 40);
    ctx.fillStyle = primero ? "rgba(212,160,23,0.14)" : "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.lineWidth = primero ? 4 : 2;
    ctx.strokeStyle = primero ? "rgba(212,160,23,0.75)" : "rgba(212,160,23,0.22)";
    ctx.stroke();

    texto(ctx, MEDALLAS[fila.posicion - 1] ?? String(fila.posicion), 148, centro + 4, {
      f: r.f,
      peso: 800,
      tam: 76,
      color: COLOR.oro,
      max: 110,
    });
    foto(ctx, fila.avatar ? (r.fotos.get(fila.avatar) ?? null) : null, fila.nombre, 268, centro, 60, r.f);
    const yNombre = fila.debajo ? centro - 22 : centro;
    texto(ctx, fila.nombre, 352, yNombre, { f: r.f, peso: 700, tam: 54, color: COLOR.texto, max: 400, alinear: "left" });
    if (fila.debajo) {
      texto(ctx, fila.debajo, 352, centro + 34, { f: r.f, peso: 500, tam: 36, color: COLOR.apagado, max: 400, alinear: "left" });
    }
    texto(ctx, fila.derecha, 978, centro, { f: r.f, peso: 800, tam: 50, color: COLOR.oro, max: 190, alinear: "right" });

    ctx.restore();
    ctx.globalAlpha = alfa;
  });
  return PRIMER_RENGLON + filas.length * (ALTO_RENGLON + SEPARACION);
}

/** "y N hermanos más …" debajo de la lista. */
function yMas(ctx: Ctx, r: Recursos, u: number, y: number, n: number, cola: string, inicio: number): void {
  if (n <= 0) return;
  const p = suave(avance(u, inicio, 0.5));
  const alfa = ctx.globalAlpha;
  ctx.globalAlpha = alfa * p;
  const hermanos = `${n} ${n === 1 ? "hermano" : "hermanos"}`;
  texto(ctx, `y ${hermanos} más ${cola}`, 540, y + 40, { f: r.f, peso: 500, tam: 42, color: COLOR.suave });
  ctx.globalAlpha = alfa;
}

const intentos = (n: number) => `${n} ${n === 1 ? "intento" : "intentos"}`;

export function escenaTopDia(ctx: Ctx, r: Recursos, u: number): void {
  const { ganador, top3, otrosDia } = r.t;
  titulo(ctx, r, u, "TOP 3 DEL DÍA");
  if (!ganador) return;
  const filas: Renglon[] = [ganador, ...top3].map((p) => ({
    posicion: p.posicion,
    nombre: p.nombre,
    avatar: p.avatar,
    derecha: intentos(p.intentos),
    debajo: null,
  }));
  const fin = dibujarRenglones(ctx, r, u, filas);
  yMas(ctx, r, u, fin, otrosDia, otrosDia === 1 ? "la resolvió" : "la resolvieron", 0.4 + filas.length * 0.3);
}

export function escenaSemana(ctx: Ctx, r: Recursos, u: number, rango: string): void {
  const { top3Semana, otrosSemana } = r.t;
  titulo(ctx, r, u, "VA ADELANTE ESTA SEMANA");
  const p = suave(avance(u, 0.2, 0.4));
  const alfa = ctx.globalAlpha;
  ctx.globalAlpha = alfa * p;
  texto(ctx, rango, 540, 492, { f: r.f, peso: 500, tam: 38, color: COLOR.apagado });
  ctx.globalAlpha = alfa;

  if (top3Semana.length === 0) {
    // Nadie de los primeros dio permiso: solo el número, sin nombres.
    const q = suave(avance(u, 0.4, 0.5));
    ctx.globalAlpha = alfa * q;
    const n = otrosSemana;
    texto(ctx, `${n} ${n === 1 ? "hermano sumó" : "hermanos sumaron"} puntos`, 540, 720, {
      f: r.f,
      peso: 700,
      tam: 56,
      color: COLOR.texto,
    });
    ctx.globalAlpha = alfa;
    return;
  }
  const filas: Renglon[] = top3Semana.map((s) => ({
    posicion: s.posicion,
    nombre: s.nombre,
    avatar: s.avatar,
    derecha: `${s.puntos} pts`,
    debajo: `${s.dias} ${s.dias === 1 ? "día jugado" : "días jugados"}`,
  }));
  const fin = dibujarRenglones(ctx, r, u, filas);
  yMas(ctx, r, u, fin, otrosSemana, otrosSemana === 1 ? "sumó puntos" : "sumaron puntos", 0.4 + filas.length * 0.3);
}
