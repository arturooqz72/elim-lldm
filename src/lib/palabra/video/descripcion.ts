// src/lib/palabra/video/descripcion.ts
//
// Texto listo para pegar en la descripción del video de TikTok. Usa los
// mismos nombres cortos del video: nunca correos ni nombres completos.
import type { PalabraTarjetaTikTok } from "@/types";
import { NOMBRE_SIN_PERMISO } from "../puntos";
import { etiquetaFecha } from "./escenas";

const HASHTAGS = "#LLDM #PalabraDelDía #Biblia #ElimLLDM";

export function descripcionTikTok(t: PalabraTarjetaTikTok): string {
  const lineas: string[] = [`📖 Palabra del Día · ${etiquetaFecha(t.fecha)}`];
  if (t.palabra) lineas.push(`La palabra fue ${t.palabra.palabra} (${t.palabra.referencia}).`);
  if (t.ganador) {
    const g = t.ganador;
    const como = g.intentos === 1 ? "¡al primer intento!" : `en ${g.intentos} de 6 intentos.`;
    lineas.push(`🥇 Felicidades a ${g.nombre}, que la resolvió ${como}`);
  } else {
    lineas.push("Nadie la resolvió este día. ¿La resolverás tú?");
  }
  const lider = t.top3Semana[0];
  if (lider?.posicion === 1 && lider.nombre !== NOMBRE_SIN_PERMISO) lineas.push(`🔥 Va adelante esta semana: ${lider.nombre} con ${lider.puntos} puntos.`);
  lineas.push("", "¿Podrás ganar hoy? Juega gratis en elimlldm.net", "", HASHTAGS);
  return lineas.join("\n");
}
