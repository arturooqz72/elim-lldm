import { createClient } from "@/lib/supabase/server";
import { getOrCreateOpenRoom } from "@/lib/arena-publica/room.server";
import { ArenaPublicaRoom } from "@/components/arena-publica/ArenaPublicaRoom";
import type { ArenaJugador } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Arena Abierta — Elim LLDM" };

function toMs(iso: string | null): number | null {
  return iso === null ? null : new Date(iso).getTime();
}

export default async function ArenaAbiertaPage() {
  const { sala, error } = await getOrCreateOpenRoom();

  if (!sala) {
    return (
      <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
        <div className="w-full max-w-[430px] mx-auto px-4 py-16 flex flex-col items-center gap-6 text-center">
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
            Arena Abierta
          </h1>
          <p style={{ color: "var(--color-text-muted)" }}>
            {error ?? "No se pudo cargar la sala."}
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const [{ data: preguntasRaw }, { data: jugadoresRaw }] = await Promise.all([
    supabase
      .from("arena_publica_preguntas")
      .select("id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, orden")
      .eq("sala_id", sala.id)
      .order("orden"),
    supabase
      .from("arena_publica_jugadores")
      .select("*")
      .eq("sala_id", sala.id)
      .order("created_at"),
  ]);

  return (
    <ArenaPublicaRoom
      salaId={sala.id}
      status={sala.status}
      preguntaActual={sala.pregunta_actual}
      cuentaTerminaEn={toMs(sala.cuenta_termina_en)}
      preguntaTerminaEn={toMs(sala.pregunta_termina_en)}
      revealTerminaEn={toMs(sala.reveal_termina_en)}
      preguntas={preguntasRaw ?? []}
      jugadoresIniciales={(jugadoresRaw ?? []) as ArenaJugador[]}
    />
  );
}
