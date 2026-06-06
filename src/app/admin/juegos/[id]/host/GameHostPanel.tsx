"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Play, SkipForward, StopCircle, Users, Hash, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Scoreboard } from "@/components/juegos/Scoreboard";

interface Team {
  id: string;
  name: string;
  color: string;
  score: number;
}

interface Player {
  id: string;
  user_id: string;
  team_id: string | null;
  score: number;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

interface Question {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  time_limit_seconds: number;
  points: number;
}

interface GameHostPanelProps {
  game: {
    id: string;
    title: string;
    status: string;
    join_code: string;
    current_question_index: number;
    question_set_id: string;
  };
  initialTeams: Team[];
  initialPlayers: Player[];
  questions: Question[];
}

export function GameHostPanel({
  game,
  initialTeams,
  initialPlayers,
  questions,
}: GameHostPanelProps) {
  const [status, setStatus] = useState(game.status);
  const [questionIndex, setQuestionIndex] = useState(game.current_question_index);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [loading, setLoading] = useState<string | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    // Listen for player joins
    const ch = supabase
      .channel(`host-players:${game.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${game.id}` },
        async (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const { data } = await supabase
              .from("game_players")
              .select("id, user_id, team_id, score, profiles(display_name, avatar_url)")
              .eq("id", payload.new.id)
              .single();
            if (data) {
              setPlayers((prev) => {
                const exists = prev.find((p) => p.id === data.id);
                if (exists) return prev.map((p) => (p.id === data.id ? (data as unknown as Player) : p));
                return [...prev, data as unknown as Player];
              });
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_answers", filter: `game_id=eq.${game.id}` },
        () => setAnsweredCount((n) => n + 1)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_teams", filter: `game_id=eq.${game.id}` },
        (payload) => {
          setTeams((prev) =>
            prev.map((t) => (t.id === payload.new.id ? { ...t, score: payload.new.score } : t))
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [game.id]);

  async function startGame() {
    setLoading("start");
    const res = await fetch(`/api/games/${game.id}/start`, { method: "POST" });
    if (res.ok) {
      setStatus("in_progress");
      setQuestionIndex(0);
      setAnsweredCount(0);
    }
    setLoading(null);
  }

  async function nextQuestion() {
    setLoading("next");
    const res = await fetch(`/api/games/${game.id}/next-question`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setQuestionIndex(data.questionIndex);
      setAnsweredCount(0);
    }
    setLoading(null);
  }

  async function finishGame() {
    if (!confirm("¿Terminar la partida?")) return;
    setLoading("finish");
    const res = await fetch(`/api/games/${game.id}/finish`, { method: "POST" });
    if (res.ok) setStatus("finished");
    setLoading(null);
  }

  const currentQuestion = questions[questionIndex];
  const totalPlayers = players.length;
  const isLastQuestion = questionIndex >= questions.length - 1;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/juegos"
            className="flex items-center gap-1.5 text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            <ArrowLeft size={15} />
          </Link>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
              {game.title}
            </h1>
            <p className="text-sm flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
              <Hash size={12} />
              {game.join_code}
              <span>·</span>
              <Users size={12} />
              {totalPlayers} jugadores
            </p>
          </div>
        </div>
        <span
          className="px-3 py-1 rounded-full text-xs font-bold"
          style={{
            background:
              status === "lobby"
                ? "rgba(212,160,23,0.15)"
                : status === "in_progress"
                ? "rgba(74,222,128,0.15)"
                : "var(--color-surface-elevated)",
            color:
              status === "lobby"
                ? "var(--color-primary)"
                : status === "in_progress"
                ? "var(--color-success)"
                : "var(--color-text-muted)",
          }}
        >
          {status === "lobby" ? "Sala de espera" : status === "in_progress" ? "En curso" : "Terminado"}
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Control panel */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Controls */}
          <div
            className="rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              Control de partida
            </p>

            {status === "lobby" && (
              <button
                onClick={startGame}
                disabled={loading === "start" || totalPlayers === 0}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm"
                style={{ background: "var(--color-primary)", color: "#000" }}
              >
                {loading === "start" ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                Iniciar partida ({totalPlayers} jugadores)
              </button>
            )}

            {status === "in_progress" && (
              <>
                <div
                  className="rounded-xl p-4"
                  style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold" style={{ color: "var(--color-primary)" }}>
                      Pregunta {questionIndex + 1} de {questions.length}
                    </p>
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {answeredCount}/{totalPlayers} respondieron
                    </span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                    {currentQuestion?.question_text}
                  </p>
                  <p className="text-xs mt-2" style={{ color: "var(--color-success)" }}>
                    Correcta: {currentQuestion?.correct_option.toUpperCase()} — {currentQuestion?.[`option_${currentQuestion.correct_option}` as keyof Question] as string}
                  </p>
                </div>

                {/* Progress bar */}
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "var(--color-surface-elevated)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: totalPlayers > 0 ? `${(answeredCount / totalPlayers) * 100}%` : "0%",
                      background: "var(--color-success)",
                    }}
                  />
                </div>

                <div className="flex gap-3">
                  {!isLastQuestion ? (
                    <button
                      onClick={nextQuestion}
                      disabled={loading === "next"}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm"
                      style={{ background: "var(--color-primary)", color: "#000" }}
                    >
                      {loading === "next" ? <Loader2 size={16} className="animate-spin" /> : <SkipForward size={16} />}
                      Siguiente pregunta
                    </button>
                  ) : (
                    <button
                      onClick={finishGame}
                      disabled={loading === "finish"}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm"
                      style={{
                        background: "rgba(74,222,128,0.15)",
                        border: "1px solid rgba(74,222,128,0.3)",
                        color: "var(--color-success)",
                      }}
                    >
                      {loading === "finish" ? <Loader2 size={16} className="animate-spin" /> : <StopCircle size={16} />}
                      Terminar partida
                    </button>
                  )}
                  <button
                    onClick={finishGame}
                    disabled={loading === "finish"}
                    className="px-4 py-3 rounded-xl text-sm"
                    style={{
                      background: "rgba(248,113,113,0.1)",
                      color: "var(--color-destructive)",
                      border: "1px solid rgba(248,113,113,0.2)",
                    }}
                    title="Terminar inmediatamente"
                  >
                    <StopCircle size={16} />
                  </button>
                </div>
              </>
            )}

            {status === "finished" && (
              <div
                className="text-center py-4 rounded-xl"
                style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}
              >
                <p className="font-semibold" style={{ color: "var(--color-success)" }}>
                  Partida terminada
                </p>
              </div>
            )}
          </div>

          {/* Questions list */}
          {status !== "lobby" && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div
                className="px-5 py-3 text-sm font-semibold"
                style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                Preguntas
              </div>
              <div className="p-3 flex flex-col gap-1">
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="flex items-start gap-3 px-3 py-2 rounded-lg"
                    style={{
                      background:
                        idx === questionIndex && status === "in_progress"
                          ? "rgba(212,160,23,0.08)"
                          : "transparent",
                      border: `1px solid ${idx === questionIndex && status === "in_progress" ? "rgba(212,160,23,0.2)" : "transparent"}`,
                    }}
                  >
                    <span
                      className="text-xs font-bold mt-0.5 shrink-0"
                      style={{
                        color:
                          idx < questionIndex
                            ? "var(--color-text-muted)"
                            : idx === questionIndex
                            ? "var(--color-primary)"
                            : "var(--color-text-muted)",
                      }}
                    >
                      {idx + 1}
                    </span>
                    <p
                      className="text-sm line-clamp-1"
                      style={{
                        color: idx <= questionIndex ? "var(--color-text)" : "var(--color-text-muted)",
                      }}
                    >
                      {q.question_text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: scoreboard */}
        <div className="flex flex-col gap-4">
          <Scoreboard
            teams={teams}
            players={players}
            currentUserId=""
            isFinal={status === "finished"}
          />
        </div>
      </div>
    </div>
  );
}
