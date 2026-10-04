// src/app/api/juegos/palabra/pista/route.ts
//
// Devuelve la pista de hoy: el libro de la Biblia donde aparece la palabra
// (nunca la palabra ni el versículo). Con sesión, deja marcada la partida
// con pista_usada = true — eso le resta puntos en el ranking de hoy (ver
// 0056_palabra_pista.sql). Sin sesión solo devuelve el texto: el progreso
// sin sesión no cuenta para el ranking.
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { pistaDesdeReferencia } from "@/lib/palabra/logica";
import { COLUMNAS_PARTIDA, fechaDeHoy, getPalabraPorFecha, type FilaPartida } from "@/lib/palabra/servidor";

export async function POST() {
  const hoy = fechaDeHoy();
  const service = await createServiceClient();
  const palabraHoy = await getPalabraPorFecha(hoy, service);
  if (!palabraHoy) {
    return NextResponse.json({ error: "sin_palabra", mensaje: "Hoy no hay palabra programada." }, { status: 404 });
  }
  const pista = pistaDesdeReferencia(palabraHoy.referencia, palabraHoy.palabra);

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ pista });

  const buscarPartida = async () =>
    service.from("palabra_partidas").select(COLUMNAS_PARTIDA).eq("user_id", user.id).eq("fecha", hoy).maybeSingle();

  let { data: partida } = await buscarPartida();
  if (!partida) {
    // Pidió la pista antes de su primer intento: se crea la partida ya marcada.
    const { error } = await service.from("palabra_partidas").insert({ user_id: user.id, fecha: hoy, pista_usada: true });
    if (!error) return NextResponse.json({ pista });
    // 23505 = la partida se creó entre medio (otra pestaña): se marca abajo.
    if (error.code !== "23505") return NextResponse.json({ error: "db", mensaje: error.message }, { status: 500 });
    ({ data: partida } = await buscarPartida());
    if (!partida) return NextResponse.json({ error: "db", mensaje: "No se encontró la partida." }, { status: 500 });
  }

  const fila = partida as FilaPartida;
  if (fila.terminada) {
    return NextResponse.json(
      { error: "terminada", mensaje: "Ya terminaste la palabra de hoy." },
      { status: 409 }
    );
  }
  if (!fila.pista_usada) {
    const { error } = await service
      .from("palabra_partidas")
      .update({ pista_usada: true, updated_at: new Date().toISOString() })
      .eq("id", fila.id)
      .eq("terminada", false);
    if (error) return NextResponse.json({ error: "db", mensaje: error.message }, { status: 500 });
  }
  return NextResponse.json({ pista });
}
