// src/lib/palabra/video/escenas.ts
//
// Línea de tiempo del video de TikTok (15–19 s sin voz; con voz, lo que
// dure, ver sincronia.ts) y el cuadro de cada segundo. Las escenas se
// dibujan en principales.ts (palabra, ganador, cierre) y listas.ts (top 3
// y semana). `dibujarCuadro(ctx, r, t)` sirve para la vista previa y para
// grabar, así lo que se ve es exactamente lo que se descarga.
//
// Arriba va el encabezado (Elim LLDM); las escenas usan de y≈340 a
// y≈1500 y nunca los 150 px de la derecha (SEGURO en lienzo.ts).
import { ALTO, ANCHO, avance, CENTRO_X, COLOR, fondo, fuente, rectRedondo, suave, texto, type Ctx } from "./lienzo";
import { escenaSemana, escenaTopDia, type Recursos } from "./listas";
import { escenaCierre, escenaGanador, escenaPalabra } from "./principales";
import { dibujarPortada, PORTADA_DURA } from "./portada";

export type { Recursos } from "./listas";

export type IdEscena = "portada" | "palabra" | "ganador" | "top3" | "semana" | "cierre";

export interface Escena {
  id: IdEscena;
  nombre: string;
  inicio: number;
  dura: number;
  /** Solo "palabra": segundo de la escena en que se voltean las fichas (con voz). */
  voltear?: number;
}

const FUNDIDO = 0.3;

/**
 * Escenas del día; las listas se saltan si no hay nadie que mostrar.
 * `duraciones` (de sincronia.ts) las alarga para que vayan con la voz.
 */
export function lineaDeTiempo(r: Recursos, duraciones: Partial<Record<IdEscena, number>> = {}, voltear?: number): Escena[] {
  const { t } = r;
  const piezas: Array<[IdEscena, string, number, boolean]> = [
    // El primer cuadro es la portada: TikTok la toma de ahí.
    ["portada", "Portada", PORTADA_DURA, true],
    ["palabra", "Palabra", 4.2, true],
    ["ganador", "Ganador", 4.6, true],
    // Si solo la resolvió el ganador, "Top 3" lo repetiría: se salta.
    ["top3", "Top 3 del día", 3.6, t.ganador !== null && (t.top3.length > 0 || t.otrosDia > 0)],
    // Siempre con tarjetas (getTarjetaTikTok manda los 3 primeros aunque no tengan permiso).
    ["semana", "Semana", 3.8, t.top3Semana.length > 0],
    ["cierre", "Cierre", 3.4, true],
  ];
  let inicio = 0;
  return piezas
    .filter(([, , , va]) => va)
    .map(([id, nombre, porDefecto]) => {
      const e: Escena = { id, nombre, inicio, dura: duraciones[id] ?? porDefecto, ...(id === "palabra" && { voltear }) };
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
    if (e.id === "palabra") escenaPalabra(ctx, r, u, etiquetaFecha(r.t.fecha), e.voltear);
    else if (e.id === "ganador") escenaGanador(ctx, r, u, t);
    else if (e.id === "top3") escenaTopDia(ctx, r, u);
    else if (e.id === "semana") escenaSemana(ctx, r, u, rangoSemana(r.t.desde, r.t.fecha));
    else escenaCierre(ctx, r, u, t);
  }
  ctx.restore();
}
