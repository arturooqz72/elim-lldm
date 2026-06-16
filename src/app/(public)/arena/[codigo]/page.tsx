import { createClient, getProfile } from "@/lib/supabase/server";
import { ArenaRoom } from "@/components/arena/ArenaRoom";
import { JoinCodeForm } from "@/components/arena/JoinCodeForm";
import type { ArenaJugador, ArenaSala } from "@/types";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ codigo: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo } = await params;
  return { title: `Sala ${codigo.toUpperCase()} — Elim Arena` };
}

export default async function ArenaSalaPage({ params }: Props) {
  const { codigo } = await params;
  const codigoUpper = codigo.toUpperCase();
  const supabase = await createClient();

  const { data: sala } = await supabase
    .from("elim_arena_salas")
    .select("*")
    .eq("codigo", codigoUpper)
    .maybeSingle();

  if (!sala) {
    return (
      <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
        <div className="w-full max-w-[430px] mx-auto px-4 py-16 flex flex-col items-center gap-6 text-center">
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
            Elim Arena
          </h1>
          <p style={{ color: "var(--color-text-muted)" }}>
            La sala <span className="font-mono font-bold">{codigoUpper}</span> no existe o ya terminó.
          </p>
          <div className="w-full">
            <JoinCodeForm notFound />
          </div>
        </div>
      </div>
    );
  }

  const [{ data: preguntasRaw }, { data: jugadoresRaw }, profile] = await Promise.all([
    supabase
      .from("elim_arena_preguntas")
      .select("id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, orden")
      .eq("sala_id", sala.id)
      .order("orden"),
    supabase
      .from("elim_arena_jugadores")
      .select("*")
      .eq("sala_id", sala.id)
      .order("created_at"),
    getProfile(),
  ]);

  const isHost = profile?.id === sala.created_by;

  return (
    <ArenaRoom
      sala={sala as ArenaSala}
      preguntas={preguntasRaw ?? []}
      jugadoresIniciales={(jugadoresRaw ?? []) as ArenaJugador[]}
      isHost={isHost}
    />
  );
}
