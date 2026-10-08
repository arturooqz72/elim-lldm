"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GraduationCap, Send } from "lucide-react";
import { InglesMensajes } from "./InglesMensajes";
import { InglesPruebaFin } from "./InglesPruebaFin";
import { BIENVENIDA, SUGERENCIAS } from "@/lib/ingles/etiquetas";
import type { InglesMensaje } from "@/types";

const GOLD = "#f5c842";

type ChatMsg = Pick<InglesMensaje, "role" | "content">;

interface Props {
  mensajesIniciales: ChatMsg[];
  restantesIniciales: number;
  totalPrueba: number;
  gratisDiarios: number;
  maxCaracteres: number;
  reclamadoInicial: boolean;
}

/**
 * Prueba sin cuenta: Conversación libre en nivel Principiante. El servidor
 * lleva la cuenta de mensajes; aquí solo se muestra lo que responde.
 */
export function InglesPrueba(props: Props) {
  const { totalPrueba, gratisDiarios, maxCaracteres } = props;
  const [mensajes, setMensajes] = useState<ChatMsg[]>(props.mensajesIniciales);
  const [restantes, setRestantes] = useState(props.reclamadoInicial ? 0 : props.restantesIniciales);
  const [reclamado, setReclamado] = useState(props.reclamadoInicial);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const terminada = restantes <= 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensajes, loading, terminada]);

  async function enviar(directo?: string) {
    const texto = (directo ?? input).trim();
    if (!texto || loading || terminada) return;

    setInput("");
    setError(null);
    setMensajes((prev) => [...prev, { role: "user", content: texto }]);
    setLoading(true);

    const deshacer = () => {
      setMensajes((prev) => prev.slice(0, -1));
      setInput(texto);
    };

    try {
      const res = await fetch("/api/ingles/prueba", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: texto }),
      });
      const data = (await res.json()) as { estado?: string; reply?: string; restantes?: number; error?: string };

      if (res.status === 409) {
        window.location.reload();
        return;
      }
      if (data.estado === "limite" || data.estado === "reclamado") {
        deshacer();
        setInput("");
        setRestantes(0);
        setReclamado(data.estado === "reclamado");
        return;
      }
      if (!res.ok || !data.reply) throw new Error(data.error ?? "Error al consultar a la tutora");

      setMensajes((prev) => [...prev, { role: "assistant", content: data.reply! }]);
      if (typeof data.restantes === "number") setRestantes(data.restantes);
    } catch (err) {
      deshacer();
      setError(err instanceof Error ? err.message : "Error al consultar a la tutora");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void enviar();
    }
  }

  return (
    <div
      className="flex flex-col h-full rounded-2xl overflow-hidden"
      style={{ background: "var(--color-surface)", border: `1px solid ${GOLD}33` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-5 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${GOLD}1A`, border: `1px solid ${GOLD}55` }}
          >
            <GraduationCap size={20} style={{ color: GOLD }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold" style={{ color: "var(--color-text)" }}>
              Elim English
            </h1>
            <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
              Prueba gratis, sin cuenta
            </p>
          </div>
        </div>
        <Link
          href="/login?returnUrl=%2Fingles"
          className="text-xs font-semibold shrink-0 hover:underline"
          style={{ color: GOLD }}
        >
          Iniciar sesión
        </Link>
      </div>

      <div
        className="px-5 py-2 shrink-0 text-xs flex flex-wrap justify-between gap-x-3 gap-y-1"
        style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
      >
        <span>Conversación libre · Principiante</span>
        <span>
          Mensajes de prueba:{" "}
          <strong style={{ color: "var(--color-text)" }}>
            {Math.max(0, restantes)} de {totalPrueba}
          </strong>
        </span>
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        <InglesMensajes
          mensajes={mensajes}
          bienvenida={BIENVENIDA.conversacion}
          escribiendo={loading}
          sugerencias={terminada ? undefined : SUGERENCIAS.conversacion}
          onSugerencia={(t) => void enviar(t)}
        />

        {error && (
          <div
            className="px-4 py-3 rounded-2xl text-sm"
            style={{
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
              color: "var(--color-destructive)",
            }}
          >
            {error}
          </div>
        )}

        {terminada && !loading && <InglesPruebaFin gratisDiarios={gratisDiarios} reclamado={reclamado} />}
      </div>

      {/* Entrada */}
      <div className="px-5 py-4 shrink-0" style={{ borderTop: "1px solid var(--color-border)" }}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={maxCaracteres}
            placeholder={
              terminada ? "Crea tu cuenta gratis para seguir" : "Escribe en inglés (o en español si no sabes cómo decirlo)..."
            }
            disabled={terminada}
            rows={1}
            className="flex-1 resize-none rounded-xl px-4 py-3 text-sm outline-none disabled:opacity-50"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              maxHeight: "120px",
            }}
          />
          <button
            onClick={() => void enviar()}
            disabled={loading || terminada || !input.trim()}
            className="p-3 rounded-xl shrink-0 transition-opacity disabled:opacity-40"
            style={{ background: GOLD, color: "#000" }}
            aria-label="Enviar"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="flex justify-between mt-1.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          <Link href="/ingles/terminos" className="hover:underline">
            Términos
          </Link>
          {input.length > maxCaracteres * 0.8 && (
            <span>
              {input.length}/{maxCaracteres}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
