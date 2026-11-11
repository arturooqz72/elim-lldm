// src/components/juegos/liga/SelectorIglesia.tsx
//
// Paso 1: "¿Perteneces a la Iglesia La Luz del Mundo?". Paso 1b (otra
// iglesia): denominación. Paso 2: ciudad (buscar o agregar). "No
// pertenezco a ninguna" y "Prefiero no decir" van a Amigos de Elim.
"use client";

import { useEffect, useState } from "react";
import { Church, Loader2, Plus, Search } from "lucide-react";
import { DENOMINACIONES, type Denominacion } from "@/lib/liga/config";
import type { Comunidad } from "@/lib/liga/nombre";

export interface IglesiaElegida {
  id: string;
  nombre: string;
  comunidad: Comunidad;
  aprobada: boolean;
}

interface Opcion {
  id: string;
  nombre: string;
  detalle: string;
}

type Paso = "pregunta" | "denominacion" | "ciudad" | "agregar" | "similares";

const campo = { background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" } as const;
const botonGrande = "w-full p-3 rounded-xl text-left text-sm font-semibold min-h-12";

export function SelectorIglesia({ onElegida }: { onElegida: (iglesia: IglesiaElegida) => void }) {
  const [paso, setPaso] = useState<Paso>("pregunta");
  const [comunidad, setComunidad] = useState<"lldm" | "otra">("lldm");
  const [denominacion, setDenominacion] = useState<Denominacion | null>(null);
  const [q, setQ] = useState("");
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [nueva, setNueva] = useState({ ciudad: "", estado: "", pais: "" });
  const [similares, setSimilares] = useState<Opcion[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (paso !== "ciudad" || q.trim().length < 2) {
      setOpciones([]);
      return;
    }
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const params = new URLSearchParams({ q, comunidad, ...(denominacion ? { denominacion } : {}) });
        const res = await fetch(`/api/liga/iglesias?${params.toString()}`);
        const data = (await res.json()) as { iglesias?: Opcion[] };
        setOpciones(data.iglesias ?? []);
      } catch {
        setOpciones([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, paso, comunidad, denominacion]);

  async function enviar(cuerpo: object) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/liga/mi-iglesia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      const data = (await res.json()) as { iglesia?: IglesiaElegida; similares?: Opcion[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
      if (data.similares) {
        setSimilares(data.similares);
        setPaso("similares");
        return;
      }
      if (data.iglesia) onElegida(data.iglesia);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  const nuevaCompleta = { comunidad, denominacion, ...nueva };
  const errorTexto = error && <p className="text-xs" style={{ color: "var(--color-destructive)" }}>{error}</p>;
  const lista = (items: Opcion[]) => (
    <ul className="flex flex-col gap-2">
      {items.map((o) => (
        <li key={o.id}>
          <button type="button" disabled={guardando} onClick={() => void enviar({ iglesia_id: o.id })} className="w-full flex items-center gap-3 p-3 rounded-xl text-left min-h-11" style={campo}>
            <Church size={18} style={{ color: "var(--color-primary)" }} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold">{o.nombre}</span>
              <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>{o.detalle}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
  const volver = (a: Paso) => (
    <button type="button" onClick={() => setPaso(a)} className="text-sm underline min-h-11" style={{ color: "var(--color-text-muted)" }}>Volver</button>
  );

  if (paso === "pregunta") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>¿Perteneces a la Iglesia La Luz del Mundo?</p>
        <button type="button" className={botonGrande} style={campo} onClick={() => { setComunidad("lldm"); setDenominacion(null); setPaso("ciudad"); }}>Sí</button>
        <button type="button" className={botonGrande} style={campo} onClick={() => { setComunidad("otra"); setPaso("denominacion"); }}>No, soy de otra iglesia</button>
        <button type="button" disabled={guardando} className={botonGrande} style={campo} onClick={() => void enviar({ amigos: true })}>No pertenezco a ninguna</button>
        <button type="button" disabled={guardando} className={botonGrande} style={campo} onClick={() => void enviar({ amigos: true })}>Prefiero no decir</button>
        {errorTexto}
      </div>
    );
  }

  if (paso === "denominacion") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>¿De qué iglesia eres?</p>
        <div className="grid grid-cols-2 gap-2">
          {DENOMINACIONES.map((d) => (
            <button key={d} type="button" className="p-3 rounded-xl text-sm font-semibold min-h-12" style={campo} onClick={() => { setDenominacion(d); setPaso("ciudad"); }}>{d}</button>
          ))}
        </div>
        {volver("pregunta")}
      </div>
    );
  }

  if (paso === "similares") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm" style={{ color: "var(--color-text)" }}>¿Es alguna de estas?</p>
        {lista(similares)}
        <button type="button" disabled={guardando} onClick={() => void enviar({ nueva: nuevaCompleta, confirmar: true })} className="py-2.5 rounded-xl text-sm font-semibold min-h-11" style={{ ...campo, color: "var(--color-text-muted)" }}>
          No, agregar {nueva.ciudad} como nueva
        </button>
        {errorTexto}
      </div>
    );
  }

  if (paso === "agregar") {
    const listo = nueva.ciudad.trim() && nueva.estado.trim() && nueva.pais.trim();
    return (
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (listo) void enviar({ nueva: nuevaCompleta }); }}>
        {(["ciudad", "estado", "pais"] as const).map((c) => (
          <input key={c} value={nueva[c]} onChange={(e) => setNueva({ ...nueva, [c]: e.target.value })} maxLength={60} placeholder={c === "ciudad" ? "Ciudad" : c === "estado" ? "Estado o provincia" : "País"} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={campo} />
        ))}
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Queda pendiente hasta que la aprobemos. Tus puntos se guardan desde ya.</p>
        {errorTexto}
        <div className="flex gap-2">
          <button type="button" onClick={() => setPaso("ciudad")} className="flex-1 py-2.5 rounded-xl text-sm min-h-11" style={{ ...campo, color: "var(--color-text-muted)" }}>Volver</button>
          <button type="submit" disabled={!listo || guardando} className="flex-1 py-2.5 rounded-xl text-sm font-bold min-h-11 disabled:opacity-60" style={{ background: "var(--color-primary)", color: "#000" }}>{guardando ? "Guardando…" : "Agregar"}</button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
        {comunidad === "lldm" ? "¿En qué ciudad está tu iglesia?" : `${denominacion}: ¿en qué ciudad?`}
      </p>
      <label className="flex items-center gap-2 rounded-xl px-3" style={campo}>
        <Search size={16} style={{ color: "var(--color-text-muted)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escribe tu ciudad" className="flex-1 bg-transparent py-2.5 text-sm outline-none" autoFocus />
        {buscando && <Loader2 size={16} className="animate-spin" style={{ color: "var(--color-text-muted)" }} />}
      </label>
      {opciones.length > 0 && lista(opciones)}
      {q.trim().length >= 2 && !buscando && opciones.length === 0 && <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Todavía no está tu ciudad.</p>}
      <button type="button" onClick={() => { setNueva({ ciudad: q.trim(), estado: "", pais: "" }); setPaso("agregar"); }} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold min-h-11" style={{ border: "1px dashed var(--color-border)", color: "var(--color-primary)" }}>
        <Plus size={16} /> Mi ciudad no aparece
      </button>
      {errorTexto}
      {volver(comunidad === "lldm" ? "pregunta" : "denominacion")}
    </div>
  );
}
