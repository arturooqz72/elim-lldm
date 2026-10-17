// src/lib/palabra/video/listas.ts
//
// Escenas con tarjetas del video de TikTok: "Top 3 del día" y "Va
// adelante esta semana". Cada tarjeta entra sola desde la derecha, con un
// pequeño rebote, una después de otra. Todo queda dentro de SEGURO
// (lienzo.ts): ni la descripción ni los botones de TikTok lo tapan.
import type { PalabraTarjetaTikTok } from "@/types";
import { avance, COLOR, foto, rebote, rectRedondo, SEGURO, suave, texto, type Ctx, type Fuentes } from "./lienzo";

export interface Recursos {
  t: PalabraTarjetaTikTok;
  f: Fuentes;
  /** Fotos ya cargadas, por la URL original del perfil; null = se pone la inicial. */
  fotos: Map<string, HTMLImageElement | null>;
  logo: HTMLImageElement | null;
}

const MEDALLAS = ["🥇", "🥈", "🥉"];
const ALTO_TARJETA = 250;
const SEPARACION = 34;
/** Las tarjetas se centran alrededor de esta altura (entre el título y la zona tapada). */
const CENTRO_TARJETAS = 1020;
const PRIMERA_MINIMA = 560;
/** Segundos entre que entra una tarjeta y la siguiente. */
const ESCALON = 0.45;
const ALTO_MAS = 80;

const IZQUIERDA = SEGURO.x - SEGURO.ancho / 2;
const DERECHA = SEGURO.x + SEGURO.ancho / 2;

interface Tarjeta {
  posicion: number;
  nombre: string;
  avatar: string | null;
  /** En dorado y grande: "12 pts" o "3 intentos". */
  principal: string;
  /** Al lado, más chico: "5 días jugados" o "+4 pts". */
  secundario: string | null;
}

export function titulo(ctx: Ctx, r: Recursos, u: number, contenido: string, y = 420): void {
  const p = suave(avance(u, 0.05, 0.4));
  const alfa = ctx.globalAlpha;
  ctx.globalAlpha = alfa * p;
  texto(ctx, contenido, SEGURO.x, y + (1 - p) * 30, {
    f: r.f,
    peso: 800,
    tam: 60,
    color: COLOR.oro,
    espacio: 8,
    max: SEGURO.ancho,
  });
  ctx.globalAlpha = alfa;
}

function tarjeta(ctx: Ctx, r: Recursos, fila: Tarjeta, y: number): void {
  const primero = fila.posicion === 1;
  rectRedondo(ctx, IZQUIERDA, y, SEGURO.ancho, ALTO_TARJETA, 44);
  ctx.fillStyle = primero ? "rgba(212,160,23,0.16)" : "rgba(255,255,255,0.06)";
  ctx.fill();
  ctx.lineWidth = primero ? 5 : 3;
  ctx.strokeStyle = primero ? "rgba(212,160,23,0.8)" : "rgba(212,160,23,0.3)";
  ctx.stroke();

  const centro = y + ALTO_TARJETA / 2;
  texto(ctx, MEDALLAS[fila.posicion - 1] ?? String(fila.posicion), IZQUIERDA + 78, centro + 4, {
    f: r.f,
    peso: 800,
    tam: 96,
    color: COLOR.oro,
    max: 130,
  });
  foto(ctx, fila.avatar ? (r.fotos.get(fila.avatar) ?? null) : null, fila.nombre, IZQUIERDA + 232, centro, 92, r.f);

  const x = IZQUIERDA + 350;
  const ancho = DERECHA - 30 - x;
  texto(ctx, fila.nombre, x, y + 82, { f: r.f, peso: 700, tam: 62, color: COLOR.texto, max: ancho, alinear: "left" });
  texto(ctx, fila.principal, x, y + 172, { f: r.f, peso: 800, tam: 75, color: COLOR.oro, max: ancho, alinear: "left" });
  if (fila.secundario) {
    const usado = Math.min(ctx.measureText(fila.principal).width, ancho);
    const resto = ancho - usado - 22;
    if (resto > 80) {
      texto(ctx, fila.secundario, x + usado + 22, y + 178, {
        f: r.f,
        peso: 500,
        tam: 46,
        color: COLOR.apagado,
        max: resto,
        alinear: "left",
      });
    }
  }
}

