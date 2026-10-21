// src/lib/juegos/ahorcado.server.ts
// El Ahorcado se juega en el servidor (ver 0074_ahorcado_servidor.sql): aquí
// se elige la palabra, se califica cada letra, se dan las pistas y se suman
// los puntos. Al navegador solo le llegan las letras acertadas y las pistas
// que ya pidió; la palabra, su descripción y la cita, cuando la partida
// termina (0082_ahorcado_dificultad.sql).
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import {
  CLAVE_RANKING,
  DIFICULTADES,
  PUNTOS_POR_PISTA,
  TOTAL_PISTAS,
  type Dificultad,
  type EstadoAhorcado,
  type PistaAhorcado,
  type SinPartidaAhorcado,
} from "@/lib/juegos/ahorcado-dificultad";
import type { AhorcadoCategoria } from "@/types";

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
  dificultad: Dificultad;
  pistas: number;
  updated_at: string;
}

interface Palabra {
  id: string;
  palabra: string;
  categoria: AhorcadoCategoria;
  pista: string;
  referencia_biblica: string | null;
}

const ETIQUETAS_CATEGORIA: Record<AhorcadoCategoria, string> = {
  personaje: "Personaje bíblico",
  lugar: "Lugar",
  concepto: "Palabra clave",
  libro: "Libro del Nuevo Testamento",
};

// Sección del Nuevo Testamento de cada libro, con el nombre sin acentos y
// en mayúsculas (como queda tras normalizar()).
const SECCIONES: Array<[string, string[]]> = [
  ["Evangelios", ["MATEO", "MARCOS", "LUCAS", "JUAN"]],
  ["Historia de la iglesia", ["HECHOS"]],
  [
    "Epístolas de Pablo",
    [
      "ROMANOS",
      "1 CORINTIOS",
      "2 CORINTIOS",
      "GALATAS",
      "EFESIOS",
      "FILIPENSES",
      "COLOSENSES",
      "1 TESALONICENSES",
      "2 TESALONICENSES",
      "1 TIMOTEO",
      "2 TIMOTEO",
      "TITO",
      "FILEMON",
    ],
  ],
  ["Epístolas generales", ["HEBREOS", "SANTIAGO", "1 PEDRO", "2 PEDRO", "1 JUAN", "2 JUAN", "3 JUAN", "JUDAS"]],
  ["Profecía", ["APOCALIPSIS"]],
];

/** Mayúsculas sin acentos, carácter por carácter (la Ñ se queda). Mismo largo que el original. */
function normalizar(texto: string): string {
  return [...texto]
    .map((c) => (c === "ñ" || c === "Ñ" ? "Ñ" : c.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase()))
    .join("");
}

/** "1 Timoteo 1:2" → "1 Timoteo". */
function libroDeReferencia(referencia: string | null): string | null {
  const m = referencia?.trim().match(/^(.+?)\s+\d+(?::\d+)?/);
  return m ? m[1] : null;
}

function seccionDeLibro(libro: string | null): string {
  const clave = libro ? normalizar(libro) : "";
  return SECCIONES.find(([, libros]) => libros.includes(clave))?.[0] ?? "Nuevo Testamento";
}

/** Tapa con "_____" cada vez que la palabra aparece en el texto (sin importar acentos). */
function taparPalabra(texto: string, palabra: string): string {
  const plano = normalizar(texto);
  let resultado = "";
  let desde = 0;
  let i = plano.indexOf(palabra);
  while (i !== -1) {
    resultado += texto.slice(desde, i) + "_____";
    desde = i + palabra.length;
    i = plano.indexOf(palabra, desde);
  }
  return resultado + texto.slice(desde);
}

/**
 * Si el nombre del libro delataría la palabra: la contiene (JUAN → "Juan")
 * o empieza casi igual (CORINTO → "1 Corintios").
 */
function seParecen(libro: string, palabra: string): boolean {
  if (libro.includes(palabra)) return true;
  let comunes = 0;
  while (comunes < libro.length && libro[comunes] === palabra[comunes]) comunes++;
  return comunes >= Math.min(5, palabra.length);
}

/**
 * Las tres pistas, de la más general a la más concreta:
 * 1. la categoría; 2. el libro de la cita (sin capítulo ni versículo), o su
 * sección del Nuevo Testamento si el libro delataría la palabra (ver
 * seParecen, y todas las de la categoría "libro"); 3. la descripción,
 * con la palabra tapada.
 */
function todasLasPistas(p: Palabra): PistaAhorcado[] {
  const libro = libroDeReferencia(p.referencia_biblica);
  const libroDelata =
    p.categoria === "libro" || !libro || seParecen(normalizar(libro).replace(/^\d\s*/, ""), p.palabra);
  return [
    { titulo: "Categoría", texto: ETIQUETAS_CATEGORIA[p.categoria] },
    libroDelata
      ? { titulo: "Sección del Nuevo Testamento", texto: seccionDeLibro(libro) }
      : { titulo: "Libro", texto: libro },
    { titulo: "Descripción", texto: taparPalabra(p.pista, p.palabra) },
  ];
}

