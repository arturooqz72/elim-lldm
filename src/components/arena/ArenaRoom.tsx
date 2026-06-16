"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Hash, ArrowRight, Loader2, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ArenaJugador, ArenaSala, AnswerOption } from "@/types";
import { JoinForm } from "./JoinForm";
import { HostLobby } from "./HostLobby";
import { CountdownCircle } from "./CountdownCircle";
import { AnswerButtons } from "./AnswerButtons";
import { Leaderboard } from "./Leaderboard";
import { WinnerScreen } from "./WinnerScreen";

const ROUND_SECONDS = 15;

type ArenaPhase = "lobby" | "question" | "reveal" | "finished";

interface PreguntaPublica {
  id: string;
  pregunta: string;
  opcion_a: string;
  opcion_b: string;
  opcion_c: string;
  opcion_d: string;
  orden: number;
}

interface QuestionStartPayload {
  pregunta_id: string;
  pregunta: string;
  opciones: { a: string; b: string; c: string; d: string };
  orden: number;
  total: number;
  endsAt: number;
}

interface ArenaRoomProps {
  sala: ArenaSala;
  preguntas: PreguntaPublica[];
  jugadoresIniciales: ArenaJugador[];
  isHost: boolean;
}

function preguntaToPayload(p: PreguntaPublica, total: number, endsAt: number): QuestionStartPayload {
  return {
    pregunta_id: p.id,
    pregunta: p.pregunta,
    opciones: { a: p.opcion_a, b: p.opcion_b, c: p.opcion_c, d: p.opcion_d },
    orden: p.orden,
    total,
    endsAt,
  };
}

