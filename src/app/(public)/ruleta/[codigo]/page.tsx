import { createClient, getProfile } from "@/lib/supabase/server";
import { RuletaRoom } from "@/components/ruleta/RuletaRoom";
import { RuletaJoinCodeForm } from "@/components/ruleta/RuletaJoinCodeForm";
import type { RuletaJugador, RuletaSala } from "@/types";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ codigo: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo } = await params;
  return { title: `Sala ${codigo.toUpperCase()} — La Ruleta` };
}

export default async function RuletaSalaPage({ params }: Props) {
  const { codigo } = await params;
  const codigoUpper = codigo.toUpperCase();
  const supabase = await createClient();

  const { data: sala } = await supabase
    .from("ruleta_salas")
    .select("*")
    .eq("codigo", codigoUpper)
    .maybeSingle();

  if (!sala) {
    return (
      <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
        <div className="w-full max-w-[430px] mx-auto px-4 py-16 flex flex-col items-center gap-6 text-center">
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>La Ruleta</h1>
          <p style={{ color: "var(--color-text-muted)" }}>
            La sala <span className="font-mono font-bold">{codigoUpper}</span> no existe o ya terminó.
          </p>
          <div className="w-full">
            <RuletaJoinCodeForm notFound />
          </div>
        </div>
      </div>
    );
  }

  const [{ data: jugadoresRaw }, profile] = await Promise.all([
    supabase.from("ruleta_jugadores").select("*").eq("sala_id", sala.id).order("orden"),
    getProfile(),
  ]);

  const isHost = profile?.id === sala.created_by;

  return (
    <RuletaRoom
      sala={sala as RuletaSala}
      jugadoresIniciales={(jugadoresRaw ?? []) as RuletaJugador[]}
      isHost={isHost}
    />
  );
}
