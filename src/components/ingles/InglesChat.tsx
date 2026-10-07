"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GraduationCap, Send, Trash2 } from "lucide-react";
import { InglesMensajes } from "./InglesMensajes";
import { InglesOpciones } from "./InglesOpciones";
import { InglesPaquetes } from "./InglesPaquetes";
import { InglesSaldo } from "./InglesSaldo";
import { BIENVENIDA, MODOS } from "@/lib/ingles/etiquetas";
import type { InglesMensaje, InglesModo, InglesPaquete, InglesPerfil, InglesSaldo as Saldo } from "@/types";

const GOLD = "#f5c842";

type ChatMsg = Pick<InglesMensaje, "role" | "content">;

interface Props {
  displayName: string;
  perfilInicial: InglesPerfil;
  mensajesIniciales: InglesMensaje[];
  saldoInicial: Saldo;
  paquetes: InglesPaquete[];
  maxCaracteres: number;
  compra: "ok" | "cancelada" | null;
}

function agrupar(mensajes: InglesMensaje[]): Record<InglesModo, ChatMsg[]> {
  const grupos = Object.fromEntries(MODOS.map((m) => [m, [] as ChatMsg[]])) as Record<InglesModo, ChatMsg[]>;
  for (const m of mensajes) grupos[m.modo].push({ role: m.role, content: m.content });
  return grupos;
}

export function InglesChat(props: Props) {
  const { displayName, perfilInicial, mensajesIniciales, saldoInicial, paquetes, maxCaracteres, compra } = props;
  const [perfil, setPerfil] = useState<InglesPerfil>(perfilInicial);
  const [mensajes, setMensajes] = useState(() => agrupar(mensajesIniciales));
  const [saldo, setSaldo] = useState<Saldo>(saldoInicial);
  const [limite, setLimite] = useState(saldoInicial.gratisRestantes === 0 && saldoInicial.creditos === 0);
  const [aviso, setAviso] = useState<string | null>(
    compra === "ok"
      ? "¡Gracias por tu compra! Tus créditos aparecerán en unos segundos."
      : compra === "cancelada"
        ? "El pago se canceló; no se hizo ningún cargo."
        : null,
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensajes, perfil.modo, loading, limite]);

  // Al volver de Stripe: quitar ?compra= de la URL y esperar a que el webhook
  // acredite los créditos (normalmente tarda unos segundos).
  useEffect(() => {
    if (!compra) return;
    window.history.replaceState(null, "", "/ingles");
    if (compra !== "ok") return;

    let intentos = 0;
    const timer = setInterval(async () => {
      intentos++;
      const res = await fetch("/api/ingles/saldo").catch(() => null);
      const nuevo = res?.ok ? ((await res.json()) as Saldo) : null;
      if (nuevo && nuevo.creditos > saldoInicial.creditos) {
        setSaldo(nuevo);
        setLimite(false);
        setAviso(`¡Listo! Se agregaron tus créditos. Ahora tienes ${nuevo.creditos.toLocaleString("es-MX")}.`);
        clearInterval(timer);
      } else if (intentos >= 15) {
        setAviso("Tu pago se recibió. Si tus créditos no aparecen en unos minutos, recarga la página o escríbenos.");
        clearInterval(timer);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [compra, saldoInicial.creditos]);

  function cambiarPerfil(nuevo: InglesPerfil) {
    setPerfil(nuevo);
    void fetch("/api/ingles/perfil", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nuevo),
    });
  }

  async function enviar() {
    const texto = input.trim();
    if (!texto || loading) return;
    const modo = perfil.modo;

    setInput("");
    setError(null);
    setMensajes((prev) => ({ ...prev, [modo]: [...prev[modo], { role: "user", content: texto }] }));
    setLoading(true);

    // Si el mensaje no se procesó, se quita de la pantalla y vuelve a la caja.
    const deshacer = () => {
      setMensajes((prev) => ({ ...prev, [modo]: prev[modo].slice(0, -1) }));
      setInput(texto);
    };

    try {
      const res = await fetch("/api/ingles/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: texto, ...perfil }),
      });
      const data = (await res.json()) as { estado?: string; reply?: string; saldo?: Saldo; error?: string };
      if (data.saldo) setSaldo(data.saldo);

      if (data.estado === "limite_alcanzado") {
        deshacer();
        setLimite(true);
        return;
      }
      if (!res.ok || !data.reply) throw new Error(data.error ?? "Error al consultar a la tutora");

      setMensajes((prev) => ({ ...prev, [modo]: [...prev[modo], { role: "assistant", content: data.reply! }] }));
    } catch (err) {
      deshacer();
      setError(err instanceof Error ? err.message : "Error al consultar a la tutora");
    } finally {
      setLoading(false);
    }
  }

  async function borrarConversacion() {
    if (!confirm("¿Borrar la conversación de este modo? Esto no devuelve mensajes ya usados.")) return;
    const modo = perfil.modo;
    await fetch("/api/ingles/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modo }),
    });
    setMensajes((prev) => ({ ...prev, [modo]: [] }));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void enviar();
    }
  }

  const actuales = mensajes[perfil.modo];

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
              Hola, {displayName}
            </p>
          </div>
        </div>
        <button
          onClick={borrarConversacion}
          className="p-2 rounded-lg transition-colors shrink-0"
          style={{ color: "var(--color-text-muted)" }}
          title="Borrar conversación"
          aria-label="Borrar conversación"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <InglesOpciones perfil={perfil} onCambiar={cambiarPerfil} />

      <div className="px-5 py-2 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <InglesSaldo saldo={saldo} />
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        {aviso && (
          <div
            className="px-4 py-3 rounded-2xl text-sm"
            style={{ background: `${GOLD}14`, border: `1px solid ${GOLD}55`, color: "var(--color-text)" }}
          >
            {aviso}
          </div>
        )}

        <InglesMensajes mensajes={actuales} bienvenida={BIENVENIDA[perfil.modo]} escribiendo={loading} />

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

        {limite && <InglesPaquetes paquetes={paquetes} gratisDiarios={saldo.gratisDiarios} />}
      </div>

      {/* Entrada */}
      <div className="px-5 py-4 shrink-0" style={{ borderTop: "1px solid var(--color-border)" }}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={maxCaracteres}
            placeholder={limite ? "Llegaste al límite de hoy" : "Escribe en inglés (o en español si no sabes cómo decirlo)..."}
            disabled={limite}
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
            disabled={loading || limite || !input.trim()}
            className="p-3 rounded-xl shrink-0 transition-opacity disabled:opacity-40"
            style={{ background: GOLD, color: "#000" }}
            aria-label="Enviar"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="flex justify-between mt-1.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          <Link href="/ingles/terminos" className="hover:underline">
            Términos y reembolsos
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