export function ArenaRoom({ sala, preguntas, jugadoresIniciales, isHost }: ArenaRoomProps) {
  const [phase, setPhase] = useState<ArenaPhase>(() => {
    if (sala.status === "finished") return "finished";
    if (sala.status === "playing" || sala.status === "reveal") return "question";
    return "lobby";
  });
  const [jugadores, setJugadores] = useState<ArenaJugador[]>(jugadoresIniciales);
  const [jugadorId, setJugadorId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionStartPayload | null>(() => {
    if (sala.status !== "playing" && sala.status !== "reveal") return null;
    const p = preguntas.find((pr) => pr.orden === sala.pregunta_actual);
    if (!p) return null;
    const endsAt = sala.pregunta_termina_en
      ? new Date(sala.pregunta_termina_en).getTime()
      : Date.now() + ROUND_SECONDS * 1000;
    return preguntaToPayload(p, preguntas.length, endsAt);
  });
  const [selected, setSelected] = useState<AnswerOption | null>(null);
  const [correct, setCorrect] = useState<AnswerOption | null>(null);
  const [answering, setAnswering] = useState(false);
  const [starting, setStarting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const answerSentRef = useRef(false);

  // Restaurar identidad del jugador (sin cuenta) desde localStorage
  useEffect(() => {
    if (isHost) return;
    try {
      const stored = localStorage.getItem(`arena_jugador_${sala.codigo}`);
      if (stored) {
        const parsed = JSON.parse(stored) as { id: string };
        setJugadorId(parsed.id);
      }
    } catch {
      // localStorage no disponible
    }
  }, [isHost, sala.codigo]);

  // Suscripciones realtime: broadcast de rondas + lista de jugadores en vivo
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`arena:${sala.codigo}`)
      .on("broadcast", { event: "*" }, (msg) => {
        const { event, payload } = msg as unknown as {
          event: string;
          payload: Record<string, unknown>;
        };

        if (event === "QUESTION_START") {
          const p = payload as unknown as QuestionStartPayload;
          setCurrentQuestion(p);
          setSelected(null);
          setCorrect(null);
          setPhase("question");
          answerSentRef.current = false;
        }

        if (event === "GAME_FINISHED") {
          setPhase("finished");
        }
      });

    const jugadoresChannel = supabase
      .channel(`arena-jugadores:${sala.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "elim_arena_jugadores",
          filter: `sala_id=eq.${sala.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const nuevo = payload.new as ArenaJugador;
            setJugadores((prev) => (prev.some((j) => j.id === nuevo.id) ? prev : [...prev, nuevo]));
          } else if (payload.eventType === "UPDATE") {
            const actualizado = payload.new as ArenaJugador;
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

  function handleJoined(id: string, nombre: string) {
    setJugadorId(id);
    try {
      localStorage.setItem(`arena_jugador_${sala.codigo}`, JSON.stringify({ id, nombre }));
    } catch {
      // localStorage no disponible
    }
  }

  async function handleExpire() {
    if (phase !== "question" || !currentQuestion) return;
    setPhase("reveal");
    const supabase = createClient();
    const { data } = await supabase
      .from("elim_arena_preguntas")
      .select("respuesta_correcta")
      .eq("id", currentQuestion.pregunta_id)
      .single();
    if (data) setCorrect(data.respuesta_correcta as AnswerOption);
  }

  async function handleAnswer(option: AnswerOption) {
    if (!jugadorId || !currentQuestion || answerSentRef.current) return;
    answerSentRef.current = true;
    setAnswering(true);
    setSelected(option);

    const tiempoMs = Math.max(0, Date.now() - (currentQuestion.endsAt - ROUND_SECONDS * 1000));

    await fetch(`/api/arena/${sala.codigo}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jugador_id: jugadorId,
        pregunta_id: currentQuestion.pregunta_id,
        respuesta: option,
        tiempo_ms: tiempoMs,
      }),
    });

    setAnswering(false);
  }

  async function handleStart() {
    setStarting(true);
    await fetch(`/api/arena/${sala.codigo}/start`, { method: "POST" });
    setStarting(false);
  }

  async function handleNext() {
    setAdvancing(true);
    await fetch(`/api/arena/${sala.codigo}/next`, { method: "POST" });
    setAdvancing(false);
  }

  const isLast = currentQuestion?.orden === currentQuestion?.total;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-[430px] mx-auto flex-1 flex flex-col px-4 py-5 gap-4">
        <header className="flex items-center justify-between">
          <Link
            href="/arena"
            className="text-lg font-bold"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--color-primary)" }}
          >
            Elim Arena
          </Link>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-sm font-bold"
            style={{
              background: "rgba(212,160,23,0.1)",
              border: "1px solid rgba(212,160,23,0.25)",
              color: "var(--color-primary)",
            }}
          >
            <Hash size={13} />
            {sala.codigo}
          </div>
        </header>

        {phase === "finished" ? (
          <WinnerScreen jugadores={jugadores} meId={jugadorId} />
        ) : isHost ? (
          phase === "lobby" ? (
            <HostLobby
              codigo={sala.codigo}
              titulo={sala.titulo}
              jugadores={jugadores}
              onStart={handleStart}
              starting={starting}
            />
          ) : currentQuestion ? (
            <div className="flex-1 flex flex-col gap-4">
              <QuestionHeader pregunta={currentQuestion} phase={phase} onExpire={handleExpire} />
              <AnswerButtons
                opciones={currentQuestion.opciones}
                selected={null}
                correct={correct}
                disabled
                loading={false}
                onAnswer={() => {}}
              />
              <Leaderboard jugadores={jugadores} />
              {phase === "reveal" && (
                <button
                  onClick={handleNext}
                  disabled={advancing}
                  className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-lg font-bold transition-all duration-200"
                  style={{
                    background: advancing ? "var(--color-surface-elevated)" : "var(--color-primary)",
                    color: advancing ? "var(--color-text-muted)" : "#000",
                  }}
                >
                  {advancing ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      {isLast ? "Ver resultados finales" : "Siguiente pregunta"}
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              )}
            </div>
          ) : null
        ) : !jugadorId ? (
          <JoinForm codigo={sala.codigo} titulo={sala.titulo} onJoined={handleJoined} />
        ) : phase === "lobby" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <Clock size={36} style={{ color: "var(--color-primary)" }} />
            <p className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
              Esperando que inicie el juego...
            </p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {jugadores.length} {jugadores.length === 1 ? "jugador" : "jugadores"} en la sala
            </p>
          </div>
        ) : currentQuestion ? (
          <div className="flex-1 flex flex-col gap-4">
            <QuestionHeader pregunta={currentQuestion} phase={phase} onExpire={handleExpire} />
            <AnswerButtons
              opciones={currentQuestion.opciones}
              selected={selected}
              correct={correct}
              disabled={phase === "reveal"}
              loading={answering}
              onAnswer={handleAnswer}
            />
            {phase === "reveal" && <Leaderboard jugadores={jugadores} meId={jugadorId} />}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function QuestionHeader({
  pregunta,
  phase,
  onExpire,
}: {
  pregunta: QuestionStartPayload;
  phase: ArenaPhase;
  onExpire: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
        Pregunta {pregunta.orden} de {pregunta.total}
      </p>
      {phase === "question" && (
        <CountdownCircle endsAt={pregunta.endsAt} totalSeconds={ROUND_SECONDS} onExpire={onExpire} />
      )}
      <h2 className="text-2xl font-bold leading-snug" style={{ color: "var(--color-text)" }}>
        {pregunta.pregunta}
      </h2>
    </div>
  );
}
