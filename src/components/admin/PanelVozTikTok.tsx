// src/components/admin/PanelVozTikTok.tsx
//
// Guion y voz (ElevenLabs) del video de TikTok de la Palabra del Día. El
// guion sale de los datos del día y se puede editar antes de generar; la
// voz se guarda por día en B2, así solo se paga otra vez si se regenera.
"use client";

import { useEffect, useState } from "react";
import { Loader2, Mic, RotateCcw } from "lucide-react";
import type { PalabraVozTikTok } from "@/types";
import { MAX_GUION } from "@/lib/palabra/video/guion";

interface Props {
  fecha: string;
  sugerido: string;
  voz: PalabraVozTikTok | null | undefined;
  bajandoVoz: boolean;
  deshabilitado: boolean;
  alGenerar: (voz: PalabraVozTikTok) => void;
}

const fechaHora = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });

export function PanelVozTikTok({ fecha, sugerido, voz, bajandoVoz, deshabilitado, alGenerar }: Props) {
  const [guion, setGuion] = useState(sugerido);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al cambiar de día (o al llegar la voz guardada) se muestra su guion.
  useEffect(() => {
    if (voz !== undefined) setGuion(voz?.guion ?? sugerido);
  }, [voz, sugerido]);

  const limpio = guion.replace(/\s+/g, " ").trim();
  const cambiado = Boolean(voz) && limpio !== voz?.guion;

  const generar = async () => {
    setGenerando(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/palabra/tiktok/voz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, guion: limpio }),
      });
      const datos = (await r.json().catch(() => ({}))) as { voz?: PalabraVozTikTok; error?: string };
      if (!r.ok || !datos.voz) throw new Error(datos.error ?? "No se pudo generar la voz.");
      alGenerar(datos.voz);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar la voz.");
    } finally {
      setGenerando(false);
    }
  };

  const boton = "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60";
  const secundario = { background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" };

  return (
    <section
      className="flex flex-col gap-3 p-4 rounded-2xl"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center gap-2">
        <Mic size={16} style={{ color: "var(--color-primary)" }} />
        <h2 className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
          Voz del video
        </h2>
      </div>

      <label className="flex flex-col gap-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
        Guion (lo que dice la voz). Puedes corregirlo antes de generar.
        <textarea
          value={guion}
          onChange={(e) => setGuion(e.target.value)}
          rows={7}
          maxLength={MAX_GUION}
          disabled={generando || deshabilitado}
          className="px-3 py-2 rounded-lg text-sm leading-relaxed resize-y"
          style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
        />
      </label>
      <div className="flex items-center justify-between gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
        <span className="tabular-nums">
          {limpio.length} caracteres{voz ? (cambiado ? " · guion cambiado, regenera para oírlo" : "") : " al generar"}
        </span>
        {limpio !== sugerido && (
          <button type="button" onClick={() => setGuion(sugerido)} disabled={generando} className="inline-flex items-center gap-1 underline">
            <RotateCcw size={12} /> Guion original
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={generar}
        disabled={generando || deshabilitado || voz === undefined || !limpio}
        className={boton}
        style={voz ? secundario : { background: "var(--color-primary)", color: "#000" }}
      >
        {generando ? <Loader2 size={15} className="animate-spin" /> : <Mic size={15} />}
        {generando ? "Generando voz…" : voz ? "Regenerar voz" : "Generar voz"}
      </button>

      {voz === undefined ? (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Revisando si este día ya tiene voz…
        </p>
      ) : voz ? (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {bajandoVoz ? "Cargando la voz guardada… " : "✅ Voz lista. "}
          Generada el {fechaHora.format(new Date(voz.creada))}; gastó <strong>{voz.caracteres.toLocaleString("es-MX")}</strong>{" "}
          caracteres de ElevenLabs. Ya quedó guardada: verla otra vez no cuesta nada, solo “Regenerar voz” vuelve a cobrar.
        </p>
      ) : (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Este día todavía no tiene voz. Mientras tanto el video lleva solo la canción de fondo.
        </p>
      )}
      {error && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}
    </section>
  );
}
