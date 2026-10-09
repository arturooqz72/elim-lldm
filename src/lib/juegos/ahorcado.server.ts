// src/lib/juegos/ahorcado.server.ts
// El Ahorcado se juega en el servidor (ver 0074_ahorcado_servidor.sql): aquí
// se elige la palabra, se califica cada letra y se suman los puntos. Al
// navegador solo le llegan las letras acertadas, y la palabra completa
// cuando la partida termina.
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { AhorcadoCategoria } from "@/types";

export const VIDAS_INICIALES = 6;
const PUNTOS_POR_VIDA = 10;
const GAME_KEY = "ahorcado";
const LETRA_VALIDA = /^[A-ZÑ]$/;

type Estado = "jugando" | "ganada" | "perdida";

interface Corrida {
  user_id: string;
  palabra_id: string | null;
  letras: string[];
  vidas: number;
  estado: Estado;
  puntos: number;
  ganadas: number;
  usadas: string[];
  updated_at: string;
}

interface Palabra {
  id: string;
  palabra: string;
  categoria: AhorcadoCategoria;
  pista: string;
  referencia_biblica: string | null;
}

/** Lo que sí puede ver el navegador. */
export interface EstadoAhorcado {
  /** Una entrada por carácter: la letra si ya la adivinó, "_" si no, " " para espacios. */
  mascara: string[];
  letras: string[];
  /** Letras usadas que sí están en la palabra (para pintar el teclado). */
  correctas: string[];
  vidas: number;
  estado: Estado;
  puntos: number;
  ganadas: number;
  /** Puntos que dio esta palabra (solo cuando estado = "ganada"). */
  puntosPalabra: number;
  categoria: AhorcadoCategoria;
  pista: string;
  referencia_biblica: string | null;
  /** Solo cuando la partida ya terminó. */
  palabra: string | null;
  /** Si al ganar esta palabra se guardó un nuevo récord en el ranking. */
  nuevoRecord?: boolean;
}

function estadoPublico(c: Corrida, p: Palabra, nuevoRecord?: boolean): EstadoAhorcado {
  return {
    mascara: [...p.palabra].map((l) => (l === " " ? " " : c.letras.includes(l) ? l : "_")),
    letras: c.letras,
    correctas: c.letras.filter((l) => p.palabra.includes(l)),
    vidas: c.vidas,
    estado: c.estado,
    puntos: c.puntos,
    ganadas: c.ganadas,
    puntosPalabra: c.estado === "ganada" ? c.vidas * PUNTOS_POR_VIDA : 0,
    categoria: p.categoria,
    pista: p.pista,
    referencia_biblica: p.referencia_biblica,
    palabra: c.estado === "jugando" ? null : p.palabra,
    nuevoRecord,
  };
}

async function leerCorrida(userId: string) {
  const service = await createServiceClient();
  const { data } = await service.from("ahorcado_corridas").select("*").eq("user_id", userId).maybeSingle();
  return (data as Corrida | null) ?? null;
}

async function leerPalabra(id: string | null) {
  if (!id) return null;
  const service = await createServiceClient();
  const { data } = await service
    .from("ahorcado_palabras")
    .select("id, palabra, categoria, pista, referencia_biblica")
    .eq("id", id)
    .maybeSingle();
  return (data as Palabra | null) ?? null;
}

/**
 * Palabra para jugar. Si hay una a medias, la devuelve tal cual (recargar
 * la página no da otra palabra). Si la anterior la ganó, sigue la racha con
 * una palabra nueva. Si perdió, o pide reiniciar, empieza de cero.
 */
