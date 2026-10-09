"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { InglesMensajes } from "./InglesMensajes";
import { InglesPruebaFin } from "./InglesPruebaFin";
import { InglesInstalar } from "./InglesInstalar";
import { InglesEncabezado } from "./InglesEncabezado";
import { InglesEntrada } from "./InglesEntrada";
import { InglesRetoTarjeta } from "./InglesRetoTarjeta";
import { InglesAvisoApp } from "./InglesAvisoApp";
import { InglesEntradaApp } from "./InglesEntradaApp";
import { abiertaComoApp } from "./instalacionApp";
import { InglesPronunciacionAtajo } from "./InglesPronunciacionAtajo";
import { BIENVENIDA, SUGERENCIAS } from "@/lib/ingles/etiquetas";
import type { InglesMensaje, InglesReto } from "@/types";

const GOLD = "#f5c842";
/** sessionStorage: en esta apertura de la app ya eligió "Pruébala sin cuenta". */
const CLAVE_PROBAR = "elim-english-probar";

type ChatMsg = Pick<InglesMensaje, "role" | "content">;

interface Props {
  mensajesIniciales: ChatMsg[];
  restantesIniciales: number;
  totalPrueba: number;
  gratisDiarios: number;
  maxCaracteres: number;
  reclamadoInicial: boolean;
  /** Reto del día: sin cuenta solo se puede ver (invita a registrarse). */
  reto: InglesReto | null;
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
  // App instalada sin sesión y sin prueba empezada: primero la pantalla de
  // entrada (iniciar sesión o probar). Solo se sabe en el cliente.
  const [entrada, setEntrada] = useState(false);
  const [esApp, setEsApp] = useState(false);

  useEffect(() => {
    if (!abiertaComoApp()) return;
    setEsApp(true);
    if (props.mensajesIniciales.length > 0) return;
    let eligioProbar = false;
    try {
      eligioProbar = Boolean(sessionStorage.getItem(CLAVE_PROBAR));
    } catch {
      // sin sessionStorage se muestra la entrada
    }
    if (!eligioProbar) setEntrada(true);
  }, [props.mensajesIniciales.length]);

  function probar() {
    try {
      sessionStorage.setItem(CLAVE_PROBAR, "1");
    } catch {
      // no pasa nada: solo se volvería a mostrar la entrada al recargar
    }
    setEntrada(false);
  }

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

  const marco = { background: "var(--color-surface)", border: `1px solid ${GOLD}33` };

  if (entrada) {
    return (
      <div className="flex flex-col h-full rounded-2xl overflow-hidden" style={marco}>
        <InglesEncabezado subtitulo="Tu tutora de inglés con IA" />
        <InglesEntradaApp gratisDiarios={gratisDiarios} puedeProbar={!terminada} onProbar={probar} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden" style={marco}>
      <InglesEncabezado subtitulo="Prueba gratis, sin cuenta">
        <InglesInstalar />
        <Link href="/login?returnUrl=%2Fingles" className="text-xs font-semibold hover:underline" style={{ color: GOLD }}>
          Entrar
        </Link>
      </InglesEncabezado>

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

      {!terminada && <InglesAvisoApp gratisDiarios={gratisDiarios} onEntrar={() => setEntrada(true)} />}

      {props.reto && <InglesRetoTarjeta reto={props.reto} avance={null} enReto={false} />}

      {!terminada &&
        (esApp ? (
          <InglesPronunciacionAtajo onAbrir={() => setEntrada(true)} accion="Crear cuenta" />
        ) : (
          <InglesPronunciacionAtajo href="/login?returnUrl=%2Fingles&modo=registro" />
        ))}

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

      <InglesEntrada
        valor={input}
        onCambiar={setInput}
        onEnviar={() => void enviar()}
        bloqueada={terminada}
        enviando={loading}
        placeholder={
          terminada ? "Crea tu cuenta gratis para seguir" : "Escribe en inglés (o en español si no sabes cómo decirlo)..."
        }
        maxCaracteres={maxCaracteres}
        textoTerminos="Términos"
      />
    </div>
  );
}
