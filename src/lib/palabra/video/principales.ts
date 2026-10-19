// src/lib/palabra/video/principales.ts
//
// Escenas grandes del video de TikTok: la palabra (fichas que se voltean
// cuando la voz la dice), el ganador (foto en círculo dorado con rayos y
// confeti) y el cierre (fichas "?" que giran y elimlldm.net latiendo).
// Todo va centrado en la zona segura (SEGURO en lienzo.ts) y ocupa la
// pantalla de arriba abajo; `u` = segundos desde que empezó la escena.
import {
  avance,
  COLOR,
  confeti,
  foto,
  fuente,
  rebote,
  rectRedondo,
  renglones,
  SEGURO,
  suave,
  texto,
  type Ctx,
} from "./lienzo";
import { titulo, type Recursos } from "./listas";

const HUECO = 18;
const MIN_JUGADORES_VISIBLE = 5;

/** Tamaño de ficha para que la palabra quepa en la zona segura. */
function ladoFicha(n: number, maximo: number): number {
  return Math.min(maximo, (SEGURO.ancho - HUECO * (n - 1)) / n);
}

function caraFicha(ctx: Ctx, r: Recursos, letra: string, lado: number, dorada: boolean): void {
  rectRedondo(ctx, -lado / 2, -lado / 2, lado, lado, lado * 0.14);
  if (dorada) {
    const g = ctx.createLinearGradient(0, -lado / 2, 0, lado / 2);
    g.addColorStop(0, COLOR.oroClaro);
    g.addColorStop(1, COLOR.oroOscuro);
    ctx.fillStyle = g;
    ctx.fill();
    texto(ctx, letra, 0, lado * 0.04, { f: r.f, peso: 800, tam: lado * 0.6, color: COLOR.fondo, max: lado });
  } else {
    ctx.fillStyle = COLOR.superficie;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(212,160,23,0.55)";
    ctx.stroke();
  }
}

/** Fichas de la palabra que se voltean una por una, como al jugar. */
function fichas(ctx: Ctx, r: Recursos, u: number, letras: string[], y: number, desde: number): void {
  const lado = ladoFicha(letras.length, 190);
  const total = letras.length * lado + (letras.length - 1) * HUECO;
  letras.forEach((letra, i) => {
    const x = SEGURO.x - total / 2 + i * (lado + HUECO) + lado / 2;
    const p = avance(u, desde + i * 0.22, 0.45);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, Math.max(Math.abs(Math.cos(Math.PI * p)), 0.02));
    caraFicha(ctx, r, letra, lado, p >= 0.5);
    ctx.restore();
  });
}

/** Centro vertical de la zona segura: con explicación corta, todo baja para no dejar hueco abajo. */
const CENTRO_ZONA = (SEGURO.arriba + SEGURO.abajo) / 2;
const RENGLON = 84;

export function escenaPalabra(ctx: Ctx, r: Recursos, u: number, fecha: string, voltear = 0.6): void {
  const { t } = r;
  const conJugadores = t.jugadores >= MIN_JUGADORES_VISIBLE;
  ctx.font = fuente(r.f, 400, 63);
  const lineas = t.palabra ? renglones(ctx, t.palabra.explicacion, SEGURO.ancho, conJugadores ? 5 : 6) : [];
  const fin = t.palabra ? 1005 + (lineas.length - 1) * RENGLON + (conJugadores ? 115 : 0) : 900;
  ctx.save();
  ctx.translate(0, Math.max(CENTRO_ZONA - (400 + fin) / 2, 0));
  dibujarPalabra(ctx, r, u, fecha, voltear, lineas, conJugadores);
  ctx.restore();
}

