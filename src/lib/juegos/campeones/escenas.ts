// src/lib/juegos/campeones/escenas.ts
//
// Línea de tiempo del video "Campeones de la semana" y el cuadro de cada
// segundo. Portada (0.7 s, TikTok la toma de ahí) → título → una escena por
// juego que sí va (juego.ts) → Palabra del Día → cierre (≤ 4 s). Con voz,
// cada escena dura lo que su frase (sincronia.ts). `dibujarCuadro` sirve
// para la vista previa y para grabar: lo que se ve es lo que se descarga.
//
// Arriba va el encabezado (Elim LLDM); las escenas usan de y≈340 a y≈1500
// y nunca los 150 px de la derecha (SEGURO en palabra/video/lienzo.ts).
import type { CampeonesJuego } from "@/types";
import { ALTO, ANCHO, avance, CENTRO_X, COLOR, fondo, fuente, rectRedondo, suave, texto, type Ctx } from "@/lib/palabra/video/lienzo";
import { PORTADA_DURA } from "@/lib/palabra/video/portada";
import { escenaCierre, escenaInicio, escenaPalabra } from "./otras";
import { escenaJuego } from "./juego";
import { dibujarPortada } from "./portada";
import type { Recursos } from "./recursos";

export type IdEscena = "portada" | "inicio" | CampeonesJuego["id"] | "palabra" | "cierre";

export interface Escena {
  id: IdEscena;
  nombre: string;
  inicio: number;
  dura: number;
}

const FUNDIDO = 0.3;
const NOMBRE_CORTO: Record<CampeonesJuego["id"], string> = { trivia: "Trivia", ahorcado: "Ahorcado", ruleta: "Ruleta" };

/** Escenas de la semana (solo los juegos que van); `duraciones` las ajusta a la voz. */
export function lineaDeTiempo(r: Recursos, duraciones: Partial<Record<IdEscena, number>> = {}): Escena[] {
  const piezas: Array<[IdEscena, string, number]> = [
    ["portada", "Portada", PORTADA_DURA],
    ["inicio", "Título", 3.2],
    ...r.c.juegos.map((j): [IdEscena, string, number] => [j.id, NOMBRE_CORTO[j.id], 4.6]),
    ...(r.c.palabra ? [["palabra", "Palabra del Día", 4.6] as [IdEscena, string, number]] : []),
    ["cierre", "Cierre", 3.4],
  ];
  let inicio = 0;
  return piezas.map(([id, nombre, porDefecto]) => {
    const e: Escena = { id, nombre, inicio, dura: duraciones[id] ?? porDefecto };
    inicio += e.dura;
    return e;
  });
}

export function duracion(escenas: Escena[]): number {
  const ultima = escenas[escenas.length - 1];
  return ultima ? ultima.inicio + ultima.dura : 0;
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

/** Pinta el cuadro del segundo `t`. */
export function dibujarCuadro(ctx: Ctx, r: Recursos, escenas: Escena[], t: number): void {
  const portada = escenas[0]?.id === "portada" ? escenas[0] : null;
  if (portada && t < portada.dura) {
    dibujarPortada(ctx, r);
    return;
  }
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
    const juego = r.c.juegos.find((j) => j.id === e.id);
    if (juego) escenaJuego(ctx, r, juego, u, t);
    else if (e.id === "inicio") escenaInicio(ctx, r, u, t);
    else if (e.id === "palabra" && r.c.palabra) escenaPalabra(ctx, r, r.c.palabra, u);
    else if (e.id === "cierre") escenaCierre(ctx, r, u, t);
  }
  ctx.restore();
}
