// src/lib/palabra/video/portada.ts
//
// Portada del video de TikTok de la Palabra del Día: es el primer cuadro
// del video (los primeros PORTADA_DURA segundos) y también se descarga
// como PNG de 1080×1920. Siempre el mismo diseño, para que el perfil de
// TikTok se vea ordenado como serie; no se anima (nada depende del tiempo).
//
// Zonas de TikTok (ver ZONA):
//  ┌───────────────┐ 0
//  │   se recorta  │      En la cuadrícula del perfil TikTok la corta a 3:4
//  ├───────────────┤ 240  (1080×1440, centrada): arriba y abajo se pierden.
//  │  GANADOR,     │
//  │  nombre,      │▒     ▒ = botones de TikTok (150 px a la derecha)
//  │  fecha        │▒
//  ├───────────────┤ 1520 Lo de abajo lo tapan la descripción y los botones.
//  │               │
//  └───────────────┘ 1920
import type { Recursos } from "./listas";
import {
  ALTO,
  ANCHO,
  azar,
  CENTRO_X,
  COLOR,
  fondo,
  foto,
  rectRedondo,
  texto,
  type Ctx,
} from "./lienzo";

export const PORTADA_DURA = 0.7;

export const ZONA = {
  /** Recorte 3:4 de la cuadrícula del perfil. */
  recorteArriba: (ALTO - (ANCHO * 4) / 3) / 2,
  recorteAbajo: (ALTO + (ANCHO * 4) / 3) / 2,
  /** De aquí para abajo lo tapan la descripción y los botones. */
  libreAbajo: ALTO - 400,
  /** De aquí a la derecha están los botones (me gusta, comentar…). */
  libreDerecha: ANCHO - 150,
} as const;

/** Ancho máximo del texto centrado sin meterse a la franja de los botones. */
const MAX = (ZONA.libreDerecha - CENTRO_X) * 2 - 40;

const COLORES_CONFETI = [COLOR.oro, COLOR.oroClaro, "#FFF4D6", "#C99A2E"];

