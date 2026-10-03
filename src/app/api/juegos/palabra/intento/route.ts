// src/app/api/juegos/palabra/intento/route.ts
//
// Evalúa UN intento de la Palabra del Día en el servidor y devuelve solo
// los colores. La respuesta se revela únicamente cuando la partida termina.
//
// - Con sesión: la partida vive en palabra_partidas (una por usuario y
//   día). El servidor es la fuente de verdad: guarda cada intento, impide
//   jugar dos veces el mismo día y recalcula la racha al terminar.
// - Sin sesión: no hay dónde guardar, así que el navegador manda sus
//   intentos previos (`previos`) y el servidor los vuelve a validar para
//   saber si la partida termina con este intento. El progreso y la racha
//   quedan en localStorage (no cuentan para el ranking).
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PALABRA_MAX_INTENTOS } from "@/lib/palabra/config";
import { evaluarIntento, normalizarPalabra, tieneFormatoValido } from "@/lib/palabra/logica";
import {
  COLUMNAS_PARTIDA,
  fechaDeHoy,
  getEstadoJugador,
  getPalabraPorFecha,
  recalcularRacha,
  type FilaPartida,
} from "@/lib/palabra/servidor";
import { PALABRAS_VALIDAS } from "@/lib/palabra/validas";
import type { PalabraIntento } from "@/types";

function error(status: number, codigo: string, mensaje: string) {
  return NextResponse.json({ error: codigo, mensaje }, { status });
}

export async function POST(request: Request) {
  let body: { intento?: unknown; previos?: unknown };
  try {
    body = await request.json();
  } catch {
    return error(400, "cuerpo_invalido", "Solicitud inválida.");
  }

  if (typeof body.intento !== "string") return error(400, "cuerpo_invalido", "Falta el intento.");
  const intento = normalizarPalabra(body.intento);
  if (!tieneFormatoValido(intento)) return error(400, "formato", "La palabra debe tener 5 letras.");

  const hoy = fechaDeHoy();
  const service = await createServiceClient();
  const palabraHoy = await getPalabraPorFecha(hoy, service);
  if (!palabraHoy) return error(404, "sin_palabra", "Hoy no hay palabra programada. Vuelve más tarde.");

  const respuesta = normalizarPalabra(palabraHoy.palabra);
  // La respuesta siempre es un intento válido aunque un admin haya agregado
  // un nombre propio que no está en la lista general.
  const esValida = (p: string) => p === respuesta || PALABRAS_VALIDAS.has(p);
  if (!esValida(intento)) return error(422, "no_valida", "No está en la lista de palabras.");

  const colores = evaluarIntento(intento, respuesta);
  const nuevo: PalabraIntento = { palabra: intento, colores };

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  // ---------- Sin sesión ----------
  if (!user) {
    const previos = Array.isArray(body.previos) ? body.previos : [];
    if (previos.length >= PALABRA_MAX_INTENTOS) return error(409, "terminada", "Ya usaste tus 6 intentos de hoy.");
    for (const p of previos) {
      const n = typeof p === "string" ? normalizarPalabra(p) : "";
      if (!tieneFormatoValido(n) || !esValida(n)) return error(400, "previos_invalidos", "Intentos previos inválidos.");
      if (n === respuesta) return error(409, "terminada", "Ya resolviste la palabra de hoy.");
    }
    const resuelta = intento === respuesta;
    const terminada = resuelta || previos.length + 1 >= PALABRA_MAX_INTENTOS;
    return NextResponse.json({
      intento: nuevo,
      terminada,
      resuelta,
      revelado: terminada ? palabraHoy : null,
    });
  }

  // ---------- Con sesión ----------
  const buscarPartida = async () =>
    service
      .from("palabra_partidas")
      .select(COLUMNAS_PARTIDA)
      .eq("user_id", user.id)
      .eq("fecha", hoy)
      .maybeSingle();

  let { data: partida } = await buscarPartida();
  if (!partida) {
    const { data: creada, error: errorInsert } = await service
      .from("palabra_partidas")
      .insert({ user_id: user.id, fecha: hoy })
      .select(COLUMNAS_PARTIDA)
      .single();
    if (errorInsert) {
      // 23505 = otra request de la misma cuenta la creó entre medio (doble
      // pestaña, doble envío): usamos la que ganó.
      if (errorInsert.code !== "23505") return error(500, "db", errorInsert.message);
      ({ data: partida } = await buscarPartida());
    } else {
      partida = creada;
    }
  }
  if (!partida) return error(500, "db", "No se pudo crear la partida.");

  const fila = partida as FilaPartida;
  if (fila.terminada) return error(409, "terminada", "Ya jugaste la palabra de hoy. ¡Vuelve mañana!");

  const intentos = [...(fila.intentos ?? []), nuevo];
  const resuelta = intento === respuesta;
  const terminada = resuelta || intentos.length >= PALABRA_MAX_INTENTOS;

  // Guardia CAS sobre num_intentos: si dos envíos llegan a la vez, solo uno
  // agrega su intento; el otro recibe 409 y el cliente recarga el estado.
  const { data: actualizada, error: errorUpdate } = await service
    .from("palabra_partidas")
    .update({
      intentos,
      num_intentos: intentos.length,
      resuelta,
      terminada,
      updated_at: new Date().toISOString(),
    })
    .eq("id", fila.id)
    .eq("num_intentos", fila.num_intentos)
    .eq("terminada", false)
    .select("id");
  if (errorUpdate) return error(500, "db", errorUpdate.message);
  if (!actualizada || actualizada.length === 0) {
    return error(409, "conflicto", "Tu partida cambió en otra pestaña. Recarga la página.");
  }

  if (!terminada) {
    return NextResponse.json({ intento: nuevo, terminada: false, resuelta: false, revelado: null });
  }

  await recalcularRacha(user.id, service);
  const estado = await getEstadoJugador(user.id, hoy, service);
  return NextResponse.json({ intento: nuevo, terminada, resuelta, revelado: palabraHoy, estado });
}