function puntosDeLaPalabra(c: Pick<Corrida, "vidas" | "pistas" | "dificultad">): number {
  const config = DIFICULTADES[c.dificultad];
  const descuento = config.pistas === "con-costo" ? c.pistas * PUNTOS_POR_PISTA : 0;
  return Math.max(0, c.vidas * config.puntosPorVida - descuento);
}

function estadoPublico(c: Corrida, p: Palabra, nuevoRecord?: boolean): EstadoAhorcado {
  const config = DIFICULTADES[c.dificultad];
  const terminada = c.estado !== "jugando";
  return {
    mascara: [...p.palabra].map((l) => (l === " " ? " " : c.letras.includes(l) ? l : "_")),
    letras: c.letras,
    correctas: c.letras.filter((l) => p.palabra.includes(l)),
    vidas: c.vidas,
    vidasIniciales: config.vidas,
    estado: c.estado,
    dificultad: c.dificultad,
    puntos: c.puntos,
    ganadas: c.ganadas,
    puntosPalabra: c.estado === "ganada" ? puntosDeLaPalabra(c) : 0,
    pistas: todasLasPistas(p).slice(0, c.pistas),
    pistasTotales: config.pistas === "ninguna" ? 0 : TOTAL_PISTAS,
    palabra: terminada ? p.palabra : null,
    revelacion: terminada
      ? { categoria: ETIQUETAS_CATEGORIA[p.categoria], descripcion: p.pista, referencia: p.referencia_biblica }
      : null,
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
 * la página no da otra palabra). Con `dificultad` empieza una racha nueva
 * en ese nivel. Sin ella: si la anterior la ganó, sigue la racha con una
 * palabra nueva en el mismo nivel; si no hay partida o la perdió, pide
 * elegir dificultad.
 */
export async function siguientePalabra(
  userId: string,
  dificultad: Dificultad | null,
): Promise<EstadoAhorcado | SinPartidaAhorcado | { error: string }> {
  const service = await createServiceClient();
  const corrida = await leerCorrida(userId);

  if (corrida && corrida.estado === "jugando" && !dificultad) {
    const actual = await leerPalabra(corrida.palabra_id);
    if (actual) return estadoPublico(corrida, actual);
  }

  const sigueRacha = Boolean(corrida && corrida.estado === "ganada" && !dificultad);
  if (!dificultad && !sigueRacha) {
    return { necesitaDificultad: true, dificultad: corrida?.dificultad ?? "normal" };
  }

  const nivel: Dificultad = dificultad ?? corrida?.dificultad ?? "normal";
  const config = DIFICULTADES[nivel];
  const usadas = sigueRacha ? (corrida?.usadas ?? []) : [];

  const { data: activas, error } = await service
    .from("ahorcado_palabras")
    .select("id, palabra, categoria, pista, referencia_biblica")
    .eq("activo", true);
  if (error) return { error: error.message };
  const todas = ((activas ?? []) as Palabra[]).filter((p) => p.palabra.replace(/ /g, "").length >= config.largoMinimo);
  if (todas.length === 0) return { error: "No hay palabras activas en el banco" };

  // Si ya salieron todas en esta racha, se vuelve a empezar la lista.
  const disponibles = todas.filter((p) => !usadas.includes(p.id));
  const lista = disponibles.length > 0 ? disponibles : todas;
  const elegida = lista[Math.floor(Math.random() * lista.length)];

  const nueva: Corrida = {
    user_id: userId,
    palabra_id: elegida.id,
    letras: [],
    vidas: config.vidas,
    estado: "jugando",
    puntos: sigueRacha ? (corrida?.puntos ?? 0) : 0,
    ganadas: sigueRacha ? (corrida?.ganadas ?? 0) : 0,
    usadas: [...(disponibles.length > 0 ? usadas : []), elegida.id],
    dificultad: nivel,
    pistas: 0,
    updated_at: new Date().toISOString(),
  };

  const { error: guardarError } = await service.from("ahorcado_corridas").upsert(nueva, { onConflict: "user_id" });
  if (guardarError) return { error: guardarError.message };
  return estadoPublico(nueva, elegida);
}

/**
 * Guarda optimista: si otra petición de la misma cuenta (doble toque, otra
 * pestaña) ya cambió la partida, no se pisa. Devuelve false en ese caso.
 */
async function guardarCambios(
  anterior: Corrida,
  cambios: Partial<Pick<Corrida, "letras" | "vidas" | "estado" | "puntos" | "ganadas" | "pistas">> & {
    updated_at: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const service = await createServiceClient();
  const { data: cambiadas, error } = await service
    .from("ahorcado_corridas")
    .update(cambios)
    .eq("user_id", anterior.user_id)
    .eq("updated_at", anterior.updated_at)
    .select("user_id");
  if (error) return { ok: false, error: error.message };
  return { ok: Boolean(cambiadas && cambiadas.length > 0) };
}

/** Califica una letra. Al ganar la palabra suma los puntos y actualiza el ranking. */
export async function adivinarLetra(
  userId: string,
  letraCruda: string,
): Promise<EstadoAhorcado | { error: string; status: number }> {
  const letra = letraCruda.toUpperCase();
  if (!LETRA_VALIDA.test(letra)) return { error: "Letra inválida", status: 400 };

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
    puntos += puntosDeLaPalabra({ ...corrida, vidas });
    ganadas += 1;
  }

  const actualizada: Corrida = {
    ...corrida,
    letras,
    vidas,
    estado,
    puntos,
    ganadas,
    updated_at: new Date().toISOString(),
  };

  const guardado = await guardarCambios(corrida, {
    letras,
    vidas,
    estado,
    puntos,
    ganadas,
    updated_at: actualizada.updated_at,
  });
  if (guardado.error) return { error: guardado.error, status: 500 };
  if (!guardado.ok) {
    const fresca = await leerCorrida(userId);
    return fresca ? estadoPublico(fresca, palabra) : { error: "No hay una partida en curso", status: 409 };
  }

  if (estado !== "jugando") {
    await guardarResultado(
      userId,
      corrida.palabra_id,
      estado === "ganada",
      puntosDeLaPalabra(actualizada),
      corrida.dificultad,
    );
  }

  let nuevoRecord: boolean | undefined;
  if (estado === "ganada") nuevoRecord = await guardarRanking(userId, puntos, ganadas, corrida.dificultad);

  return estadoPublico(actualizada, palabra, nuevoRecord);
}

/**
 * Da la siguiente pista. En Normal cuesta una vida (y PUNTOS_POR_PISTA al
 * ganar), y no se da si esa vida haría perder la partida. En Difícil no hay.
 */
export async function pedirPista(userId: string): Promise<EstadoAhorcado | { error: string; status: number }> {
  const corrida = await leerCorrida(userId);
  const palabra = await leerPalabra(corrida?.palabra_id ?? null);
  if (!corrida || !palabra) return { error: "No hay una partida en curso", status: 409 };
  if (corrida.estado !== "jugando" || corrida.pistas >= TOTAL_PISTAS) return estadoPublico(corrida, palabra);

  const config = DIFICULTADES[corrida.dificultad];
  if (config.pistas === "ninguna") return { error: "En Difícil no hay pistas.", status: 400 };

  let vidas = corrida.vidas;
  if (config.pistas === "con-costo") {
    if (vidas <= 1) {
      return { error: "Te queda una sola vida: otra pista te haría perder.", status: 409 };
    }
    vidas -= 1;
  }

  const pistas = corrida.pistas + 1;
  const actualizada: Corrida = { ...corrida, vidas, pistas, updated_at: new Date().toISOString() };
  const guardado = await guardarCambios(corrida, { vidas, pistas, updated_at: actualizada.updated_at });
  if (guardado.error) return { error: guardado.error, status: 500 };
  if (!guardado.ok) {
    const fresca = await leerCorrida(userId);
    return fresca ? estadoPublico(fresca, palabra) : { error: "No hay una partida en curso", status: 409 };
  }
  return estadoPublico(actualizada, palabra);
}

/**
 * Una fila por palabra terminada (0080), para "Campeones de la semana".
 * Si falla no se interrumpe la partida: solo se pierde esa fila.
 */
async function guardarResultado(
  userId: string,
  palabraId: string | null,
  ganada: boolean,
  puntos: number,
  dificultad: Dificultad,
): Promise<void> {
  const service = await createServiceClient();
  const { error } = await service.from("ahorcado_resultados").insert({
    user_id: userId,
    palabra_id: palabraId,
    ganada,
    puntos: ganada ? puntos : 0,
    dificultad,
  });
  if (error) console.error("[ahorcado] No se pudo guardar el resultado:", error);
}

/** Guarda el puntaje de la racha si mejora el récord del jugador en ese nivel. */
async function guardarRanking(
  userId: string,
  score: number,
  palabrasGanadas: number,
  dificultad: Dificultad,
): Promise<boolean> {
  const gameKey = CLAVE_RANKING[dificultad];
  const service = await createServiceClient();
  const { data: existente } = await service
    .from("juego_individual_rankings")
    .select("id, score")
    .eq("game_key", gameKey)
    .eq("user_id", userId)
    .maybeSingle();

  if (existente && score <= (existente.score as number)) return false;

  const fila = {
    game_key: gameKey,
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

/** Nivel de la partida actual (o la última), para abrir la tabla de ese nivel. */
export async function dificultadActual(userId: string): Promise<Dificultad> {
  const corrida = await leerCorrida(userId);
  return corrida?.dificultad ?? "normal";
}