/** "Jueves 15 de octubre". */
export function fechaPortada(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  const parte = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-MX", { ...o, timeZone: "UTC" }).format(d);
  const dia = parte({ weekday: "long" });
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${parte({ day: "numeric" })} de ${parte({ month: "long" })}`;
}

/** Texto con sombra oscura (y opcionalmente un resplandor dorado) para leerse en pantalla chica. */
function textoConSombra(
  ctx: Ctx,
  contenido: string,
  y: number,
  opciones: Parameters<typeof texto>[4],
  resplandor = false
): void {
  ctx.save();
  if (resplandor) {
    ctx.shadowColor = "rgba(237,184,74,0.85)";
    ctx.shadowBlur = 46;
    texto(ctx, contenido, CENTRO_X, y, opciones);
  }
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 6;
  texto(ctx, contenido, CENTRO_X, y, opciones);
  ctx.restore();
}

/** Destello de cuatro puntas. */
function destello(ctx: Ctx, x: number, y: number, r: number, alfa: number): void {
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.translate(x, y);
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.4);
  halo.addColorStop(0, "rgba(255,244,214,0.9)");
  halo.addColorStop(1, "rgba(255,244,214,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(-r * 1.4, -r * 1.4, r * 2.8, r * 2.8);
  ctx.fillStyle = "#FFF4D6";
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(a + Math.PI / 4) * r * 0.16, Math.sin(a + Math.PI / 4) * r * 0.16);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Destellos y confeti quieto, siempre en el mismo lugar (semillas fijas). */
function decoracion(ctx: Ctx): void {
  // Rayos dorados detrás del centro.
  ctx.save();
  ctx.translate(CENTRO_X, 860);
  for (let i = 0; i < 18; i++) {
    ctx.rotate((Math.PI * 2) / 18);
    const rayo = ctx.createLinearGradient(0, 0, 0, -900);
    rayo.addColorStop(0, "rgba(237,184,74,0.28)");
    rayo.addColorStop(1, "rgba(237,184,74,0)");
    ctx.fillStyle = rayo;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-60, -900);
    ctx.lineTo(60, -900);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Confeti y destellos solo en las orillas y en las franjas que TikTok
  // recorta o tapa: nunca encima del texto del centro.
  for (let i = 0; i < 70; i++) {
    const { x, y } = lugarDeAdorno(i);
    ctx.save();
    ctx.globalAlpha = 0.55 + azar(i + 90) * 0.4;
    ctx.translate(x, y);
    ctx.rotate(azar(i + 100) * Math.PI * 2);
    ctx.scale(1, 0.4 + azar(i + 110) * 0.6);
    ctx.fillStyle = COLORES_CONFETI[i % COLORES_CONFETI.length];
    if (i % 3 === 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-15, -6, 30, 12);
    }
    ctx.restore();
  }

  for (let i = 0; i < 18; i++) {
    const { x, y } = lugarDeAdorno(i + 500);
    destello(ctx, x, y, 14 + azar(i + 240) * 26, 0.5 + azar(i + 260) * 0.5);
  }
}

/** Orilla de 140 px a cada lado, o arriba/abajo del texto (franjas que TikTok recorta o tapa). */
function lugarDeAdorno(i: number): { x: number; y: number } {
  const orilla = 140;
  if (i % 4 === 3) {
    const arriba = i % 8 === 3;
    return {
      x: 40 + azar(i + 60) * (ANCHO - 80),
      y: arriba ? 40 + azar(i + 80) * (ZONA.recorteArriba - 20) : ZONA.libreAbajo + 40 + azar(i + 80) * (ALTO - ZONA.libreAbajo - 80),
    };
  }
  return {
    x: i % 2 === 0 ? 20 + azar(i + 40) * orilla : ANCHO - 20 - azar(i + 40) * orilla,
    y: 60 + azar(i + 80) * (ALTO - 120),
  };
}

function logo(ctx: Ctx, r: Recursos, y: number): void {
  const lado = 96;
  ctx.font = `700 60px ${r.f.titulo}`;
  ctx.letterSpacing = "6px";
  const ancho = ctx.measureText("Elim LLDM").width;
  ctx.letterSpacing = "0px";
  const x0 = CENTRO_X - (lado + 24 + ancho) / 2;
  if (r.logo) {
    ctx.save();
    rectRedondo(ctx, x0, y - lado / 2, lado, lado, 22);
    ctx.clip();
    ctx.drawImage(r.logo, x0, y - lado / 2, lado, lado);
    ctx.restore();
  }
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 16;
  texto(ctx, "Elim LLDM", x0 + lado + 24, y + 6, { f: r.f, peso: 700, tam: 60, color: COLOR.oro, titulo: true, alinear: "left", espacio: 6 });
  ctx.restore();
}

/** Foto (o inicial) en un círculo dorado con brillo. */
function circuloGanador(ctx: Ctx, r: Recursos, nombre: string, avatar: string | null, y: number): void {
  const radio = 165;
  const halo = ctx.createRadialGradient(CENTRO_X, y, radio * 0.6, CENTRO_X, y, radio * 2.1);
  halo.addColorStop(0, "rgba(237,184,74,0.65)");
  halo.addColorStop(1, "rgba(237,184,74,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(CENTRO_X - radio * 2.2, y - radio * 2.2, radio * 4.4, radio * 4.4);

  ctx.save();
  ctx.shadowColor = "rgba(237,184,74,0.95)";
  ctx.shadowBlur = 60;
  ctx.beginPath();
  ctx.arc(CENTRO_X, y, radio + 14, 0, Math.PI * 2);
  const aro = ctx.createLinearGradient(CENTRO_X - radio, y - radio, CENTRO_X + radio, y + radio);
  aro.addColorStop(0, COLOR.oroClaro);
  aro.addColorStop(0.5, "#FFF4D6");
  aro.addColorStop(1, COLOR.oroOscuro);
  ctx.fillStyle = aro;
  ctx.fill();
  ctx.restore();

  foto(ctx, avatar ? (r.fotos.get(avatar) ?? null) : null, nombre, CENTRO_X, y, radio, r.f);
}

/** Pinta la portada completa en el lienzo de 1080×1920. */
export function dibujarPortada(ctx: Ctx, r: Recursos): void {
  const g = r.t.ganador;
  ctx.save();
  ctx.clearRect(0, 0, ANCHO, ALTO);
  fondo(ctx, 0);
  decoracion(ctx);

  logo(ctx, r, 330);
  textoConSombra(ctx, "🏆 GANADOR", 500, { f: r.f, peso: 800, tam: 150, color: COLOR.oroClaro, max: MAX }, true);
  textoConSombra(ctx, "PALABRA DEL DÍA", 625, { f: r.f, peso: 800, tam: 62, color: COLOR.texto, max: MAX, espacio: 10 });

  circuloGanador(ctx, r, g?.nombre ?? "?", g?.avatar ?? null, 875);

  textoConSombra(ctx, g?.nombre ?? "¡Nadie la resolvió!", 1130, { f: r.f, peso: 800, tam: 104, color: COLOR.texto, max: MAX });
  textoConSombra(ctx, fechaPortada(r.t.fecha), 1235, { f: r.f, peso: 600, tam: 54, color: COLOR.oro, max: MAX });
  textoConSombra(ctx, "¿Podrás ganar hoy? 👉 elimlldm.net", 1420, { f: r.f, peso: 700, tam: 50, color: COLOR.suave, max: MAX });
  ctx.restore();
}

/** Solo en la vista previa: dónde recorta y tapa TikTok (no sale en el video ni en el PNG). */
export function dibujarGuiasTikTok(ctx: Ctx): void {
  ctx.save();
  ctx.fillStyle = "rgba(255,68,68,0.18)";
  ctx.fillRect(0, 0, ANCHO, ZONA.recorteArriba);
  ctx.fillRect(0, ZONA.libreAbajo, ANCHO, ALTO - ZONA.libreAbajo);
  ctx.fillRect(ZONA.libreDerecha, ZONA.recorteArriba, ANCHO - ZONA.libreDerecha, ZONA.libreAbajo - ZONA.recorteArriba);
  ctx.setLineDash([24, 16]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,68,68,0.9)";
  ctx.strokeRect(2, ZONA.recorteArriba, ANCHO - 4, ZONA.recorteAbajo - ZONA.recorteArriba);
  ctx.restore();
}

/** PNG de 1080×1920 de la portada. */
export function portadaPng(r: Recursos): Promise<Blob> {
  const lienzo = document.createElement("canvas");
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Este navegador no puede dibujar la portada."));
  dibujarPortada(ctx, r);
  return new Promise((listo, falla) =>
    lienzo.toBlob((b) => (b ? listo(b) : falla(new Error("No se pudo generar el PNG."))), "image/png")
  );
}