/** Dibuja las tarjetas centradas en la pantalla; devuelve dónde terminan. */
function dibujarTarjetas(ctx: Ctx, r: Recursos, u: number, filas: Tarjeta[], conMas: boolean): number {
  const bloque = filas.length * ALTO_TARJETA + (filas.length - 1) * SEPARACION + (conMas ? ALTO_MAS : 0);
  const primera = Math.max(CENTRO_TARJETAS - bloque / 2, PRIMERA_MINIMA);
  filas.forEach((fila, i) => {
    const p = avance(u, 0.35 + i * ESCALON, 0.6);
    if (p <= 0) return;
    const y = primera + i * (ALTO_TARJETA + SEPARACION);
    const alfa = ctx.globalAlpha;
    ctx.globalAlpha = alfa * suave(Math.min(p * 1.8, 1));
    ctx.save();
    ctx.translate((1 - rebote(p)) * 700, 0);
    tarjeta(ctx, r, fila, y);
    ctx.restore();
    ctx.globalAlpha = alfa;
  });
  return primera + filas.length * (ALTO_TARJETA + SEPARACION) - SEPARACION;
}

/** "y N hermanos más …" debajo de las tarjetas. */
function yMas(ctx: Ctx, r: Recursos, u: number, y: number, n: number, cola: string, inicio: number): void {
  if (n <= 0) return;
  const p = suave(avance(u, inicio, 0.5));
  const alfa = ctx.globalAlpha;
  ctx.globalAlpha = alfa * p;
  const hermanos = `${n} ${n === 1 ? "hermano" : "hermanos"}`;
  texto(ctx, `y ${hermanos} más ${cola}`, SEGURO.x, y + ALTO_MAS / 2 + 10, {
    f: r.f,
    peso: 500,
    tam: 48,
    color: COLOR.suave,
    max: SEGURO.ancho,
  });
  ctx.globalAlpha = alfa;
}

const intentos = (n: number) => `${n} ${n === 1 ? "intento" : "intentos"}`;
const puntos = (n: number) => `${n} ${n === 1 ? "pt" : "pts"}`;

export function escenaTopDia(ctx: Ctx, r: Recursos, u: number): void {
  const { ganador, top3, otrosDia } = r.t;
  titulo(ctx, r, u, "TOP 3 DEL DÍA");
  if (!ganador) return;
  const filas: Tarjeta[] = [ganador, ...top3].map((p) => ({
    posicion: p.posicion,
    nombre: p.nombre,
    avatar: p.avatar,
    principal: intentos(p.intentos),
    secundario: `+${puntos(p.puntos)}`,
  }));
  const fin = dibujarTarjetas(ctx, r, u, filas, otrosDia > 0);
  yMas(ctx, r, u, fin, otrosDia, otrosDia === 1 ? "la resolvió" : "la resolvieron", 0.5 + filas.length * ESCALON);
}

/**
 * Siempre los 3 primeros de la semana: quien no dio permiso sale como
 * "Hermano/a participante", sin foto (lo decide getTarjetaTikTok).
 */
export function escenaSemana(ctx: Ctx, r: Recursos, u: number, rango: string): void {
  const { top3Semana, otrosSemana } = r.t;
  titulo(ctx, r, u, "VA ADELANTE ESTA SEMANA");
  const alfa = ctx.globalAlpha;
  ctx.globalAlpha = alfa * suave(avance(u, 0.2, 0.4));
  texto(ctx, rango, SEGURO.x, 500, { f: r.f, peso: 500, tam: 50, color: COLOR.apagado, max: SEGURO.ancho });
  ctx.globalAlpha = alfa;
  if (top3Semana.length === 0) return;

  const filas: Tarjeta[] = top3Semana.map((s) => ({
    posicion: s.posicion,
    nombre: s.nombre,
    avatar: s.avatar,
    principal: puntos(s.puntos),
    secundario: `${s.dias} ${s.dias === 1 ? "día jugado" : "días jugados"}`,
  }));
  const fin = dibujarTarjetas(ctx, r, u, filas, otrosSemana > 0);
  yMas(ctx, r, u, fin, otrosSemana, otrosSemana === 1 ? "sumó puntos" : "sumaron puntos", 0.5 + filas.length * ESCALON);
}
