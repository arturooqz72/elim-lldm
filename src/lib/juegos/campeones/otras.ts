// src/lib/juegos/campeones/otras.ts
//
// Escenas del video de Campeones que no son de un juego: el título
// ("CAMPEONES DE LA SEMANA" con las fechas), la Palabra del Día (mejor
// racha y quién la resolvió más días) y el cierre (≤ 4 s, con movimiento).
import type { CampeonesPalabra, CampeonesPersonaPalabra } from "@/types";
import { avance, COLOR, foto, rebote, rectRedondo, SEGURO, suave, texto, type Ctx } from "@/lib/palabra/video/lienzo";
import { rangoSemana } from "./semana";
import { rayos, tituloJuego } from "./juego";
import { fotoDe, ICONO, type Recursos } from "./recursos";

const IZQUIERDA = SEGURO.x - SEGURO.ancho / 2;
const DERECHA = SEGURO.x + SEGURO.ancho / 2;

/** Íconos de los juegos que van en el video, para el título y el cierre. */
function iconos(r: Recursos): string[] {
  return [...r.c.juegos.map((j) => ICONO[j.id]), ...(r.c.palabra ? [ICONO.palabra] : [])];
}

/** Fila de íconos en fichas doradas que entran saltando y luego giran en ola. */
function fichasIconos(ctx: Ctx, r: Recursos, u: number, t: number, y: number, desde: number, lado = 150): void {
  const lista = iconos(r);
  const hueco = 26;
  const total = lista.length * lado + (lista.length - 1) * hueco;
  lista.forEach((icono, i) => {
    const entra = rebote(avance(u, desde + i * 0.1, 0.45));
    if (entra <= 0) return;
    const fase = ((((u - desde - 0.6 - i * 0.12) / 1.5) % 1) + 1) % 1;
    const giro = u < desde + 0.6 ? 0 : avance(fase, 0, 0.35) * Math.PI * 2;
    ctx.save();
    ctx.translate(SEGURO.x - total / 2 + i * (lado + hueco) + lado / 2, y);
    ctx.scale(entra * Math.max(Math.abs(Math.cos(giro)), 0.04), entra);
    ctx.shadowColor = "rgba(237,184,74,0.9)";
    ctx.shadowBlur = 22 + 16 * Math.sin(t * 4 + i);
    rectRedondo(ctx, -lado / 2, -lado / 2, lado, lado, lado * 0.2);
    const g = ctx.createLinearGradient(0, -lado / 2, 0, lado / 2);
    g.addColorStop(0, COLOR.oroClaro);
    g.addColorStop(1, COLOR.oroOscuro);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    texto(ctx, icono, 0, lado * 0.04, { f: r.f, peso: 400, tam: lado * 0.58, color: COLOR.fondo, max: lado });
    ctx.restore();
  });
}

export function escenaInicio(ctx: Ctx, r: Recursos, u: number, t: number): void {
  const alfa = ctx.globalAlpha;
  rayos(ctx, SEGURO.x, 600, suave(avance(u, 0.1, 0.8)), t, 620);
  const s = rebote(avance(u, 0.1, 0.6));
  if (s > 0) {
    ctx.save();
    ctx.translate(SEGURO.x, 600);
    ctx.scale(s, s);
    ctx.rotate(Math.sin(t * 2.2) * 0.05);
    texto(ctx, "🏆", 0, 0, { f: r.f, peso: 400, tam: 280, color: COLOR.oro, max: 400 });
    ctx.restore();
  }
  const a = (desde: number) => (ctx.globalAlpha = alfa * suave(avance(u, desde, 0.45)));
  a(0.4);
  texto(ctx, "CAMPEONES", SEGURO.x, 850, { f: r.f, peso: 800, tam: 136, color: COLOR.oroClaro, max: SEGURO.ancho, espacio: 4 });
  a(0.6);
  texto(ctx, "DE LA SEMANA", SEGURO.x, 960, { f: r.f, peso: 800, tam: 84, color: COLOR.texto, max: SEGURO.ancho, espacio: 8 });
  a(0.8);
  texto(ctx, rangoSemana(r.c.lunes), SEGURO.x, 1060, { f: r.f, peso: 600, tam: 56, color: COLOR.oro, max: SEGURO.ancho });
  ctx.globalAlpha = alfa;
  fichasIconos(ctx, r, u, t, 1280, 1.0, 140);
}

