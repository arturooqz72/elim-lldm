"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Clock, Sparkles, Loader2, LogOut, Share2 } from "lucide-react";
import confetti from "canvas-confetti";
import { createClient } from "@/lib/supabase/client";
import { AnswerButtons } from "@/components/arena/AnswerButtons";
import { Leaderboard } from "@/components/arena/Leaderboard";
import { CountdownCircle } from "@/components/arena/CountdownCircle";
import { EntrarForm } from "./EntrarForm";
import { ArenaPublicaVoiceChat } from "./ArenaPublicaVoiceChat";
import {
  COUNTDOWN_SECONDS,
  ROUND_SECONDS,
  REVEAL_SECONDS,
  MIN_JUGADORES_PARA_INICIAR,
} from "@/lib/arena-publica/config";
import type { ArenaJugador, AnswerOption } from "@/types";

type ArenaPublicaPhase = "lobby" | "counting" | "playing" | "reveal" | "finished";

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

interface ArenaPublicaRoomProps {
  salaId: string;
  status: ArenaPublicaPhase;
  preguntaActual: number;
  jugadoresDeseados: number;
  cuentaTerminaEn: number | null;
  preguntaTerminaEn: number | null;
  revealTerminaEn: number | null;
  preguntas: PreguntaPublica[];
  jugadoresIniciales: ArenaJugador[];
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

export function ArenaPublicaRoom({
  salaId,
  status,
  preguntaActual,
  jugadoresDeseados,
  cuentaTerminaEn,
  preguntaTerminaEn,
  revealTerminaEn,
  preguntas,
  jugadoresIniciales,
}: ArenaPublicaRoomProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<ArenaPublicaPhase>(status);
  const [jugadores, setJugadores] = useState<ArenaJugador[]>(jugadoresIniciales);
  const [jugadorId, setJugadorId] = useState<string | null>(null);
  const [countdownEndsAt, setCountdownEndsAt] = useState<number | null>(cuentaTerminaEn);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionStartPayload | null>(() => {
    if (status !== "playing" && status !== "reveal") return null;
    const p = preguntas.find((pr) => pr.orden === preguntaActual);
    if (!p) return null;
    const endsAt = preguntaTerminaEn ?? Date.now() + ROUND_SECONDS * 1000;
    return preguntaToPayload(p, preguntas.length, endsAt);
  });
  const [revealEndsAt, setRevealEndsAt] = useState<number | null>(revealTerminaEn);
  const [selected, setSelected] = useState<AnswerOption | null>(null);
  const [correct, setCorrect] = useState<AnswerOption | null>(null);
  const [answering, setAnswering] = useState(false);
  const [forceStarting, setForceStarting] = useState(false);
  const [forceStartError, setForceStartError] = useState<string | null>(null);
  const answerSentRef = useRef(false);

  // Restaurar identidad del jugador (sin cuenta) desde localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`arena_publica_jugador_${salaId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as { id: string };
        setJugadorId(parsed.id);
      }
    } catch {
      // localStorage no disponible
    }
  }, [salaId]);

  const handleAdvance = useCallback(() => {
    fetch("/api/arena-publica/advance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sala_id: salaId }),
    }).catch(() => {
      // best-effort: cualquier otro cliente puede disparar el siguiente advance
    });
  }, [salaId]);

  const handleForceStart = useCallback(async () => {
    if (!jugadorId) return;
    setForceStarting(true);
    setForceStartError(null);
    try {
      const res = await fetch("/api/arena-publica/force-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sala_id: salaId, jugador_id: jugadorId }),
      });
      if (!res.ok) {
        setForceStartError("No se pudo empezar — intenta de nuevo");
      }
    } catch {
      setForceStartError("No se pudo empezar — intenta de nuevo");
    } finally {
      setForceStarting(false);
    }
  }, [salaId, jugadorId]);

  function handleLeaveRoom() {
    // A /arena-abierta NO sirve como "salida": con cuenta obligatoria, el
    // servidor te vuelve a encontrar como jugador de esta misma sala y
    // caerías directo de regreso. /juegos sí es una salida real.
    router.push("/juegos");
  }

  async function handleInvitar() {
    const url = `${window.location.origin}/arena-abierta`;
    const shareData = { title: "Trivia en línea — Elim LLDM", text: "Únete a jugar trivia bíblica conmigo", url };

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

  // Suscripciones realtime: broadcast de fases + lista de jugadores en vivo
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`arena-publica:${salaId}`)
      .on("broadcast", { event: "*" }, (msg) => {
        const { event, payload } = msg as unknown as {
          event: string;
          payload: Record<string, unknown>;
        };

        if (event === "COUNTDOWN_START") {
          const p = payload as unknown as { cuentaTerminaEn: number };
          setCountdownEndsAt(p.cuentaTerminaEn);
          setPhase("counting");
        }

        if (event === "QUESTION_START") {
          const p = payload as unknown as QuestionStartPayload;
          setCurrentQuestion(p);
          setSelected(null);
          setCorrect(null);
          setPhase("playing");
          answerSentRef.current = false;
        }

        if (event === "REVEAL_START") {
          const p = payload as unknown as {
            pregunta_id: string;
            respuesta_correcta: AnswerOption;
            revealTerminaEn: number;
          };
          setCorrect(p.respuesta_correcta);
          setRevealEndsAt(p.revealTerminaEn);
          setPhase("reveal");
        }

        if (event === "GAME_FINISHED") {
          setPhase("finished");
        }
      });

    const jugadoresChannel = supabase
      .channel(`arena-publica-jugadores:${salaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "arena_publica_jugadores",
          filter: `sala_id=eq.${salaId}`,
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
  }, [salaId]);

  // Autocorrección al montar: si el deadline de la fase activa ya pasó
  // (pestaña que estuvo en segundo plano, o carga tardía), dispara un
  // /advance de inmediato en vez de esperar a que venza el CountdownCircle.
  // Solo debe correr una vez al montar — de ahí el array de deps vacío.
  useEffect(() => {
    const now = Date.now();
    let deadline: number | null = null;
    if (status === "counting") deadline = cuentaTerminaEn;
    else if (status === "playing") deadline = preguntaTerminaEn;
    else if (status === "reveal") deadline = revealTerminaEn;

    if (deadline !== null && deadline <= now) {
      handleAdvance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleEntrado(id: string, sid: string) {
    if (sid !== salaId) {
      // La sala para la que se renderizó esta página terminó entre la carga
      // y el envío del formulario, y el API de join creó/usó una sala nueva
      // (sid) vía getOrCreateOpenRoom(). Este componente nunca recibió el
      // snapshot inicial (preguntas, jugadores, fase, deadlines) de esa
      // sala nueva, así que no hay forma limpia de "cambiar de sala" en
      // memoria. Persistimos bajo la clave correcta y forzamos una
      // navegación dura para obtener un Server Component fresco — mismo
      // patrón que "Jugar otra ronda" en FinishedScreen, y por la misma
      // razón: forzar un getOrCreateOpenRoom() fresco en el servidor.
      try {
        localStorage.setItem(`arena_publica_jugador_${sid}`, JSON.stringify({ id }));
      } catch {
        // localStorage no disponible
      }
      window.location.href = "/arena-abierta";
      return;
    }

    setJugadorId(id);
    try {
      localStorage.setItem(`arena_publica_jugador_${salaId}`, JSON.stringify({ id }));
    } catch {
      // localStorage no disponible
    }
  }

  async function handleAnswer(option: AnswerOption) {
    if (!jugadorId || !currentQuestion || answerSentRef.current) return;
    answerSentRef.current = true;
    setAnswering(true);
    setSelected(option);

    const tiempoMs = Math.max(0, Date.now() - (currentQuestion.endsAt - ROUND_SECONDS * 1000));

    await fetch("/api/arena-publica/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sala_id: salaId,
        jugador_id: jugadorId,
        pregunta_id: currentQuestion.pregunta_id,
        respuesta: option,
        tiempo_ms: tiempoMs,
      }),
    });

    setAnswering(false);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-[430px] mx-auto flex-1 flex flex-col px-4 py-5 gap-4">
        <header className="flex items-center justify-between">
          <span
            className="text-lg font-bold"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--color-primary)" }}
          >
            Trivia en línea
          </span>
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
          <ArenaPublicaVoiceChat salaId={salaId} jugadorId={jugadorId} />
        )}

        {!jugadorId ? (
          <EntrarForm onEntrado={handleEntrado} />
        ) : phase === "finished" ? (
          <FinishedScreen jugadores={jugadores} meId={jugadorId} />
        ) : phase === "lobby" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <Clock size={36} style={{ color: "var(--color-primary)" }} />
            <p className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
              esperando más jugadores...
            </p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {jugadores.length} de {jugadoresDeseados} {jugadoresDeseados === 1 ? "jugador" : "jugadores"}
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
            {jugadores.length >= MIN_JUGADORES_PARA_INICIAR && jugadores.length < jugadoresDeseados && (
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
                  <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
                    {forceStartError}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : phase === "counting" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <p className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
              ¡ya somos {jugadores.length}! arrancando...
            </p>
            {countdownEndsAt !== null && (
              <CountdownCircle
                endsAt={countdownEndsAt}
                totalSeconds={COUNTDOWN_SECONDS}
                onExpire={handleAdvance}
              />
            )}
          </div>
        ) : currentQuestion ? (
          <div className="flex-1 flex flex-col gap-4">
            <QuestionHeader
              pregunta={currentQuestion}
              phase={phase}
              revealEndsAt={revealEndsAt}
              onExpire={handleAdvance}
            />
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
  revealEndsAt,
  onExpire,
}: {
  pregunta: QuestionStartPayload;
  phase: ArenaPublicaPhase;
  revealEndsAt: number | null;
  onExpire: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
        Pregunta {pregunta.orden} de {pregunta.total}
      </p>
      {phase === "playing" && (
        <CountdownCircle endsAt={pregunta.endsAt} totalSeconds={ROUND_SECONDS} onExpire={onExpire} />
      )}
      {phase === "reveal" && revealEndsAt !== null && (
        <CountdownCircle endsAt={revealEndsAt} totalSeconds={REVEAL_SECONDS} onExpire={onExpire} />
      )}
      <h2 className="text-2xl font-bold leading-snug" style={{ color: "var(--color-text)" }}>
        {pregunta.pregunta}
      </h2>
    </div>
  );
}

function FinishedScreen({ jugadores, meId }: { jugadores: ArenaJugador[]; meId: string | null }) {
  const sorted = [...jugadores].sort((a, b) => b.puntos - a.puntos);
  const winner = sorted[0];

  useEffect(() => {
    const duration = 2500;
    const end = Date.now() + duration;
    const colors = ["#D4A017", "#EDB84A", "#FFFFFF"];
    let frameId: number;

    function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
      if (Date.now() < end) frameId = requestAnimationFrame(frame);
    }

    frame();
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center gap-6 py-8">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center"
        style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}
      >
        <Trophy size={40} style={{ color: "var(--color-primary)" }} />
      </div>

      <div className="text-center flex flex-col gap-2">
        <p
          className="text-sm font-semibold uppercase"
          style={{ color: "var(--color-text-muted)", letterSpacing: "0.1em" }}
        >
          ¡Partida terminada!
        </p>
        {winner ? (
          <h1 className="text-3xl font-extrabold" style={{ color: "var(--color-primary)" }}>
            {winner.nombre}
          </h1>
        ) : (
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
            Sin jugadores
          </h1>
        )}
        {winner && (
          <p className="text-base" style={{ color: "var(--color-text-muted)" }}>
            con{" "}
            <span className="font-bold" style={{ color: "var(--color-text)" }}>
              {winner.puntos.toLocaleString()} pts
            </span>
          </p>
        )}
      </div>

      <div className="w-full">
        <Leaderboard jugadores={jugadores} meId={meId} />
      </div>

      <a
        href="/arena-abierta"
        className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      >
        Jugar otra ronda
      </a>
    </div>
  );
}
