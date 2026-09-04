"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Share2, SkipForward, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { RuletaBoardTile, RuletaJugador, RuletaSala } from "@/types";
import {
  playJoinChime,
  playLandSound,
  playCorrectSound,
  playWrongSound,
  playWinSound,
  playBankruptSound,
  playTimeoutSound,
  unlockAudioContext,
} from "@/lib/ruleta/sound.client";
import { VOWEL_COST, MIN_PLAYERS } from "@/lib/ruleta/wheel";
import { EntrarForm } from "./EntrarForm";
import { RuletaVoiceChat } from "./RuletaVoiceChat";
import { Wheel } from "./Wheel";
import { Board } from "./Board";
import { Letters } from "./Letters";
import { Scoreboard } from "./Scoreboard";
import { TurnTimer } from "./TurnTimer";
import { RoundBanner } from "./RoundBanner";
import { MatchEndScreen } from "./MatchEndScreen";

type Phase = "lobby" | "playing" | "ronda_fin" | "finished";

export interface RoundState {
  ronda: number;
  totalRondas: number;
  categoria: string;
  board: RuletaBoardTile[];
  letrasProbadas: string[];
  turnoJugadorId: string | null;
  turnoTerminaEn: number | null;
  rondaFinTerminaEn: number | null;
  puedeConsonante: boolean;
  giroUsado: boolean;
  mensaje: string;
  frase?: string;
  spinToSegment: number | null;
}

interface RuletaRoomProps {
  sala: RuletaSala;
  jugadoresIniciales: RuletaJugador[];
  initialRound?: RoundState | null;
  initialJugadorId?: string | null;
}

function phaseFromStatus(status: RuletaSala["status"]): Phase {
  if (status === "finished") return "finished";
  if (status === "ronda_fin") return "ronda_fin";
  if (status === "playing") return "playing";
  return "lobby";
}

