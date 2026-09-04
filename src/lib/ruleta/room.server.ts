// src/lib/ruleta/room.server.ts
import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { MIN_PLAYERS } from "./wheel";
import { healStaleRuletaRooms } from "./advance.server";

const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function generateCode() {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/**
 * Devuelve la sala "abierta a unirse" (la más reciente en 'lobby'). Si no
 * existe ninguna, crea una nueva — a diferencia de Arena Abierta, aquí no
 * hay contenido que sembrar de una vez (la frase se elige recién al
 * arrancar, en tryStartMatch()), así que crear una sala de Ruleta es más
 * simple: solo la fila de ruleta_salas.
 *
 * jugadoresDeseados solo se usa si esta llamada es la que efectivamente
 * crea la sala — si ya existía una en 'lobby', se devuelve tal cual, con
 * el número que fijó quien la creó primero.
 *
 * También dispara healStaleRuletaRooms() de paso — cualquier visita a
 * /ruleta ayuda a sanar salas abandonadas, igual que en Arena Abierta.
 */
export async function getOrCreateOpenRoom(jugadoresDeseados = MIN_PLAYERS): Promise<{
  sala: { id: string; codigo: string } | null;
  error: string | null;
}> {
  const service = await createServiceClient();

  await healStaleRuletaRooms().catch((err) => {
    console.error("[ruleta/room] Error inesperado en healStaleRuletaRooms:", err);
  });

  const buscarSalaAbierta = () =>
    service
      .from("ruleta_salas")
      .select("id, codigo")
      .eq("status", "lobby")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  const { data: existente } = await buscarSalaAbierta();
  if (existente) return { sala: existente, error: null };

  let codigo = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateCode();
    const { data: enUso } = await service
      .from("ruleta_salas")
      .select("id")
      .eq("codigo", candidate)
      .maybeSingle();
    if (!enUso) {
      codigo = candidate;
      break;
    }
  }

  if (!codigo) {
    return { sala: null, error: "No se pudo generar un código único" };
  }

  const { data: nuevaSala, error } = await service
    .from("ruleta_salas")
    .insert({ codigo, jugadores_deseados: jugadoresDeseados })
    .select("id, codigo")
    .single();

  if (error || !nuevaSala) {
    // 23505 = violación de idx_ruleta_salas_una_lobby: otra request
    // concurrente ganó la carrera. No es un error real — esa sala ya
    // existe, así que la buscamos y la devolvemos en vez de fallar.
    if (error?.code === "23505") {
      const { data: salaGanadora } = await buscarSalaAbierta();
      if (salaGanadora) return { sala: salaGanadora, error: null };
    }
    return { sala: null, error: error?.message ?? "No se pudo crear la sala" };
  }

  return { sala: nuevaSala, error: null };
}

/**
 * Versión de solo lectura para la página — nunca crea una sala. Devuelve
 * la sala más reciente que no esté 'finished' (de cualquier estado:
 * 'lobby', 'playing', 'ronda_fin'), para pintar el estado actual a un
 * visitante que todavía no se unió, o reconectar a uno que ya estaba
 * jugando. Si no hay ninguna, devuelve null y la página muestra el
 * selector "¿cuántos van a jugar?" sin ninguna sala de referencia — así
 * la sala nueva solo nace cuando /api/ruleta/join la crea, con la
 * preferencia real del jugador, en vez de que la propia carga de la
 * página se adelante y cree una con el valor por defecto antes de que
 * el jugador alcance a elegir.
 */
export async function peekOpenRoom(): Promise<{ id: string; codigo: string } | null> {
  const service = await createServiceClient();

  await healStaleRuletaRooms().catch((err) => {
    console.error("[ruleta/room] Error inesperado en healStaleRuletaRooms:", err);
  });

  const { data } = await service
    .from("ruleta_salas")
    .select("id, codigo")
    .neq("status", "finished")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}
