// src/lib/palabra/video/escenas.ts
//
// Línea de tiempo del video de TikTok (15–19 s sin voz; con voz, lo que
// dure, ver sincronia.ts) y escenas de la palabra,
// el ganador y el cierre. `dibujarCuadro(ctx, r, t)` pinta el cuadro del
// segundo t; la misma función sirve para la vista previa y para grabar,
// así lo que se ve es exactamente lo que se descarga.
//
// El contenido importante queda entre y≈180 y y≈1450: arriba TikTok pone
// "Siguiendo | Para ti" y abajo la descripción y los botones.
import {
  ALTO,
  ANCHO,
  avance,
  CENTRO_X,
  COLOR,
  confeti,
  fondo,
  foto,
  fuente,
  rebote,
  rectRedondo,
  renglones,
  suave,
  texto,
  type Ctx,
} from "./lienzo";
import { escenaSemana, escenaTopDia, titulo, type Recursos } from "./listas";

export type { Recursos } from "./listas";

export type IdEscena = "palabra" | "ganador" | "top3" | "semana" | "cierre";

export interface Escena {
  id: IdEscena;
  nombre: string;
  inicio: number;
  dura: number;
}

const FUNDIDO = 0.3;
const DESPLAZAR = 110;
/** "X hermanos jugaron" solo se muestra a partir de este número. */
const MIN_JUGADORES_VISIBLE = 5;

/**
 * Escenas del día; las listas se saltan si no hay nadie que mostrar.
 * `duraciones` (de sincronia.ts) las alarga para que vayan con la voz.
 */
export function lineaDeTiempo(r: Recursos, duraciones: Partial<Record<IdEscena, number>> = {}): Escena[] {
  const { t } = r;
  const piezas: Array<[IdEscena, string, number, boolean]> = [
    ["palabra", "Palabra", 4.2, true],
    ["ganador", "Ganador", 4.6, true],
    // Si solo la resolvió el ganador, "Top 3" lo repetiría: se salta.
    ["top3", "Top 3 del día", 3.6, t.ganador !== null && (t.top3.length > 0 || t.otrosDia > 0)],
    ["semana", "Semana", 3.8, t.top3Semana.length > 0 || t.otrosSemana > 0],
    ["cierre", "Cierre", 3.4, true],
  ];
  let inicio = 0;
  return piezas
    .filter(([, , , va]) => va)
    .map(([id, nombre, porDefecto]) => {
      const e = { id, nombre, inicio, dura: duraciones[id] ?? porDefecto };
      inicio += e.dura;
      return e;
    });
}

export function duracion(escenas: Escena[]): number {
  const ultima = escenas[escenas.length - 1];
  return ultima ? ultima.inicio + ultima.dura : 0;
}

