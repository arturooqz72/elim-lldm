import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { peekOpenRoom } from "@/lib/arena-publica/room.server";
import { ArenaPublicaRoom } from "@/components/arena-publica/ArenaPublicaRoom";
import { EntrarForm } from "@/components/arena-publica/EntrarForm";
import type { ArenaJugador } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Trivia en línea — Elim LLDM" };

function toMs(iso: string | null): number | null {
  return iso === null ? null : new Date(iso).getTime();
}

export default async function ArenaAbiertaPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?returnUrl=/arena-abierta");

  const sala = await peekOpenRoom();

  if (!sala) {
    // No hay sala abierta — no se crea aquí. El EntrarForm la crea vía
    // /api/arena-publica/join con la meta que elija el jugador.
    return (
      <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
        <div className="w-full max-w-[430px] mx-auto px-4 py-16 flex flex-col">
          <EntrarForm />
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
      jugadoresDeseados={sala.jugadores_deseados}
      cuentaTerminaEn={toMs(sala.cuenta_termina_en)}
      preguntaTerminaEn={toMs(sala.pregunta_termina_en)}
      revealTerminaEn={toMs(sala.reveal_termina_en)}
      preguntas={preguntasRaw ?? []}
      totalPreguntas={sala.total_preguntas}
      jugadoresIniciales={(jugadoresRaw ?? []) as ArenaJugador[]}
    />
  );
}