function dibujarPalabra(
  ctx: Ctx,
  r: Recursos,
  u: number,
  fecha: string,
  voltear: number,
  lineas: string[],
  conJugadores: boolean
): void {
  const { t } = r;
  titulo(ctx, r, u, "PALABRA DEL DÍA", 400);
  const alfa = ctx.globalAlpha;
  const aparece = (desde: number, dura = 0.5) => {
    ctx.globalAlpha = alfa * suave(avance(u, desde, dura));
  };
  aparece(0.25);
  texto(ctx, fecha, SEGURO.x, 480, { f: r.f, peso: 500, tam: 52, color: COLOR.apagado, max: SEGURO.ancho });
  ctx.globalAlpha = alfa;

  if (!t.palabra) {
    texto(ctx, "Sin palabra este día", SEGURO.x, 900, { f: r.f, peso: 700, tam: 80, color: COLOR.texto, max: SEGURO.ancho });
    return;
  }
  fichas(ctx, r, u, [...t.palabra.palabra], 690, voltear);

  // La cita aparece rápido junto con la palabra: hay solo un segundo antes del ganador.
  aparece(voltear, 0.25);
  texto(ctx, `📖 ${t.palabra.referencia}`, SEGURO.x, 905, { f: r.f, peso: 700, tam: 78, color: COLOR.oro, max: SEGURO.ancho });

  aparece(voltear + 0.1, 0.25);
  lineas.forEach((l, i) =>
    texto(ctx, l, SEGURO.x, 1005 + i * RENGLON, { f: r.f, peso: 400, tam: 63, color: COLOR.suave, max: SEGURO.ancho })
  );
  if (conJugadores) {
    aparece(voltear + 0.3, 0.25);
    texto(ctx, `🙌 ${t.jugadores} hermanos jugaron`, SEGURO.x, 1005 + (lineas.length - 1) * RENGLON + 115, {
      f: r.f,
      peso: 700,
      tam: 62,
      color: COLOR.texto,
      max: SEGURO.ancho,
    });
  }
  ctx.globalAlpha = alfa;
}

/** Rayos de luz que giran detrás de la foto y un resplandor que late. */
function rayos(ctx: Ctx, cx: number, cy: number, luz: number, t: number): void {
  const alfa = ctx.globalAlpha;
  ctx.save();
  ctx.globalAlpha = alfa * luz * 0.55;
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.25);
  for (let i = 0; i < 14; i++) {
    ctx.rotate((Math.PI * 2) / 14);
    const rayo = ctx.createLinearGradient(0, 0, 0, -680);
    rayo.addColorStop(0, "rgba(237,184,74,0.55)");
    rayo.addColorStop(1, "rgba(237,184,74,0)");
    ctx.fillStyle = rayo;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-60, -680);
    ctx.lineTo(60, -680);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const pulso = 1 + 0.06 * Math.sin(t * 4);
  const halo = ctx.createRadialGradient(cx, cy, 80, cx, cy, 420 * pulso);
  halo.addColorStop(0, "rgba(212,160,23,0.5)");
  halo.addColorStop(1, "rgba(212,160,23,0)");
  ctx.globalAlpha = alfa * luz;
  ctx.fillStyle = halo;
  ctx.fillRect(cx - 460, cy - 460, 920, 920);
  ctx.globalAlpha = alfa;
}

export function escenaGanador(ctx: Ctx, r: Recursos, u: number, t: number): void {
  const g = r.t.ganador;
  titulo(ctx, r, u, "🏆 GANADOR DEL DÍA");
  const alfa = ctx.globalAlpha;
  const cx = SEGURO.x;
  if (!g) {
    ctx.globalAlpha = alfa * suave(avance(u, 0.3, 0.5));
    texto(ctx, "Nadie la resolvió este día", cx, 860, { f: r.f, peso: 700, tam: 88, color: COLOR.texto, max: SEGURO.ancho });
    texto(ctx, "¿La resolverás tú hoy?", cx, 990, { f: r.f, peso: 700, tam: 76, color: COLOR.oro, max: SEGURO.ancho });
    ctx.globalAlpha = alfa;
    return;
  }
  const cy = 800;
  const radio = 245;
  rayos(ctx, cx, cy, suave(avance(u, 0.3, 0.8)), t);

  const s = rebote(avance(u, 0.3, 0.6));
  if (s > 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.shadowColor = "rgba(237,184,74,0.9)";
    ctx.shadowBlur = 50;
    foto(ctx, g.avatar ? (r.fotos.get(g.avatar) ?? null) : null, g.nombre, 0, 0, radio, r.f);
    ctx.restore();
  }
  const m = rebote(avance(u, 0.75, 0.5));
  if (m > 0) {
    ctx.save();
    ctx.translate(cx + radio * 0.76, cy + radio * 0.72);
    ctx.scale(m, m);
    texto(ctx, "🥇", 0, 0, { f: r.f, peso: 400, tam: 160, color: COLOR.oro, max: 240 });
    ctx.restore();
  }

  const n = suave(avance(u, 0.95, 0.5));
  ctx.globalAlpha = alfa * n;
  texto(ctx, g.nombre, cx, 1150 + (1 - n) * 40, { f: r.f, peso: 800, tam: 112, color: COLOR.texto, max: SEGURO.ancho });
  ctx.globalAlpha = alfa * suave(avance(u, 1.25, 0.5));
  const frase = g.intentos === 1 ? "¡La resolvió al primer intento!" : `Resolvió en ${g.intentos} de 6 intentos`;
  texto(ctx, frase, cx, 1268, { f: r.f, peso: 700, tam: 81, color: COLOR.oro, max: SEGURO.ancho });
  ctx.globalAlpha = alfa * suave(avance(u, 1.5, 0.5));
  texto(ctx, `+${g.puntos} ${g.puntos === 1 ? "punto" : "puntos"}`, cx, 1372, {
    f: r.f,
    peso: 600,
    tam: 66,
    color: COLOR.suave,
    max: SEGURO.ancho,
  });
  ctx.globalAlpha = alfa;
  confeti(ctx, cx, cy, u - 0.55);
}

