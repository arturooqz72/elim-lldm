// src/lib/juegos/campeones/juego.ts
//
// Escena de un juego en el video de Campeones: arriba el ícono y el nombre
// del juego; al centro el campeón en grande (foto en círculo dorado, rayos
// y confeti); abajo el 2.º y 3.er lugar en tarjetas que entran desde la
// derecha. Ocupa la pantalla de y≈380 a y≈1470, dentro de SEGURO.
import type { CampeonesFila, CampeonesJuego } from "@/types";
import { avance, COLOR, confeti, foto, rebote, rectRedondo, SEGURO, suave, texto, type Ctx } from "@/lib/palabra/video/lienzo";
import { fotoDe, ICONO, type Recursos } from "./recursos";

const IZQUIERDA = SEGURO.x - SEGURO.ancho / 2;
const DERECHA = SEGURO.x + SEGURO.ancho / 2;
const MEDALLAS = ["🥇", "🥈", "🥉"];

const miles = (n: number) => n.toLocaleString("es-MX");

/** "4,602 pts · 7 partidas" (en el Ahorcado, palabras). */
export function resumen(j: CampeonesJuego, p: CampeonesFila): string {
  const unidad = j.id === "ahorcado" ? (p.partidas === 1 ? "palabra" : "palabras") : p.partidas === 1 ? "partida" : "partidas";
  return `${miles(p.puntos)} pts · ${p.partidas} ${unidad}`;
}

/** Título de la escena: ícono + nombre del juego, y cuántos jugaron. */
export function tituloJuego(ctx: Ctx, r: Recursos, u: number, icono: string, nombre: string, sub: string): void {
  const alfa = ctx.globalAlpha;
  const p = suave(avance(u, 0.05, 0.4));
  ctx.globalAlpha = alfa * p;
  texto(ctx, `${icono} ${nombre.toLocaleUpperCase("es-MX")}`, SEGURO.x, 400 + (1 - p) * 30, {
    f: r.f,
    peso: 800,
    tam: 66,
    color: COLOR.oro,
    espacio: 4,
    max: SEGURO.ancho,
  });
  ctx.globalAlpha = alfa * suave(avance(u, 0.2, 0.4));
  texto(ctx, sub, SEGURO.x, 482, { f: r.f, peso: 500, tam: 46, color: COLOR.apagado, max: SEGURO.ancho });
  ctx.globalAlpha = alfa;
}

/** Rayos de luz que giran detrás de la foto y un resplandor que late. */
export function rayos(ctx: Ctx, cx: number, cy: number, luz: number, t: number, largo = 560): void {
  const alfa = ctx.globalAlpha;
  ctx.save();
  ctx.globalAlpha = alfa * luz * 0.5;
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.25);
  for (let i = 0; i < 14; i++) {
    ctx.rotate((Math.PI * 2) / 14);
    const rayo = ctx.createLinearGradient(0, 0, 0, -largo);
    rayo.addColorStop(0, "rgba(237,184,74,0.55)");
    rayo.addColorStop(1, "rgba(237,184,74,0)");
    ctx.fillStyle = rayo;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-52, -largo);
    ctx.lineTo(52, -largo);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const halo = ctx.createRadialGradient(cx, cy, 60, cx, cy, largo * 0.62 * (1 + 0.06 * Math.sin(t * 4)));
  halo.addColorStop(0, "rgba(212,160,23,0.5)");
  halo.addColorStop(1, "rgba(212,160,23,0)");
  ctx.globalAlpha = alfa * luz;
  ctx.fillStyle = halo;
  ctx.fillRect(cx - largo, cy - largo, largo * 2, largo * 2);
  ctx.globalAlpha = alfa;
}

