// src/lib/juegos/campeones/semana.ts
//
// Semanas del video "Campeones de la semana": de lunes a domingo, en hora
// del Pacífico. Solo semanas ya terminadas: nunca la que va en curso.
import { esFechaIso, inicioDeSemana, sumarDias } from "@/lib/palabra/logica";

/** Primera semana con datos de los juegos en línea. */
export const PRIMER_LUNES = "2026-09-21";

/** Lunes de la semana pasada completa (por defecto en la página). */
export function lunesPasado(hoy: string): string {
  return sumarDias(inicioDeSemana(hoy), -7);
}

export function lunesValido(lunes: unknown, hoy: string): lunes is string {
  return (
    esFechaIso(lunes) && inicioDeSemana(lunes) === lunes && lunes >= PRIMER_LUNES && lunes <= lunesPasado(hoy)
  );
}

/** Las semanas que se pueden elegir, de la más reciente a la más vieja. */
export function semanasDisponibles(hoy: string, cuantas = 8): string[] {
  const lista: string[] = [];
  for (let l = lunesPasado(hoy); l >= PRIMER_LUNES && lista.length < cuantas; l = sumarDias(l, -7)) lista.push(l);
  return lista;
}

const mes = (f: string) => new Intl.DateTimeFormat("es-MX", { month: "long", timeZone: "UTC" }).format(new Date(`${f}T12:00:00Z`));
const dia = (f: string) => Number(f.slice(8, 10));

/** "Del 12 al 18 de octubre" o "Del 28 de septiembre al 4 de octubre". */
export function rangoSemana(lunes: string): string {
  const domingo = sumarDias(lunes, 6);
  return mes(lunes) === mes(domingo)
    ? `Del ${dia(lunes)} al ${dia(domingo)} de ${mes(domingo)}`
    : `Del ${dia(lunes)} de ${mes(lunes)} al ${dia(domingo)} de ${mes(domingo)}`;
}

/** "12–18 oct" para el selector. */
export function rangoCorto(lunes: string): string {
  const domingo = sumarDias(lunes, 6);
  const corto = (f: string) => new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" }).format(new Date(`${f}T12:00:00Z`)).replace(".", "");
  return corto(lunes) === corto(domingo)
    ? `${dia(lunes)}–${dia(domingo)} ${corto(domingo)}`
    : `${dia(lunes)} ${corto(lunes)} – ${dia(domingo)} ${corto(domingo)}`;
}
