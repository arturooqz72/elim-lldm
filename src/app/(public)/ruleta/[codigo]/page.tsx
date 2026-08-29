import { createClient, createServiceClient, getProfile } from "@/lib/supabase/server";
import { RuletaRoom, type RoundState } from "@/components/ruleta/RuletaRoom";
import { RuletaJoinCodeForm } from "@/components/ruleta/RuletaJoinCodeForm";
import { buildBoardShape } from "@/lib/ruleta/game.server";
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

  // Si el usuario tiene sesión y ya tiene una fila de jugador en esta sala
  // (creada desde otro dispositivo, o en una visita anterior), reconéctalo
  // con esa misma identidad en vez de dejar que localStorage — que es por
  // navegador, no por cuenta — decida si "ya está jugando" o no.
  const initialJugadorId = profile
    ? ((jugadoresRaw ?? []).find((j) => j.user_id === profile.id)?.id ?? null)
    : null;

  // Si alguien carga/recarga la página después de que la ronda ya empezó,
  // nunca va a recibir el broadcast ROUND_START (ya se disparó antes de que
  // se conectara) — hay que reconstruir el estado actual desde la DB para
  // que no se quede con la pantalla en blanco.
  let initialRound: RoundState | null = null;
  if (sala.status === "playing" || sala.status === "ronda_fin") {
    const service = await createServiceClient();
    const { data: ronda } = await service
      .from("ruleta_rondas")
      .select("categoria, frase, letras_adivinadas")
      .eq("sala_id", sala.id)
      .eq("ronda_numero", sala.ronda_actual)
      .maybeSingle();

    if (ronda) {
      const letrasProbadas = ronda.letras_adivinadas as string[];
      initialRound = {
        ronda: sala.ronda_actual,
        totalRondas: sala.rondas_totales,
        categoria: ronda.categoria,
        board: buildBoardShape(ronda.frase, letrasProbadas),
        letrasProbadas,
        turnoJugadorId: sala.turno_jugador_id,
        turnoTerminaEn: sala.turno_termina_en ? new Date(sala.turno_termina_en).getTime() : null,
        puedeConsonante: sala.puede_consonante,
        giroUsado: sala.giro_usado,
        mensaje: sala.status === "ronda_fin" ? "Ronda terminada." : "Partida en curso.",
        frase: sala.status === "ronda_fin" ? ronda.frase : undefined,
        spinToSegment: null,
      };
    }
  }

  return (
    <RuletaRoom
      sala={sala as RuletaSala}
      jugadoresIniciales={(jugadoresRaw ?? []) as RuletaJugador[]}
      isHost={isHost}
      initialRound={initialRound}
      initialJugadorId={initialJugadorId}
    />
  );
}
