"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GameLobby } from "./GameLobby";
import { QuestionCard } from "./QuestionCard";
import { AnswerOptions } from "./AnswerOptions";
import { Scoreboard } from "./Scoreboard";
import { ArrowLeft, Hash, CheckCircle2, XCircle, Clock } from "lucide-react";
import Link from "next/link";

type AnswerOption = "a" | "b" | "c" | "d";
type GamePhase = "lobby" | "question" | "reveal" | "finished";

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
  correct_option: AnswerOption;
  bible_reference: string | null;
  time_limit_seconds: number;
  points: number;
}

interface GameRoomProps {
  gameId: string;
  title: string;
  joinCode: string;
  initialStatus: string;
  initialQuestionIndex: number;
  initialTeams: Team[];
  initialPlayers: Player[];
  questions: Question[];
  currentUserId: string;
}

export function GameRoom({
  gameId,
  title,
  joinCode,
  initialStatus,
  initialQuestionIndex,
  initialTeams,
  initialPlayers,
  questions,
  currentUserId,
}: GameRoomProps) {
  const [phase, setPhase] = useState<GamePhase>(
    initialStatus === "in_progress"
      ? "question"
      : initialStatus === "finished"
      ? "finished"
      : "lobby"
  );
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    initialPlayers.find((p) => p.user_id === currentUserId)?.team_id ?? null
  );
  const [questionIndex, setQuestionIndex] = useState(initialQuestionIndex);
  // When joining mid-game, endsAt is unknown — set to 0 so the timer shows expired
  // until the next QUESTION_START broadcast arrives.
  const [endsAt, setEndsAt] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerOption | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<AnswerOption | null>(null);
  const [loadingAnswer, setLoadingAnswer] = useState<AnswerOption | null>(null);
  const answerSentRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`game:${gameId}`)
      .on("broadcast", { event: "*" }, (msg) => {
        const { event, payload } = msg as unknown as {
          event: string;
          payload: Record<string, unknown>;
        };

        if (event === "GAME_STARTED") {
          setPhase("question");
          setQuestionIndex(0);
          setEndsAt(payload.endsAt as number);
          setSelectedAnswer(null);
          setCorrectAnswer(null);
          answerSentRef.current = false;
        }

        if (event === "QUESTION_START") {
          setQuestionIndex(payload.questionIndex as number);
          setEndsAt(payload.endsAt as number);
          setSelectedAnswer(null);
          setCorrectAnswer(null);
          setPhase("question");
          answerSentRef.current = false;
        }

        if (event === "QUESTION_END") {
          setCorrectAnswer(payload.correctOption as AnswerOption);
          setPhase("reveal");
        }

        if (event === "SCORES_UPDATE") {
          const teamScores = payload.teams as Array<{ id: string; score: number }>;
          const playerScores = payload.players as Array<{ id: string; score: number }>;
          setTeams((prev) =>
            prev.map((t) => {
              const u = teamScores?.find((s) => s.id === t.id);
              return u ? { ...t, score: u.score } : t;
            })
          );
          setPlayers((prev) =>
            prev.map((p) => {
              const u = playerScores?.find((s) => s.id === p.id);
              return u ? { ...p, score: u.score } : p;
            })
          );
        }

        if (event === "GAME_FINISHED") {
          setPhase("finished");
          if (payload.teams) {
            const teamScores = payload.teams as Array<{ id: string; score: number }>;
            setTeams((prev) =>
              prev.map((t) => {
                const u = teamScores.find((s) => s.id === t.id);
                return u ? { ...t, score: u.score } : t;
              })
            );
          }
        }
      });

    const playersChannel = supabase
      .channel(`game-players:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_players",
          filter: `game_id=eq.${gameId}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const { data } = await supabase
              .from("game_players")
              .select("*, profiles(display_name, avatar_url)")
              .eq("id", payload.new.id)
              .single();
            if (data) {
              const updated = data as Player;
              setPlayers((prev) => {
                const exists = prev.find((p) => p.id === updated.id);
                if (exists) return prev.map((p) => (p.id === updated.id ? updated : p));
                return [...prev, updated];
              });
              if (updated.user_id === currentUserId) {
                setSelectedTeamId(updated.team_id);
              }
            }
          }
        }
      )
      .subscribe();

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(playersChannel);
    };
  }, [gameId, currentUserId]);

  async function submitAnswer(option: AnswerOption) {
    if (answerSentRef.current) return;
    answerSentRef.current = true;
    setLoadingAnswer(option);

    const q = questions[questionIndex];
    const timeTaken = Math.round(Date.now() - (endsAt - q.time_limit_seconds * 1000));

    const res = await fetch(`/api/games/${gameId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: q.id,
        selectedOption: option,
        timeTakenMs: Math.max(0, timeTaken),
      }),
    });

    setLoadingAnswer(null);
    setSelectedAnswer(option);

    if (res.ok) {
      const data = await res.json();
      if (data.correctOption) {
        setCorrectAnswer(data.correctOption);
        setPhase("reveal");
      }
    }
  }

  const currentQuestion = questions[questionIndex];

  const badgeConfig: Record<
    GamePhase,
    { label: string; bg: string; border: string; color: string }
  > = {
    lobby: {
      label: "SALA DE ESPERA",
      bg: "rgba(212,160,23,0.1)",
      border: "rgba(212,160,23,0.25)",
      color: "var(--color-primary)",
    },
    question: {
      label: "EN CURSO",
      bg: "rgba(74,222,128,0.1)",
      border: "rgba(74,222,128,0.3)",
      color: "var(--color-success)",
    },
    reveal: {
      label: "EN CURSO",
      bg: "rgba(74,222,128,0.1)",
      border: "rgba(74,222,128,0.3)",
      color: "var(--color-success)",
    },
    finished: {
      label: "TERMINADA",
      bg: "var(--color-surface-elevated)",
      border: "var(--color-border)",
      color: "var(--color-text-muted)",
    },
  };
  const badge = badgeConfig[phase];

  return (
    <>
      <style>{`
        .game-back:hover { color: var(--color-primary) !important; }
      `}</style>

      {/* Game header bar */}
      <div
        className="px-4 py-3"
        style={{
          borderBottom: "1px solid var(--color-border)",
          background: "rgba(10,10,18,0.95)",
        }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link
            href="/juegos"
            className="game-back flex items-center gap-1.5 text-sm shrink-0 transition-colors"
            style={{ color: "var(--color-text-muted)" }}
          >
            <ArrowLeft size={14} />
            Juegos
          </Link>

          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0"
            style={{
              background: badge.bg,
              border: `1px solid ${badge.border}`,
              color: badge.color,
            }}
          >
            {badge.label}
          </span>

          <span
            className="flex-1 font-semibold text-sm truncate"
            style={{ color: "var(--color-text)" }}
          >
            {title}
          </span>

          <div
            className="flex items-center gap-1 font-mono text-sm font-bold shrink-0"
            style={{ color: "var(--color-primary)" }}
          >
            <Hash size={12} />
            {joinCode}
          </div>
        </div>
      </div>

      {/* Phase content */}
      <div className="px-4 py-6">
        {phase === "lobby" ? (
          <GameLobby
            gameId={gameId}
            teams={teams}
            players={players}
            currentUserId={currentUserId}
            selectedTeamId={selectedTeamId}
            onTeamSelect={setSelectedTeamId}
          />
        ) : phase === "finished" ? (
          <div className="max-w-2xl mx-auto flex flex-col gap-6">
            <Scoreboard teams={teams} players={players} currentUserId={currentUserId} isFinal />
            <div className="flex justify-center">
              <Link
                href="/juegos"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              >
                <ArrowLeft size={14} />
                Ver otras partidas
              </Link>
            </div>
          </div>
        ) : currentQuestion ? (
          <div className="max-w-2xl mx-auto flex flex-col gap-4">
            <QuestionCard
              questionText={currentQuestion.question_text}
              bibleReference={currentQuestion.bible_reference}
              timeLimit={currentQuestion.time_limit_seconds}
              endsAt={endsAt}
              questionNumber={questionIndex + 1}
              totalQuestions={questions.length}
              points={currentQuestion.points}
            />

            <AnswerOptions
              options={{
                a: currentQuestion.option_a,
                b: currentQuestion.option_b,
                c: currentQuestion.option_c,
                d: currentQuestion.option_d,
              }}
              selected={selectedAnswer}
              correct={correctAnswer}
              disabled={phase === "reveal"}
              loading={loadingAnswer}
              onAnswer={submitAnswer}
            />

            {phase === "reveal" && (
              <RevealBanner
                isCorrect={selectedAnswer !== null && selectedAnswer === correctAnswer}
                noAnswer={selectedAnswer === null}
              />
            )}

            <Scoreboard teams={teams} players={players} currentUserId={currentUserId} />
          </div>
        ) : null}
      </div>
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function RevealBanner({
  isCorrect,
  noAnswer,
}: {
  isCorrect: boolean;
  noAnswer: boolean;
}) {
  if (noAnswer) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <Clock size={18} style={{ color: "var(--color-text-muted)" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Tiempo agotado
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Esperando la siguiente pregunta…
          </p>
        </div>
      </div>
    );
  }

  if (isCorrect) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
        style={{
          background: "rgba(74,222,128,0.1)",
          border: "1px solid rgba(74,222,128,0.3)",
        }}
      >
        <CheckCircle2 size={18} style={{ color: "var(--color-success)" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-success)" }}>
            ¡Respuesta correcta!
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Esperando la siguiente pregunta…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
      style={{
        background: "rgba(248,113,113,0.1)",
        border: "1px solid rgba(248,113,113,0.3)",
      }}
    >
      <XCircle size={18} style={{ color: "var(--color-destructive)" }} />
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--color-destructive)" }}>
          Respuesta incorrecta
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          Esperando la siguiente pregunta…
        </p>
      </div>
    </div>
  );
}
