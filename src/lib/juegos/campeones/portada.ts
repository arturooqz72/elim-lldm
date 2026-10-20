// src/lib/juegos/campeones/portada.ts
//
// Portada del video "Campeones de la semana": el primer cuadro del video
// (0.7 s) y también un PNG de 1080×1920. Sin animación. Todo lo
// importante va dentro del recorte 3:4 del perfil de TikTok (y 240–1680) y
// arriba de lo que tapa la descripción (y 1520), sin la franja de botones
// de la derecha (ver ZONA en palabra/video/portada.ts).
import { ALTO, ANCHO, CENTRO_X, COLOR, fondo, foto, rectRedondo, texto, type Ctx } from "@/lib/palabra/video/lienzo";
import { ZONA } from "@/lib/palabra/video/portada";
import { rangoSemana } from "./semana";
import { fotoDe, ICONO, type Recursos } from "./recursos";

const MAX = (ZONA.libreDerecha - CENTRO_X) * 2 - 40;

function textoConSombra(ctx: Ctx, contenido: string, y: number, opciones: Parameters<typeof texto>[4], resplandor = false): void {
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

function rayosQuietos(ctx: Ctx, y: number): void {
  ctx.save();
  ctx.translate(CENTRO_X, y);
  for (let i = 0; i < 18; i++) {
    ctx.rotate((Math.PI * 2) / 18);
    const rayo = ctx.createLinearGradient(0, 0, 0, -900);
    rayo.addColorStop(0, "rgba(237,184,74,0.26)");
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
  texto(ctx, "Elim LLDM", x0 + lado + 24, y + 6, { f: r.f, peso: 700, tam: 60, color: COLOR.oro, titulo: true, alinear: "left", espacio: 6 });
}

/** Un campeón por juego: su foto (o inicial), el ícono del juego y su nombre. */
function campeones(ctx: Ctx, r: Recursos, y: number): void {
  const lista = [
    ...r.c.juegos.filter((j) => j.podio[0]).map((j) => ({ icono: ICONO[j.id], ...j.podio[0] })),
    ...(r.c.palabra ? [{ icono: ICONO.palabra, ...r.c.palabra.racha }] : []),
  ];
  if (lista.length === 0) return;
  const radio = lista.length <= 2 ? 130 : lista.length === 3 ? 115 : 92;
  const paso = Math.min(radio * 2 + 46, (ZONA.libreDerecha - 60) / lista.length);
  // Centrado un poco a la izquierda, para no meterse en la franja de botones.
  const centro = (ZONA.libreDerecha + 60) / 2;
  lista.forEach((c, i) => {
    const x = centro + (i - (lista.length - 1) / 2) * paso;
    ctx.save();
    ctx.shadowColor = "rgba(237,184,74,0.9)";
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.arc(x, y, radio + 10, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.oroClaro;
    ctx.fill();
    ctx.restore();
    foto(ctx, fotoDe(r, c.avatar), c.nombre, x, y, radio, r.f);
    texto(ctx, c.icono, x + radio * 0.72, y + radio * 0.72, { f: r.f, peso: 400, tam: radio * 0.6, color: COLOR.oro, max: radio });
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 14;
    texto(ctx, c.nombre, x, y + radio + 62, { f: r.f, peso: 700, tam: 44, color: COLOR.texto, max: paso - 16 });
    ctx.restore();
  });
}

export function dibujarPortada(ctx: Ctx, r: Recursos): void {
  ctx.save();
  ctx.clearRect(0, 0, ANCHO, ALTO);
  fondo(ctx, 0);
  rayosQuietos(ctx, 900);
  logo(ctx, r, 330);
  textoConSombra(ctx, "🏆 CAMPEONES", 500, { f: r.f, peso: 800, tam: 136, color: COLOR.oroClaro, max: MAX }, true);
  textoConSombra(ctx, "DE LA SEMANA", 620, { f: r.f, peso: 800, tam: 76, color: COLOR.texto, max: MAX, espacio: 10 });
  textoConSombra(ctx, "Juegos Elim LLDM", 712, { f: r.f, peso: 600, tam: 54, color: COLOR.suave, max: MAX });
  campeones(ctx, r, 930);
  textoConSombra(ctx, rangoSemana(r.c.lunes), 1260, { f: r.f, peso: 700, tam: 62, color: COLOR.oro, max: MAX });
  textoConSombra(ctx, "¿Te animas a jugar? 👉 elimlldm.net/juegos", 1420, { f: r.f, peso: 700, tam: 46, color: COLOR.suave, max: MAX });
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
  return new Promise((listo, falla) => lienzo.toBlob((b) => (b ? listo(b) : falla(new Error("No se pudo generar el PNG."))), "image/png"));
}