export async function siguientePalabra(userId: string, reiniciar: boolean): Promise<EstadoAhorcado | { error: string }> {
  const service = await createServiceClient();
  const corrida = await leerCorrida(userId);

  if (corrida && corrida.estado === "jugando" && !reiniciar) {
    const actual = await leerPalabra(corrida.palabra_id);
    if (actual) return estadoPublico(corrida, actual);
  }

  const sigueRacha = Boolean(corrida && corrida.estado === "ganada" && !reiniciar);
  const usadas = sigueRacha ? (corrida?.usadas ?? []) : [];

  const { data: activas, error } = await service
    .from("ahorcado_palabras")
    .select("id, palabra, categoria, pista, referencia_biblica")
    .eq("activo", true);
  if (error) return { error: error.message };
  const todas = (activas ?? []) as Palabra[];
  if (todas.length === 0) return { error: "No hay palabras activas en el banco" };

  // Si ya salieron todas en esta racha, se vuelve a empezar la lista.
  const disponibles = todas.filter((p) => !usadas.includes(p.id));
  const lista = disponibles.length > 0 ? disponibles : todas;
  const elegida = lista[Math.floor(Math.random() * lista.length)];

  const nueva: Corrida = {
    user_id: userId,
    palabra_id: elegida.id,
    letras: [],
    vidas: VIDAS_INICIALES,
    estado: "jugando",
    puntos: sigueRacha ? (corrida?.puntos ?? 0) : 0,
    ganadas: sigueRacha ? (corrida?.ganadas ?? 0) : 0,
    usadas: [...(disponibles.length > 0 ? usadas : []), elegida.id],
    updated_at: new Date().toISOString(),
  };

  const { error: guardarError } = await service.from("ahorcado_corridas").upsert(nueva, { onConflict: "user_id" });
  if (guardarError) return { error: guardarError.message };
  return estadoPublico(nueva, elegida);
}

/** Califica una letra. Al ganar la palabra suma los puntos y actualiza el ranking. */
export async function adivinarLetra(
  userId: string,
  letraCruda: string
): Promise<EstadoAhorcado | { error: string; status: number }> {
  const letra = letraCruda.toUpperCase();
  if (!LETRA_VALIDA.test(letra)) return { error: "Letra inválida", status: 400 };

  const service = await createServiceClient();
  const corrida = await leerCorrida(userId);
  const palabra = await leerPalabra(corrida?.palabra_id ?? null);
  if (!corrida || !palabra) return { error: "No hay una partida en curso", status: 409 };
  if (corrida.estado !== "jugando" || corrida.letras.includes(letra)) return estadoPublico(corrida, palabra);

  const letras = [...corrida.letras, letra];
  let { vidas, puntos, ganadas } = corrida;
  let estado: Estado = "jugando";

  if (!palabra.palabra.includes(letra)) {
    vidas -= 1;
    if (vidas <= 0) {
      vidas = 0;
      estado = "perdida";
    }
  } else if ([...palabra.palabra].every((l) => l === " " || letras.includes(l))) {
    estado = "ganada";
    puntos += vidas * PUNTOS_POR_VIDA;
    ganadas += 1;
  }

  const actualizada: Corrida = { ...corrida, letras, vidas, estado, puntos, ganadas, updated_at: new Date().toISOString() };

  // Guarda optimista: si otra petición de la misma cuenta (doble toque, otra
  // pestaña) ya cambió la partida, no se pisa; se devuelve lo que quedó.
  const { data: cambiadas, error } = await service
    .from("ahorcado_corridas")
    .update({ letras, vidas, estado, puntos, ganadas, updated_at: actualizada.updated_at })
    .eq("user_id", userId)
    .eq("updated_at", corrida.updated_at)
    .select("user_id");
  if (error) return { error: error.message, status: 500 };
  if (!cambiadas || cambiadas.length === 0) {
    const fresca = await leerCorrida(userId);
    return fresca ? estadoPublico(fresca, palabra) : { error: "No hay una partida en curso", status: 409 };
  }

  let nuevoRecord: boolean | undefined;
  if (estado === "ganada") nuevoRecord = await guardarRanking(userId, puntos, ganadas);

  return estadoPublico(actualizada, palabra, nuevoRecord);
}

/** Guarda el puntaje de la racha si mejora el récord del jugador. */
async function guardarRanking(userId: string, score: number, palabrasGanadas: number): Promise<boolean> {
  const service = await createServiceClient();
  const { data: existente } = await service
    .from("juego_individual_rankings")
    .select("id, score")
    .eq("game_key", GAME_KEY)
    .eq("user_id", userId)
    .maybeSingle();

  if (existente && score <= (existente.score as number)) return false;

  const fila = {
    game_key: GAME_KEY,
    user_id: userId,
    score,
    metadata: { palabras_ganadas: palabrasGanadas },
    updated_at: new Date().toISOString(),
  };
  const { error } = existente
    ? await service.from("juego_individual_rankings").update(fila).eq("id", existente.id).lt("score", score)
    : await service.from("juego_individual_rankings").upsert(fila, { onConflict: "game_key,user_id" });
  if (error) {
    console.error("[ahorcado] No se pudo guardar el ranking:", error);
    return false;
  }
  return true;
}
