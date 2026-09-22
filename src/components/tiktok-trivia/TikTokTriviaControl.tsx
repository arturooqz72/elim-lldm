"use client";

import { useEffect, useRef, useState } from "react";
import { createFreshClient } from "@/lib/supabase/client";
import { connectTikTokTriviaBridge, sendBridgeMessage } from "@/lib/tiktok-trivia/bridge-client";
import { TikTokAnswerDisplay } from "./TikTokAnswerDisplay";
import { TikTokTriviaLeaderboard, type TikTokLeaderboardEntry } from "./TikTokTriviaLeaderboard";
import { TikTokTriviaResults } from "./TikTokTriviaResults";
import type { Question, AnswerOption } from "@/types";

interface QuestionSetOption {
  id: string;
  title: string;
  count: number;
}

type Screen = "configurar" | "en_vivo" | "resultados";
type BridgeStatus = "idle" | "connecting" | "connected" | "error";
type QuestionPhase = "pending" | "open" | "revealed";

interface WinnerInfo {
  username: string;
  displayName: string;
  answer: AnswerOption;
}

interface TikTokTriviaControlProps {
  questionSets: QuestionSetOption[];
}

export function TikTokTriviaControl({ questionSets }: TikTokTriviaControlProps) {
  const [screen, setScreen] = useState<Screen>("configurar");
  const [selectedSetId, setSelectedSetId] = useState(questionSets[0]?.id ?? "");
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionPhase, setQuestionPhase] = useState<QuestionPhase>("pending");
  const [winner, setWinner] = useState<WinnerInfo | null>(null);
  const [leaderboard, setLeaderboard] = useState<Map<string, TikTokLeaderboardEntry>>(new Map());

  const wsRef = useRef<WebSocket | null>(null);
  const sesionIdRef = useRef<string | null>(null);
  const intentionalCloseRef = useRef(false);
  const questionsRef = useRef<Question[]>([]);
  const questionIndexRef = useRef(0);
  const questionPhaseRef = useRef<QuestionPhase>("pending");
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reflejados en refs para que el listener de "message" del WebSocket
  // (registrado una sola vez en conectar()) siempre lea el valor actual
  // en vez de quedar atado al valor que tenían al momento de registrarse.
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);
  useEffect(() => {
    questionIndexRef.current = questionIndex;
  }, [questionIndex]);
  useEffect(() => {
    questionPhaseRef.current = questionPhase;
  }, [questionPhase]);

  // Corta el WebSocket y cualquier reintento pendiente si el host navega
  // fuera del componente a medio juego (cambio de ruta, botón "atrás") sin
  // pasar por "Ver resultados". No intenta marcar la sesión como
  // "finalizada" en Supabase aquí: un cleanup síncrono no puede esperar de
  // forma confiable una llamada de red durante el unmount, así que la fila
  // queda en su último estado conocido ("conectando"/"en_vivo") — aceptable.
  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, []);

  const currentQuestion = questions[questionIndex] ?? null;

  function bumpLeaderboard(username: string, displayName: string) {
    setLeaderboard((prev) => {
      const next = new Map(prev);
      const existing = next.get(username);
      next.set(username, {
        tiktokUsername: username,
        tiktokDisplayName: displayName,
        points: (existing?.points ?? 0) + 1,
      });
      return next;
    });
  }

  async function handleBridgeMessage(msg: {
    type: string;
    reason?: string;
    tiktokUsername?: string;
    tiktokDisplayName?: string;
    answer?: AnswerOption;
  }) {
    if (msg.type === "connected") {
      reconnectAttemptsRef.current = 0;
      setBridgeStatus("connected");
      setErrorMsg("");
      setScreen("en_vivo");
      const supabase = createFreshClient();
      if (sesionIdRef.current) {
        const { error } = await supabase
          .from("tiktok_trivia_sesiones")
          .update({ status: "en_vivo" })
          .eq("id", sesionIdRef.current);
        if (error) console.error("[TikTokTriviaControl] No se pudo marcar la sesión como en_vivo:", error);
      }
    } else if (msg.type === "error") {
      setBridgeStatus("error");
      setErrorMsg(
        msg.reason === "not_live"
          ? "La cuenta no está en vivo en TikTok ahora mismo."
          : msg.reason === "tiktok_disconnected"
            ? "Se perdió la conexión con TikTok (el bridge sigue conectado)."
            : "Ocurrió un error en el bridge de TikTok."
      );
    } else if (msg.type === "winner" && msg.tiktokUsername && msg.tiktokDisplayName && msg.answer) {
      setWinner({ username: msg.tiktokUsername, displayName: msg.tiktokDisplayName, answer: msg.answer });
      bumpLeaderboard(msg.tiktokUsername, msg.tiktokDisplayName);

      const question = questionsRef.current[questionIndexRef.current];
      if (sesionIdRef.current && question) {
        const supabase = createFreshClient();
        // Si este insert falla, el leaderboard en memoria (ya incrementado
        // arriba) y la fila persistida en tiktok_trivia_respuestas quedan
        // desincronizados en silencio — gap conocido y aceptado, no se
        // intenta reconciliar aquí.
        const { error } = await supabase.from("tiktok_trivia_respuestas").insert({
          sesion_id: sesionIdRef.current,
          question_id: question.id,
          tiktok_username: msg.tiktokUsername,
          tiktok_display_name: msg.tiktokDisplayName,
        });
        if (error) console.error("[TikTokTriviaControl] No se pudo guardar la respuesta ganadora:", error);
      }
    }
  }

  /** Escucha compartida entre la primera conexión y cada reintento automático. */
  function attachSocket(ws: WebSocket) {
    ws.addEventListener("message", (event) => {
      if (wsRef.current !== ws) return;
      try {
        const msg = JSON.parse(event.data as string);
        void handleBridgeMessage(msg);
      } catch {
        // ignora mensajes no-JSON
      }
    });

    ws.addEventListener("close", () => {
      if (wsRef.current !== ws || intentionalCloseRef.current) return;
      wsRef.current = null;
      scheduleReconnect("Se perdió la conexión con el bridge de TikTok.");
    });
  }

  /**
   * Reintento automático acotado a 5 intentos con 3s de espera entre cada
   * uno — cubre una caída pasajera del WebSocket con el bridge sin
   * reiniciar la sesión (misma sesionId, mismas preguntas, mismo índice).
   * Tras 5 intentos fallidos, deja el error fijo y regresa a "Configurar"
   * para que el host reconecte a mano.
   */
  function scheduleReconnect(message: string) {
    if (intentionalCloseRef.current) return;
    reconnectAttemptsRef.current += 1;
    if (reconnectAttemptsRef.current > 5) {
      setBridgeStatus("error");
      setErrorMsg(`${message} Intenta conectar de nuevo.`);
      setScreen("configurar");
      return;
    }
    setBridgeStatus("connecting");
    setErrorMsg(`${message} Reconectando… (intento ${reconnectAttemptsRef.current} de 5)`);
    reconnectTimeoutRef.current = setTimeout(() => void reconectar(), 3000);
  }

  /** Reconecta reusando la sesión ya creada — no inserta una fila nueva ni reinicia las preguntas. */
  async function reconectar() {
    if (intentionalCloseRef.current) return;
    try {
      const res = await fetch("/api/tiktok-trivia/bridge-credentials", { method: "POST" });
      const creds = await res.json();
      if (!res.ok) throw new Error(creds.error ?? "No se pudo obtener las credenciales del bridge");

      const ws = await connectTikTokTriviaBridge(creds.wsUrl, creds.key);
      wsRef.current = ws;
      attachSocket(ws);
      sendBridgeMessage(ws, { type: "start_session" });

      // Si la desconexión ocurrió con una pregunta abierta, el bridge perdió
      // su currentRound (lo limpia al desconectarse de TikTok) — hay que
      // reabrirla explícitamente o ningún comentario nuevo puntuará para
      // ella, sin que la UI (que sigue mostrando "open") lo delate.
      if (questionPhaseRef.current === "open") {
        const question = questionsRef.current[questionIndexRef.current];
        if (question) {
          sendBridgeMessage(ws, {
            type: "open_question",
            questionId: question.id,
            correctOption: question.correct_option,
          });
        }
      }
    } catch (err) {
      scheduleReconnect(err instanceof Error ? err.message : "No se pudo reconectar.");
    }
  }

  async function conectar() {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    reconnectAttemptsRef.current = 0;
    setErrorMsg("");
    setBridgeStatus("connecting");
    intentionalCloseRef.current = false;

    try {
      const supabase = createFreshClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión expirada, vuelve a iniciar sesión.");

      const { data: preguntas, error: preguntasError } = await supabase
        .from("questions")
        .select("*")
        .eq("question_set_id", selectedSetId)
        .order("order_index");
      if (preguntasError) throw preguntasError;
      if (!preguntas || preguntas.length === 0) throw new Error("Ese set no tiene preguntas.");

      const res = await fetch("/api/tiktok-trivia/bridge-credentials", { method: "POST" });
      const creds = await res.json();
      if (!res.ok) throw new Error(creds.error ?? "No se pudo obtener las credenciales del bridge");

      const ws = await connectTikTokTriviaBridge(creds.wsUrl, creds.key);
      wsRef.current = ws;
      attachSocket(ws);

      const { data: sesion, error: sesionError } = await supabase
        .from("tiktok_trivia_sesiones")
        .insert({ question_set_id: selectedSetId, started_by: user.id, status: "conectando" })
        .select("id")
        .single();
      if (sesionError) throw sesionError;
      sesionIdRef.current = sesion.id;

      setQuestions(preguntas as Question[]);
      setQuestionIndex(0);
      setQuestionPhase("pending");
      sendBridgeMessage(ws, { type: "start_session" });
    } catch (err) {
      wsRef.current?.close();
      wsRef.current = null;
      setBridgeStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "No se pudo conectar");
    }
  }

  function mostrarPregunta() {
    if (!currentQuestion || !wsRef.current) return;
    setWinner(null);
    setQuestionPhase("open");
    sendBridgeMessage(wsRef.current, {
      type: "open_question",
      questionId: currentQuestion.id,
      correctOption: currentQuestion.correct_option,
    });
  }

  function revelarRespuesta() {
    if (!wsRef.current) return;
    setQuestionPhase("revealed");
    sendBridgeMessage(wsRef.current, { type: "close_question" });
  }

  async function siguientePreguntaOTerminar() {
    if (questionIndex + 1 < questions.length) {
      setWinner(null);
      setQuestionPhase("pending");
      setQuestionIndex((i) => i + 1);
    } else {
      await terminar();
    }
  }

  async function terminar() {
    intentionalCloseRef.current = true;
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (wsRef.current) {
      sendBridgeMessage(wsRef.current, { type: "end_session" });
      wsRef.current.close();
      wsRef.current = null;
    }
    if (sesionIdRef.current) {
      try {
        const supabase = createFreshClient();
        const { error } = await supabase
          .from("tiktok_trivia_sesiones")
          .update({ status: "finalizada", ended_at: new Date().toISOString() })
          .eq("id", sesionIdRef.current);
        if (error) console.error("[TikTokTriviaControl] No se pudo finalizar la sesión:", error);
      } catch (err) {
        // No bloquea la transición a "resultados": el host ya pidió
        // terminar y debe ver la pantalla de resultados aunque este
        // write falle (p. ej. pérdida total de red).
        console.error("[TikTokTriviaControl] Error al finalizar la sesión:", err);
      }
    }
    setScreen("resultados");
  }

  const leaderboardEntries = Array.from(leaderboard.values());

  if (screen === "resultados") {
    return <TikTokTriviaResults entries={leaderboardEntries} onTerminar={() => window.location.reload()} />;
  }

  if (screen === "en_vivo" && currentQuestion) {
    const opciones = {
      a: currentQuestion.option_a,
      b: currentQuestion.option_b,
      c: currentQuestion.option_c,
      d: currentQuestion.option_d,
    };

    return (
      <div className="flex flex-col gap-6">
        {errorMsg && (
          <div
            className="px-4 py-3 rounded-xl text-sm"
            style={{
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
              color: "var(--color-destructive)",
            }}
          >
            {errorMsg}
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Pregunta {questionIndex + 1} de {questions.length}
          </span>
          {winner && (
            <span className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>
              🏆 @{winner.username} acertó con {winner.answer.toUpperCase()}
            </span>
          )}
        </div>
        <h2 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          {currentQuestion.question_text}
        </h2>
        <TikTokAnswerDisplay
          opciones={opciones}
          correct={questionPhase === "revealed" ? currentQuestion.correct_option : null}
          winnerAnswer={winner?.answer ?? null}
        />
        <div className="flex gap-3">
          {questionPhase === "pending" && (
            <button
              onClick={mostrarPregunta}
              className="flex-1 px-5 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "var(--color-primary)", color: "#000" }}
            >
              Mostrar pregunta
            </button>
          )}
          {questionPhase === "open" && (
            <button
              onClick={revelarRespuesta}
              className="flex-1 px-5 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "var(--color-primary)", color: "#000" }}
            >
              Revelar respuesta
            </button>
          )}
          {questionPhase === "revealed" && (
            <button
              onClick={() => void siguientePreguntaOTerminar()}
              className="flex-1 px-5 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            >
              {questionIndex + 1 < questions.length ? "Siguiente pregunta" : "Ver resultados"}
            </button>
          )}
        </div>
        <TikTokTriviaLeaderboard entries={leaderboardEntries} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {errorMsg && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.3)",
            color: "var(--color-destructive)",
          }}
        >
          {errorMsg}
        </div>
      )}
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
          Set de preguntas
        </span>
        <select
          value={selectedSetId}
          onChange={(e) => setSelectedSetId(e.target.value)}
          disabled={bridgeStatus === "connecting"}
          className="px-4 py-3 rounded-xl text-sm"
          style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
        >
          {questionSets.map((set) => (
            <option key={set.id} value={set.id}>
              {set.title} ({set.count} preguntas)
            </option>
          ))}
        </select>
      </label>
      <button
        onClick={() => void conectar()}
        disabled={bridgeStatus === "connecting" || !selectedSetId}
        className="px-5 py-3 rounded-xl text-sm font-semibold"
        style={{ background: "var(--color-primary)", color: "#000", opacity: bridgeStatus === "connecting" ? 0.6 : 1 }}
      >
        {bridgeStatus === "connecting" ? "Conectando…" : "Conectar a TikTok Live"}
      </button>
    </div>
  );
}
