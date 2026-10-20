// src/lib/juegos/campeones/textos.ts
//
// Textos listos para pegar al subir el video de Campeones: TikTok,
// Instagram y YouTube (título con #Shorts + descripción con enlaces
// completos). Mismos nombres cortos del video; quien no dio permiso no se
// nombra. Cada texto termina con una pregunta para comentar y 5 hashtags.
import type { CampeonesSemana } from "@/types";
import { INSTAGRAM_URL, REDES_USUARIO } from "@/lib/redes";
import { rangoSemana } from "./semana";
import { ICONO } from "./recursos";

const HASHTAGS = "#LLDM #ElimLLDM #JuegosBíblicos #TriviaBíblica #Biblia";
const PREGUNTA = "¿Cuál es tu juego favorito? ¡Te leemos en los comentarios! 👇";
const miles = (n: number) => n.toLocaleString("es-MX");

/** Un renglón por juego: "🧠 Trivia en línea: Arturo O. (4,602 pts)". */
function renglones(c: CampeonesSemana): string[] {
  const lineas = c.juegos.map((j) => {
    const p = j.podio[0];
    const quien = p.conPermiso ? `${p.nombre} (${miles(p.puntos)} pts)` : `un hermano participante (${miles(p.puntos)} pts)`;
    return `${ICONO[j.id]} ${j.nombre}: ${quien}`;
  });
  if (c.palabra) {
    const r = c.palabra.racha;
    lineas.push(`${ICONO.palabra} Palabra del Día: mejor racha ${r.conPermiso ? r.nombre : "de un hermano participante"} 🔥 ${r.valor} días`);
  }
  return lineas;
}

export function textoTikTok(c: CampeonesSemana): string {
  return [
    `🏆 Campeones de la semana · ${rangoSemana(c.lunes)}`,
    ...renglones(c),
    "",
    "¡Felicidades a todos! ¿Te animas a jugar esta semana? Juega gratis en elimlldm.net/juegos",
    "",
    PREGUNTA,
    "",
    HASHTAGS,
  ].join("\n");
}

export function textoInstagram(c: CampeonesSemana): string {
  return [
    `🏆 CAMPEONES DE LA SEMANA`,
    `${rangoSemana(c.lunes)} · Juegos Elim LLDM`,
    "",
    ...renglones(c),
    "",
    "¡Felicidades a todos los que jugaron! 🙌",
    "Juega gratis en elimlldm.net/juegos (enlace en el perfil).",
    "",
    PREGUNTA,
    "",
    HASHTAGS,
  ].join("\n");
}

export function tituloYouTube(c: CampeonesSemana): string {
  return `🏆 Campeones de la semana (${rangoSemana(c.lunes).replace(/^Del /, "")}) · Juegos bíblicos Elim LLDM #Shorts`;
}

export function textoYouTube(c: CampeonesSemana): string {
  return [
    `Título: ${tituloYouTube(c)}`,
    "",
    "Descripción:",
    `🏆 Campeones de la semana en los juegos bíblicos de Elim LLDM · ${rangoSemana(c.lunes)}`,
    "",
    ...renglones(c),
    "",
    "🎮 Juega gratis: https://elimlldm.net/juegos",
    "📻 Escucha Radio Elim 24/7: https://radio.elimlldm.net",
    `📸 Síguenos en Instagram: ${INSTAGRAM_URL} (${REDES_USUARIO})`,
    "",
    PREGUNTA,
    "",
    HASHTAGS,
  ].join("\n");
}
