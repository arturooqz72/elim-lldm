// src/components/admin/ControlesVistaTikTok.tsx
//
// Controles bajo la vista previa del video de TikTok: reproducir/pausar,
// saltar de escena, ver las zonas que TikTok recorta o tapa en la
// portada, y descargar la portada como PNG.
"use client";

import { ImageDown, Pause, Play } from "lucide-react";
/** Lo único que necesitan los controles de cada escena (Palabra del Día o Campeones). */
interface EscenaVista {
  id: string;
  nombre: string;
}

interface Props<Escena extends EscenaVista> {
  listo: boolean;
  grabando: boolean;
  tocando: boolean;
  segundo: number;
  dura: number;
  conVoz: boolean;
  escenas: Escena[];
  guias: boolean;
  alAlternar: () => void;
  alVerEscena: (e: Escena) => void;
  alCambiarGuias: (v: boolean) => void;
  alDescargarPortada: () => void;
}

const boton = "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60";
const secundario = { background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" };

export function ControlesVistaTikTok<Escena extends EscenaVista>(p: Props<Escena>) {
  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={boton}
          style={secundario}
          disabled={!p.listo || p.grabando}
          onClick={p.alAlternar}
          aria-label={p.tocando ? "Pausar" : "Reproducir con sonido"}
        >
          {p.tocando ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <span className="text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>
          {p.segundo}s / {Math.round(p.dura)}s{p.conVoz ? " · con voz" : ""}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {p.escenas.map((e) => (
          <button
            key={e.id}
            type="button"
            disabled={p.grabando}
            onClick={() => p.alVerEscena(e)}
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={secundario}
          >
            {e.nombre}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
        <input type="checkbox" checked={p.guias} onChange={(e) => p.alCambiarGuias(e.target.checked)} />
        Ver en la portada lo que TikTok recorta y tapa (solo aquí, no sale en el video)
      </label>
      <button type="button" onClick={p.alDescargarPortada} disabled={!p.listo || p.grabando} className={boton} style={secundario}>
        <ImageDown size={15} /> Descargar portada (PNG)
      </button>
    </>
  );
}