export function etiquetaFecha(fecha: string, conDia = true): string {
  const opciones: Intl.DateTimeFormatOptions = conDia
    ? { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }
    : { day: "numeric", month: "long", timeZone: "UTC" };
  const s = new Intl.DateTimeFormat("es-MX", opciones).format(new Date(`${fecha}T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function rangoSemana(desde: string, hasta: string): string {
  const d = (f: string) => new Date(`${f}T12:00:00Z`);
  const mismoMes = d(desde).getUTCMonth() === d(hasta).getUTCMonth();
  const dia = new Intl.DateTimeFormat("es-MX", { day: "numeric", timeZone: "UTC" });
  return mismoMes
    ? `Del ${dia.format(d(desde))} al ${etiquetaFecha(hasta, false).toLowerCase()}`
    : `Del ${etiquetaFecha(desde, false).toLowerCase()} al ${etiquetaFecha(hasta, false).toLowerCase()}`;
}

function encabezado(ctx: Ctx, r: Recursos, t: number): void {
  ctx.globalAlpha = suave(avance(t, 0, 0.5));
  ctx.font = fuente(r.f, 700, 66, true);
  ctx.letterSpacing = "6px";
  const anchoTexto = ctx.measureText("Elim LLDM").width;
  ctx.letterSpacing = "0px";
  const lado = 100;
  const x0 = CENTRO_X - (lado + 26 + anchoTexto) / 2;
  if (r.logo) {
    ctx.save();
    rectRedondo(ctx, x0, 230 - lado / 2, lado, lado, 24);
    ctx.clip();
    ctx.drawImage(r.logo, x0, 230 - lado / 2, lado, lado);
    ctx.restore();
  }
  texto(ctx, "Elim LLDM", x0 + lado + 26, 236, { f: r.f, peso: 700, tam: 66, color: COLOR.oro, titulo: true, alinear: "left", espacio: 6 });
  ctx.globalAlpha = 1;
}

/** Fichas de la palabra que se voltean una por una, como al jugar. */
function fichas(ctx: Ctx, r: Recursos, u: number, letras: string[], y: number, lado: number, desde: number): void {
  const hueco = 18;
  // Que siempre quepan con margen, aunque la palabra tuviera más letras.
  lado = Math.min(lado, (ANCHO - 160 - hueco * (letras.length - 1)) / letras.length);
  const total = letras.length * lado + (letras.length - 1) * hueco;
  letras.forEach((letra, i) => {
    const x = (ANCHO - total) / 2 + i * (lado + hueco);
    const p = avance(u, desde + i * 0.22, 0.45);
    const volteada = p >= 0.5;
    const escala = Math.max(Math.abs(Math.cos(Math.PI * p)), 0.02);
    ctx.save();
    ctx.translate(x + lado / 2, y);
    ctx.scale(1, escala);
    rectRedondo(ctx, -lado / 2, -lado / 2, lado, lado, lado * 0.14);
    if (volteada) {
      const g = ctx.createLinearGradient(0, -lado / 2, 0, lado / 2);
      g.addColorStop(0, COLOR.oroClaro);
      g.addColorStop(1, COLOR.oroOscuro);
      ctx.fillStyle = g;
      ctx.fill();
      texto(ctx, letra, 0, lado * 0.04, { f: r.f, peso: 800, tam: lado * 0.6, color: COLOR.fondo, max: lado });
    } else {
      ctx.fillStyle = COLOR.superficie;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(212,160,23,0.55)";
      ctx.stroke();
    }
    ctx.restore();
  });
}

function escenaPalabra(ctx: Ctx, r: Recursos, u: number): void {
  const { t } = r;
  titulo(ctx, r, u, "PALABRA DEL DÍA");
  const alfa = ctx.globalAlpha;
  const aparece = (desde: number) => {
    ctx.globalAlpha = alfa * suave(avance(u, desde, 0.5));
  };
  aparece(0.25);
  texto(ctx, etiquetaFecha(t.fecha), CENTRO_X, 494, { f: r.f, peso: 500, tam: 40, color: COLOR.apagado });
  ctx.globalAlpha = alfa;

  if (!t.palabra) {
    texto(ctx, "Sin palabra este día", CENTRO_X, 700, { f: r.f, peso: 700, tam: 60, color: COLOR.texto });
    return;
  }
  fichas(ctx, r, u, [...t.palabra.palabra], 680, 160, 0.6);

  aparece(1.9);
  texto(ctx, `📖 ${t.palabra.referencia}`, CENTRO_X, 860, { f: r.f, peso: 700, tam: 52, color: COLOR.oro });
  aparece(2.3);
  ctx.font = fuente(r.f, 400, 42);
  const lineas = renglones(ctx, t.palabra.explicacion, 880, 4);
  lineas.forEach((l, i) => texto(ctx, l, CENTRO_X, 950 + i * 60, { f: r.f, peso: 400, tam: 42, color: COLOR.suave, max: 900 }));
  if (t.jugadores >= MIN_JUGADORES_VISIBLE) {
    aparece(2.8);
    texto(ctx, `🙌 ${t.jugadores} hermanos jugaron`, CENTRO_X, 950 + lineas.length * 60 + 70, {
      f: r.f,
      peso: 700,
      tam: 46,
      color: COLOR.texto,
    });
  }
  ctx.globalAlpha = alfa;
}

function escenaGanador(ctx: Ctx, r: Recursos, u: number, t: number): void {
  const g = r.t.ganador;
  titulo(ctx, r, u, "🏆 GANADOR DEL DÍA");
  const alfa = ctx.globalAlpha;
  if (!g) {
    ctx.globalAlpha = alfa * suave(avance(u, 0.3, 0.5));
    texto(ctx, "Nadie la resolvió este día", CENTRO_X, 720, { f: r.f, peso: 700, tam: 62, color: COLOR.texto });
    texto(ctx, "¿La resolverás tú hoy?", CENTRO_X, 820, { f: r.f, peso: 700, tam: 54, color: COLOR.oro });
    ctx.globalAlpha = alfa;
    return;
  }
  const cx = CENTRO_X;
  const cy = 760;
  // Rayos de luz que giran detrás de la foto y un resplandor que late.
  const luz = suave(avance(u, 0.3, 0.8));
  ctx.save();
  ctx.globalAlpha = alfa * luz * 0.55;
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.25);
  for (let i = 0; i < 14; i++) {
    ctx.rotate((Math.PI * 2) / 14);
    const rayo = ctx.createLinearGradient(0, 0, 0, -520);
    rayo.addColorStop(0, "rgba(237,184,74,0.55)");
    rayo.addColorStop(1, "rgba(237,184,74,0)");
    ctx.fillStyle = rayo;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-46, -520);
    ctx.lineTo(46, -520);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const pulso = 1 + 0.06 * Math.sin(t * 4);
  const halo = ctx.createRadialGradient(cx, cy, 60, cx, cy, 300 * pulso);
  halo.addColorStop(0, "rgba(212,160,23,0.5)");
  halo.addColorStop(1, "rgba(212,160,23,0)");
  ctx.globalAlpha = alfa * luz;
  ctx.fillStyle = halo;
  ctx.fillRect(cx - 320, cy - 320, 640, 640);

  const s = rebote(avance(u, 0.3, 0.6));
  if (s > 0) {
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    foto(ctx, g.avatar ? (r.fotos.get(g.avatar) ?? null) : null, g.nombre, 0, 0, 170, r.f);
    ctx.restore();
  }
  const m = rebote(avance(u, 0.75, 0.5));
  if (m > 0) {
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.translate(cx + 132, cy + 122);
    ctx.scale(m, m);
    texto(ctx, "🥇", 0, 0, { f: r.f, peso: 400, tam: 120, color: COLOR.oro, max: 200 });
    ctx.restore();
  }

  const n = suave(avance(u, 0.95, 0.5));
  ctx.globalAlpha = alfa * n;
  texto(ctx, g.nombre, cx, 1030 + (1 - n) * 40, { f: r.f, peso: 800, tam: 92, color: COLOR.texto, max: 920 });
  ctx.globalAlpha = alfa * suave(avance(u, 1.25, 0.5));
  const frase = g.intentos === 1 ? "¡La resolvió al primer intento!" : `Resolvió en ${g.intentos} de 6 intentos`;
  texto(ctx, frase, cx, 1128, { f: r.f, peso: 700, tam: 54, color: COLOR.oro });
  ctx.globalAlpha = alfa * suave(avance(u, 1.5, 0.5));
  texto(ctx, `+${g.puntos} ${g.puntos === 1 ? "punto" : "puntos"}`, cx, 1204, { f: r.f, peso: 600, tam: 44, color: COLOR.suave });
  ctx.globalAlpha = alfa;
  confeti(ctx, cx, cy, u - 0.55);
}

function escenaCierre(ctx: Ctx, r: Recursos, u: number, t: number): void {
  const alfa = ctx.globalAlpha;
  fichas(ctx, r, u, ["?", "?", "?", "?", "?"], 560, 130, 0.1);
  const a = (desde: number) => (ctx.globalAlpha = alfa * suave(avance(u, desde, 0.5)));
  a(0.6);
  texto(ctx, "¿Podrás ganar hoy?", CENTRO_X, 790, { f: r.f, peso: 800, tam: 96, color: COLOR.texto, max: 940 });
  a(1.0);
  texto(ctx, "Juega en", CENTRO_X, 920, { f: r.f, peso: 500, tam: 52, color: COLOR.suave });
  a(1.2);
  ctx.save();
  ctx.shadowColor = "rgba(237,184,74,0.75)";
  ctx.shadowBlur = 30 + 18 * Math.sin(t * 4);
  texto(ctx, "elimlldm.net", CENTRO_X, 1030, { f: r.f, peso: 800, tam: 110, color: COLOR.oro, max: 940 });
  ctx.restore();
  a(1.6);
  texto(ctx, "Una palabra nueva cada día · gratis", CENTRO_X, 1140, { f: r.f, peso: 500, tam: 42, color: COLOR.apagado });
  ctx.globalAlpha = alfa;
}

/** Pinta el cuadro del segundo `t`. */
export function dibujarCuadro(ctx: Ctx, r: Recursos, escenas: Escena[], t: number): void {
  ctx.save();
  ctx.clearRect(0, 0, ANCHO, ALTO);
  fondo(ctx, t);
  encabezado(ctx, r, t);
  const fin = duracion(escenas);
  const e = escenas.find((x) => t >= x.inicio && t < x.inicio + x.dura) ?? escenas[escenas.length - 1];
  if (e) {
    const u = t - e.inicio;
    const entra = e.inicio === 0 ? 1 : avance(u, 0, FUNDIDO);
    const sale = e.inicio + e.dura >= fin ? 1 : 1 - avance(u, e.dura - FUNDIDO, FUNDIDO);
    ctx.globalAlpha = Math.min(entra, sale);
    // Las escenas se dibujan un poco más abajo del encabezado: así quedan
    // centradas en la parte que TikTok no tapa.
    ctx.translate(0, DESPLAZAR);
    if (e.id === "palabra") escenaPalabra(ctx, r, u);
    else if (e.id === "ganador") escenaGanador(ctx, r, u, t);
    else if (e.id === "top3") escenaTopDia(ctx, r, u);
    else if (e.id === "semana") escenaSemana(ctx, r, u, rangoSemana(r.t.desde, r.t.fecha));
    else escenaCierre(ctx, r, u, t);
  }
  ctx.restore();
}