/** Bloque de la Palabra del Día: etiqueta, foto, nombre y su número. */
function bloque(ctx: Ctx, r: Recursos, y: number, etiqueta: string, p: CampeonesPersonaPalabra, valor: string, u: number, desde: number): void {
  const e = avance(u, desde, 0.6);
  if (e <= 0) return;
  const alfa = ctx.globalAlpha;
  ctx.globalAlpha = alfa * suave(Math.min(e * 1.8, 1));
  ctx.save();
  ctx.translate((1 - rebote(e)) * 700, 0);
  const alto = 420;
  rectRedondo(ctx, IZQUIERDA, y, SEGURO.ancho, alto, 44);
  ctx.fillStyle = "rgba(212,160,23,0.12)";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(212,160,23,0.6)";
  ctx.stroke();
  texto(ctx, etiqueta, SEGURO.x, y + 66, { f: r.f, peso: 800, tam: 58, color: COLOR.oro, max: SEGURO.ancho - 60, espacio: 3 });
  const cy = y + 250;
  foto(ctx, fotoDe(r, p.avatar), p.nombre, IZQUIERDA + 150, cy, 112, r.f);
  const x = IZQUIERDA + 300;
  const ancho = DERECHA - 30 - x;
  texto(ctx, p.nombre, x, cy - 52, { f: r.f, peso: 800, tam: 72, color: COLOR.texto, max: ancho, alinear: "left" });
  texto(ctx, valor, x, cy + 50, { f: r.f, peso: 800, tam: 66, color: COLOR.oroClaro, max: ancho, alinear: "left" });
  ctx.restore();
  ctx.globalAlpha = alfa;
}

export function escenaPalabra(ctx: Ctx, r: Recursos, p: CampeonesPalabra, u: number): void {
  tituloJuego(ctx, r, u, ICONO.palabra, "Palabra del Día", `${p.jugadores} hermanos la jugaron`);
  const dias = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;
  bloque(ctx, r, 560, "🔥 MEJOR RACHA", p.racha, `${dias(p.racha.valor)} seguidos`, u, 0.35);
  bloque(ctx, r, 1030, "✅ LA RESOLVIÓ MÁS DÍAS", p.masDias, `${p.masDias.valor} de 7 días`, u, 0.8);
}

/** Cierre corto (cabe en 4 s): todo entra en el primer segundo y luego late. */
export function escenaCierre(ctx: Ctx, r: Recursos, u: number, t: number): void {
  const alfa = ctx.globalAlpha;
  fichasIconos(ctx, r, u, t, 560, 0, 160);
  const a = (desde: number) => (ctx.globalAlpha = alfa * suave(avance(u, desde, 0.4)));
  a(0.25);
  texto(ctx, "¿Te animas a jugar", SEGURO.x, 810, { f: r.f, peso: 800, tam: 100, color: COLOR.texto, max: SEGURO.ancho });
  texto(ctx, "esta semana?", SEGURO.x, 925, { f: r.f, peso: 800, tam: 100, color: COLOR.texto, max: SEGURO.ancho });
  a(0.5);
  texto(ctx, "Entra a", SEGURO.x, 1060, { f: r.f, peso: 500, tam: 60, color: COLOR.suave, max: SEGURO.ancho });
  const s = rebote(avance(u, 0.65, 0.45));
  if (s > 0) {
    ctx.globalAlpha = alfa;
    const pulso = 1 + 0.07 * Math.pow(Math.sin(u * 3.2), 2);
    ctx.save();
    ctx.translate(SEGURO.x, 1190);
    ctx.scale(s * pulso, s * pulso);
    ctx.shadowColor = "rgba(237,184,74,0.85)";
    ctx.shadowBlur = 30 + 24 * Math.pow(Math.sin(u * 3.2), 2);
    texto(ctx, "elimlldm.net/juegos", 0, 0, { f: r.f, peso: 800, tam: 96, color: COLOR.oro, max: SEGURO.ancho - 30 });
    ctx.restore();
  }
  a(0.9);
  texto(ctx, "Trivia · Ruleta · Ahorcado · Palabra del Día", SEGURO.x, 1330, { f: r.f, peso: 500, tam: 46, color: COLOR.apagado, max: SEGURO.ancho });
  ctx.globalAlpha = alfa;
}