/**
 * Fichas "?" que entran saltando y luego giran en ola, una tras otra,
 * con un brillo que late.
 */
function fichasMisterio(ctx: Ctx, r: Recursos, u: number, t: number, y: number): void {
  const n = 5;
  const lado = ladoFicha(n, 160);
  const total = n * lado + (n - 1) * HUECO;
  for (let i = 0; i < n; i++) {
    const entra = rebote(avance(u, i * 0.08, 0.4));
    if (entra <= 0) continue;
    // Cada 1.4 s pasa una ola: cada ficha da una vuelta completa.
    const fase = (((u - 0.5 - i * 0.12) / 1.4) % 1 + 1) % 1;
    const giro = u < 0.5 ? 0 : avance(fase, 0, 0.35) * Math.PI * 2;
    ctx.save();
    ctx.translate(SEGURO.x - total / 2 + i * (lado + HUECO) + lado / 2, y);
    ctx.scale(entra * Math.max(Math.abs(Math.cos(giro)), 0.04), entra);
    ctx.shadowColor = "rgba(237,184,74,0.9)";
    ctx.shadowBlur = 24 + 18 * Math.sin(t * 4 + i);
    caraFicha(ctx, r, "?", lado, true);
    ctx.restore();
  }
}

/** Cierre corto (cabe en 4 s): todo entra en el primer segundo. */
export function escenaCierre(ctx: Ctx, r: Recursos, u: number, t: number): void {
  const alfa = ctx.globalAlpha;
  fichasMisterio(ctx, r, u, t, 640);
  const a = (desde: number) => (ctx.globalAlpha = alfa * suave(avance(u, desde, 0.4)));
  a(0.3);
  texto(ctx, "¿Podrás ganar hoy?", SEGURO.x, 880, { f: r.f, peso: 800, tam: 104, color: COLOR.texto, max: SEGURO.ancho });
  a(0.55);
  texto(ctx, "Juega en", SEGURO.x, 1000, { f: r.f, peso: 500, tam: 60, color: COLOR.suave, max: SEGURO.ancho });

  // elimlldm.net entra con un salto y luego late.
  const s = rebote(avance(u, 0.75, 0.45));
  if (s > 0) {
    ctx.globalAlpha = alfa;
    const pulso = 1 + 0.07 * Math.pow(Math.sin(u * 3.2), 2);
    ctx.save();
    ctx.translate(SEGURO.x, 1125);
    ctx.scale(s * pulso, s * pulso);
    ctx.shadowColor = "rgba(237,184,74,0.85)";
    ctx.shadowBlur = 30 + 24 * Math.pow(Math.sin(u * 3.2), 2);
    texto(ctx, "elimlldm.net", 0, 0, { f: r.f, peso: 800, tam: 124, color: COLOR.oro, max: SEGURO.ancho - 40 });
    ctx.restore();
  }
  a(1.0);
  texto(ctx, "Una palabra nueva cada día · gratis", SEGURO.x, 1265, {
    f: r.f,
    peso: 500,
    tam: 52,
    color: COLOR.apagado,
    max: SEGURO.ancho,
  });
  ctx.globalAlpha = alfa;
}