/** Foto grande que entra con un salto, con su medalla. */
export function fotoCampeon(ctx: Ctx, r: Recursos, nombre: string, avatar: string | null, cx: number, cy: number, radio: number, u: number, medalla = "🥇"): void {
  const s = rebote(avance(u, 0.3, 0.6));
  if (s > 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.shadowColor = "rgba(237,184,74,0.9)";
    ctx.shadowBlur = 50;
    foto(ctx, fotoDe(r, avatar), nombre, 0, 0, radio, r.f);
    ctx.restore();
  }
  const m = rebote(avance(u, 0.7, 0.5));
  if (m > 0) {
    ctx.save();
    ctx.translate(cx + radio * 0.76, cy + radio * 0.72);
    ctx.scale(m, m);
    texto(ctx, medalla, 0, 0, { f: r.f, peso: 400, tam: radio * 0.62, color: COLOR.oro, max: radio });
    ctx.restore();
  }
}

const ALTO_TARJETA = 166;
const SEPARACION = 22;

function tarjeta(ctx: Ctx, r: Recursos, j: CampeonesJuego, p: CampeonesFila, y: number): void {
  rectRedondo(ctx, IZQUIERDA, y, SEGURO.ancho, ALTO_TARJETA, 36);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(212,160,23,0.35)";
  ctx.stroke();
  const centro = y + ALTO_TARJETA / 2;
  texto(ctx, MEDALLAS[p.posicion - 1] ?? String(p.posicion), IZQUIERDA + 66, centro + 4, { f: r.f, peso: 800, tam: 78, color: COLOR.oro, max: 110 });
  foto(ctx, fotoDe(r, p.avatar), p.nombre, IZQUIERDA + 196, centro, 62, r.f);
  const x = IZQUIERDA + 286;
  const ancho = DERECHA - 28 - x;
  texto(ctx, p.nombre, x, y + 56, { f: r.f, peso: 700, tam: 58, color: COLOR.texto, max: ancho, alinear: "left" });
  texto(ctx, resumen(j, p), x, y + 120, { f: r.f, peso: 700, tam: 50, color: COLOR.oroClaro, max: ancho, alinear: "left" });
}

export function escenaJuego(ctx: Ctx, r: Recursos, j: CampeonesJuego, u: number, t: number): void {
  const [campeon, ...resto] = j.podio;
  const unidad = j.id === "ahorcado" ? "palabras jugadas" : j.partidas === 1 ? "partida" : "partidas";
  tituloJuego(ctx, r, u, ICONO[j.id], j.nombre, `${j.jugadores} hermanos jugaron · ${j.partidas} ${unidad}`);
  if (!campeon) return;
  const alfa = ctx.globalAlpha;
  // Sin 2.º y 3.º el campeón baja para no dejar la parte de abajo vacía.
  const baja = resto.length === 0 ? 200 : resto.length === 1 ? 90 : 0;
  const cx = SEGURO.x;
  const cy = 700 + baja;
  const radio = 170;
  rayos(ctx, cx, cy, suave(avance(u, 0.3, 0.8)), t);
  fotoCampeon(ctx, r, campeon.nombre, campeon.avatar, cx, cy, radio, u);

  const n = suave(avance(u, 0.8, 0.45));
  ctx.globalAlpha = alfa * n;
  texto(ctx, campeon.nombre, cx, 950 + baja + (1 - n) * 30, { f: r.f, peso: 800, tam: 100, color: COLOR.texto, max: SEGURO.ancho });
  ctx.globalAlpha = alfa * suave(avance(u, 1.05, 0.45));
  texto(ctx, resumen(j, campeon), cx, 1048 + baja, { f: r.f, peso: 800, tam: 66, color: COLOR.oro, max: SEGURO.ancho });
  ctx.globalAlpha = alfa;
  confeti(ctx, cx, cy, u - 0.55, 110);

  resto.forEach((p, i) => {
    const e = avance(u, 1.3 + i * 0.35, 0.6);
    if (e <= 0) return;
    ctx.globalAlpha = alfa * suave(Math.min(e * 1.8, 1));
    ctx.save();
    ctx.translate((1 - rebote(e)) * 700, 0);
    tarjeta(ctx, r, j, p, 1118 + baja + i * (ALTO_TARJETA + SEPARACION));
    ctx.restore();
    ctx.globalAlpha = alfa;
  });
}