export function RuletaRoom({
  sala,
  jugadoresIniciales,
  initialRound = null,
  initialJugadorId = null,
}: RuletaRoomProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(() => phaseFromStatus(sala.status));
  const [jugadores, setJugadores] = useState<RuletaJugador[]>(jugadoresIniciales);
  const [jugadorId, setJugadorId] = useState<string | null>(initialJugadorId);
  const [round, setRound] = useState<RoundState | null>(initialRound);
  const [spinToken, setSpinToken] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const [resolveText, setResolveText] = useState("");
  const jugadorCountRef = useRef(jugadoresIniciales.length);
  const isFirstJugadoresLoad = useRef(true);

  // Restaurar identidad del jugador desde localStorage — solo hace falta
  // para invitados sin cuenta; si el servidor ya resolvió initialJugadorId
  // a partir de la cuenta logueada, esa identidad manda.
  useEffect(() => {
    if (initialJugadorId) return;
    try {
      const stored = localStorage.getItem(`ruleta_jugador_${sala.codigo}`);
      if (stored) setJugadorId((JSON.parse(stored) as { id: string }).id);
    } catch {
      // localStorage no disponible
    }
  }, [sala.codigo, initialJugadorId]);

  // Desbloquear el AudioContext en la primera interacción real del usuario
  // con la página — los navegadores móviles lo mantienen silenciado hasta
  // entonces, sin importar qué botón se toque primero.
  useEffect(() => {
    function unlock() {
      unlockAudioContext();
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    }
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  // Suscripciones realtime
  useEffect(() => {
    const supabase = createClient();

    // Red de seguridad: el marcador normalmente se actualiza solo por la
    // suscripción postgres_changes de más abajo, pero en móvil esa conexión
    // puede quedarse atrás (pestaña en segundo plano, reconexión lenta) sin
    // que la del juego se vea afectada — el jugador sigue viendo el tablero
    // avanzar con normalidad mientras su puntaje se queda congelado. Cuando
    // un evento indica que los puntos de alguien cambiaron, se vuelve a leer
    // la lista completa de jugadores directo de la base, sin depender de
    // que esa segunda conexión haya entregado el UPDATE.
    async function refetchJugadores() {
      const { data } = await supabase
        .from("ruleta_jugadores")
        .select("*")
        .eq("sala_id", sala.id)
        .order("orden");
      if (data) setJugadores(data as RuletaJugador[]);
    }

    const channel = supabase
      .channel(`ruleta:${sala.codigo}`)
      .on("broadcast", { event: "*" }, (msg) => {
        const { event, payload } = msg as unknown as { event: string; payload: Record<string, unknown> };

        if (event === "ROUND_START") {
          const p = payload as unknown as Omit<RoundState, "spinToSegment" | "mensaje" | "puedeConsonante" | "giroUsado">;
          setRound({
            ...p, spinToSegment: null, mensaje: "Nueva frase cargada.",
            puedeConsonante: false, giroUsado: false, rondaFinTerminaEn: null,
          });
          setPhase("playing");
        }

        if (event === "SPIN_RESULT") {
          const p = payload as unknown as {
            segmentIndex: number; tipo: string; valor?: number;
            turnoJugadorId: string; turnoTerminaEn: number; mensaje: string;
          };
          setSpinToken((t) => t + 1);
          setRound((prev) => prev && ({
            ...prev,
            spinToSegment: p.segmentIndex,
            turnoJugadorId: p.turnoJugadorId,
            turnoTerminaEn: p.turnoTerminaEn,
            puedeConsonante: p.tipo === "puntos",
            giroUsado: p.tipo === "puntos",
            mensaje: p.mensaje,
          }));
          if (p.tipo === "bancarrota") {
            playBankruptSound();
            void refetchJugadores();
          } else {
            playLandSound();
          }
        }

        if (event === "LETTER_RESULT" || event === "RESOLVE_RESULT") {
          const p = payload as unknown as {
            board?: RuletaBoardTile[]; letrasProbadas?: string[];
            turnoJugadorId: string; turnoTerminaEn: number | null;
            resuelto: boolean; frase?: string; mensaje: string;
            esVocal?: boolean; acierto?: boolean;
            rondaFinTerminaEn?: number | null;
          };
          const preserveConsonante = p.esVocal === true && p.acierto === true && !p.resuelto;
          setRound((prev) => prev && ({
            ...prev,
            board: p.board ?? prev.board,
            letrasProbadas: p.letrasProbadas ?? prev.letrasProbadas,
            turnoJugadorId: p.turnoJugadorId,
            turnoTerminaEn: p.turnoTerminaEn,
            rondaFinTerminaEn: p.rondaFinTerminaEn ?? null,
            puedeConsonante: preserveConsonante ? prev.puedeConsonante : false,
            mensaje: p.mensaje,
            frase: p.frase ?? prev.frase,
            spinToSegment: prev.spinToSegment,
          }));
          if (p.esVocal === true || p.acierto === true) void refetchJugadores();

          if (p.resuelto) {
            playWinSound();
            setPhase("ronda_fin");
          } else if (p.acierto === true) {
            playCorrectSound();
          } else if (p.acierto === false) {
            playWrongSound();
          }
        }

        if (event === "TURN_TIMEOUT") {
          const p = payload as unknown as { turnoJugadorId: string; turnoTerminaEn: number; mensaje: string };
          setRound((prev) => prev && ({
            ...prev, turnoJugadorId: p.turnoJugadorId, turnoTerminaEn: p.turnoTerminaEn,
            puedeConsonante: false, giroUsado: false, mensaje: p.mensaje,
          }));
          playTimeoutSound();
        }

        if (event === "GAME_FINISHED") setPhase("finished");
      });

    const jugadoresChannel = supabase
      .channel(`ruleta-jugadores:${sala.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ruleta_jugadores", filter: `sala_id=eq.${sala.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const nuevo = payload.new as RuletaJugador;
            setJugadores((prev) => (prev.some((j) => j.id === nuevo.id) ? prev : [...prev, nuevo].sort((a, b) => a.orden - b.orden)));
          } else if (payload.eventType === "UPDATE") {
            const actualizado = payload.new as RuletaJugador;
            setJugadores((prev) => prev.map((j) => (j.id === actualizado.id ? actualizado : j)));
          } else if (payload.eventType === "DELETE") {
            const eliminado = payload.old as { id: string };
            setJugadores((prev) => prev.filter((j) => j.id !== eliminado.id));
          }
        }
      )
      .subscribe();

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(jugadoresChannel);
    };
  }, [sala.codigo, sala.id]);

  // Aviso sonoro cuando alguien se une, mientras seguimos en el lobby
  useEffect(() => {
    if (isFirstJugadoresLoad.current) {
      isFirstJugadoresLoad.current = false;
      jugadorCountRef.current = jugadores.length;
      return;
    }
    if (phase === "lobby" && jugadores.length > jugadorCountRef.current) playJoinChime();
    jugadorCountRef.current = jugadores.length;
  }, [jugadores, phase]);

  function handleEntrado(id: string, codigo: string) {
    if (codigo !== sala.codigo) {
      try {
        localStorage.setItem(`ruleta_jugador_${codigo}`, JSON.stringify({ id }));
      } catch {
        // localStorage no disponible
      }
      window.location.href = "/ruleta";
      return;
    }

    setJugadorId(id);
    try {
      localStorage.setItem(`ruleta_jugador_${sala.codigo}`, JSON.stringify({ id }));
    } catch {
      // localStorage no disponible
    }
  }

  const [forceStarting, setForceStarting] = useState(false);
  const [forceStartError, setForceStartError] = useState<string | null>(null);

  async function handleForceStart() {
    if (!jugadorId) return;
    setForceStarting(true);
    setForceStartError(null);
    try {
      const res = await fetch(`/api/ruleta/${sala.codigo}/force-start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jugador_id: jugadorId }),
      });
      if (!res.ok) setForceStartError("No se pudo empezar — intenta de nuevo");
    } catch {
      setForceStartError("No se pudo empezar — intenta de nuevo");
    } finally {
      setForceStarting(false);
    }
  }

  async function handleSpin() {
    if (!jugadorId) return;
    await fetch(`/api/ruleta/${sala.codigo}/spin`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jugador_id: jugadorId }),
    });
  }

  async function handleGuess(letra: string) {
    if (!jugadorId) return;
    const isVowel = "AEIOU".includes(letra);
    await fetch(`/api/ruleta/${sala.codigo}/${isVowel ? "guess-vowel" : "guess-consonant"}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jugador_id: jugadorId, letra }),
    });
  }

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!jugadorId || !resolveText.trim()) return;
    await fetch(`/api/ruleta/${sala.codigo}/resolve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jugador_id: jugadorId, respuesta: resolveText.trim() }),
    });
    setResolveText("");
  }

  const handleTimeout = useCallback(async () => {
    await fetch(`/api/ruleta/${sala.codigo}/timeout`, { method: "POST" });
  }, [sala.codigo]);

  const [forcingSkip, setForcingSkip] = useState(false);
  async function handleForceSkip() {
    if (!jugadorId) return;
    setForcingSkip(true);
    await fetch(`/api/ruleta/${sala.codigo}/timeout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true, jugador_id: jugadorId }),
    });
    setForcingSkip(false);
  }

  function handleLeaveRoom() {
    try {
      localStorage.removeItem(`ruleta_jugador_${sala.codigo}`);
    } catch {
      // localStorage no disponible
    }
    // A /ruleta NO sirve como "salida": con cuenta obligatoria, el
    // servidor te vuelve a encontrar como jugador de esta misma sala y
    // caerías directo de regreso. /juegos sí es una salida real.
    router.push("/juegos");
  }

  async function handleInvitar() {
    const url = `${window.location.origin}/ruleta`;
    const shareData = { title: "La Ruleta — Elim LLDM", text: "Únete a jugar La Ruleta conmigo", url };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // canceló el share — no hacer nada más
      }
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard no disponible
    }
  }

  const handleNextRound = useCallback(async () => {
    setAdvancing(true);
    await fetch(`/api/ruleta/${sala.codigo}/next-round`, { method: "POST" });
    setAdvancing(false);
  }, [sala.codigo]);

  const misTurno = jugadorId !== null && round?.turnoJugadorId === jugadorId;
  const miPuntaje = jugadores.find((j) => j.id === jugadorId)?.puntos ?? 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-[480px] mx-auto flex-1 flex flex-col px-4 py-5 gap-4">
        <header className="flex items-center justify-between">
          <Link href="/ruleta" className="text-lg font-bold" style={{ color: "var(--color-primary)" }}>La Ruleta</Link>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-sm font-bold"
              style={{
                background: "rgba(212,160,23,0.1)",
                border: "1px solid rgba(212,160,23,0.25)",
                color: "var(--color-primary)",
              }}
            >
              <Sparkles size={13} />
              en vivo
            </div>
            <button
              type="button"
              onClick={handleLeaveRoom}
              title="Salir de la sala"
              aria-label="Salir de la sala"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "var(--color-destructive)" }}
            >
              <LogOut size={13} />
              Salir
            </button>
          </div>
        </header>

        {jugadorId && phase !== "finished" && (
          <RuletaVoiceChat codigo={sala.codigo} />
        )}

        {phase === "finished" ? (
          <MatchEndScreen jugadores={jugadores} meId={jugadorId} />
        ) : !jugadorId ? (
          <EntrarForm onEntrado={handleEntrado} />
        ) : phase === "lobby" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-primary)" }} />
            <p className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
              esperando más jugadores...
            </p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {jugadores.length} de {sala.jugadores_deseados} {sala.jugadores_deseados === 1 ? "jugador" : "jugadores"}
            </p>
            <button
              type="button"
              onClick={handleInvitar}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(37,211,102,0.1)", color: "#25D366", border: "1px solid rgba(37,211,102,0.25)" }}
            >
              <Share2 size={14} />
              Invitar
            </button>
            {jugadores.length >= MIN_PLAYERS && jugadores.length < sala.jugadores_deseados && (
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleForceStart}
                  disabled={forceStarting}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
                >
                  {forceStarting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Empezando…
                    </>
                  ) : (
                    `Empezar con ${jugadores.length}`
                  )}
                </button>
                {forceStartError && (
                  <p className="text-xs" style={{ color: "var(--color-destructive)" }}>{forceStartError}</p>
                )}
              </div>
            )}
          </div>
        ) : round && (phase === "playing" || phase === "ronda_fin") ? (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
                Ronda {round.ronda} de {round.totalRondas} — {round.categoria}
              </p>
              <TurnTimer endsAt={phase === "playing" ? round.turnoTerminaEn : null} onExpire={handleTimeout} />
            </div>

            {phase === "playing" && (
              <button
                type="button"
                onClick={handleForceSkip}
                disabled={forcingSkip}
                className="self-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
              >
                <SkipForward size={13} />
                {forcingSkip ? "Forzando..." : "Forzar siguiente turno"}
              </button>
            )}

            <p className="text-sm text-center" style={{ color: "var(--color-text)" }}>{round.mensaje}</p>

            {phase === "ronda_fin" ? (
              <RoundBanner
                frase={round.frase ?? ""}
                ganador={jugadores.find((j) => j.id === round.turnoJugadorId) ?? null}
                terminaEn={round.rondaFinTerminaEn}
                onExpire={handleNextRound}
              />
            ) : (
              <>
                <Wheel
                  spinToSegment={round.spinToSegment}
                  spinToken={spinToken}
                  onSpinClick={handleSpin}
                  canSpin={misTurno && !round.giroUsado}
                />
                <Board tiles={round.board} />
                <Letters
                  letrasProbadas={round.letrasProbadas}
                  canGuessConsonant={misTurno && round.puedeConsonante}
                  canAffordVowel={misTurno && miPuntaje >= VOWEL_COST}
                  disabled={!misTurno}
                  onGuess={handleGuess}
                />
                {misTurno && (
                  <form onSubmit={handleResolve} className="flex gap-2">
                    <input
                      value={resolveText}
                      onChange={(e) => setResolveText(e.target.value)}
                      placeholder="Resolver panel: escribe la frase completa"
                      className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                    />
                    <button
                      type="submit"
                      disabled={!resolveText.trim()}
                      className="px-4 py-2 rounded-xl text-sm font-bold"
                      style={{ background: "var(--color-primary)", color: "#000" }}
                    >
                      Resolver
                    </button>
                  </form>
                )}
              </>
            )}

            <Scoreboard jugadores={jugadores} turnoJugadorId={round.turnoJugadorId} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
