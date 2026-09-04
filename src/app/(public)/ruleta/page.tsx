import { redirect } from "next/navigation";
import { createClient, createServiceClient, getProfile } from "@/lib/supabase/server";
import { peekOpenRoom } from "@/lib/ruleta/room.server";
import { RuletaRoom, type RoundState } from "@/components/ruleta/RuletaRoom";
import { EntrarForm } from "@/components/ruleta/EntrarForm";
import { buildBoardShape } from "@/lib/ruleta/game.server";
import type { RuletaJugador, RuletaSala } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "La Ruleta en línea — Elim LLDM",
  description: "Juega La Ruleta con otros miembros — sin códigos, entra directo.",
};

export default async function RuletaPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?returnUrl=/ruleta");

  const salaBase = await peekOpenRoom();

  if (!salaBase) {
    // No hay ninguna sala activa todavía — no se crea ninguna aquí. El
    // propio EntrarForm, al enviar el selector, es quien crea la sala vía
    // /api/ruleta/join con la meta que elija el jugador.
    return (
      <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
        <div className="w-full max-w-[480px] mx-auto px-4 py-16 flex flex-col">
          <EntrarForm />
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const [{ data: sala, error: salaError }, { data: jugadoresRaw, error: jugadoresError }] = await Promise.all([
    supabase.from("ruleta_salas").select("*").eq("id", salaBase.id).single(),
    supabase.from("ruleta_jugadores").select("*").eq("sala_id", salaBase.id).order("orden"),
  ]);

  if (salaError) console.error("[ruleta/page] Error al leer la sala:", salaError);
  if (jugadoresError) console.error("[ruleta/page] Error al leer los jugadores:", jugadoresError);

  if (!sala) {
    return (
      <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
        <div className="w-full max-w-[480px] mx-auto px-4 py-16 flex flex-col items-center gap-6 text-center">
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>La Ruleta</h1>
          <p style={{ color: "var(--color-text-muted)" }}>No se pudo cargar la sala.</p>
        </div>
      </div>
    );
  }

  const initialJugadorId =
    (jugadoresRaw ?? []).find((j) => j.user_id === profile.id)?.id ?? null;

  // Si alguien carga/recarga la página después de que la ronda ya empezó,
  // nunca va a recibir el broadcast ROUND_START (ya se disparó antes de que
  // se conectara) — hay que reconstruir el estado actual desde la DB.
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
        rondaFinTerminaEn: sala.ronda_fin_termina_en ? new Date(sala.ronda_fin_termina_en).getTime() : null,
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
      initialRound={initialRound}
      initialJugadorId={initialJugadorId}
    />
  );
}
