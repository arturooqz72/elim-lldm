// src/components/admin/TarjetaTikTok.tsx
//
// Video vertical 9:16 (1080×1920) de la Palabra del Día para TikTok. La
// vista previa y el archivo que se descarga salen del mismo dibujo
// (src/lib/palabra/video), así lo que se ve es lo que se sube. Con nombre
// solo quien dio permiso, en forma corta ("Arturo O."); los demás se
// resumen en "y N hermanos más". Sin iglesia ni correos.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Pause, Play } from "lucide-react";
import type { PalabraTarjetaTikTok } from "@/types";
import { ALTO, ANCHO } from "@/lib/palabra/video/lienzo";
import { dibujarCuadro, duracion, lineaDeTiempo, type Recursos } from "@/lib/palabra/video/escenas";
import { cargarRecursos } from "@/lib/palabra/video/recursos";
import { formatoDisponible, grabarLienzo, type Formato } from "@/lib/palabra/video/grabar";
import { descripcionTikTok } from "@/lib/palabra/video/descripcion";
import { TextoTikTok } from "./TextoTikTok";

type Estado = { tipo: "cargando" } | { tipo: "listo" } | { tipo: "grabando"; avance: number } | { tipo: "error"; mensaje: string };

export function TarjetaTikTok({ t }: { t: PalabraTarjetaTikTok }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [recursos, setRecursos] = useState<Recursos | null>(null);
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [tocando, setTocando] = useState(true);
  const [segundo, setSegundo] = useState(0);
  // Tiempo de la vista previa: se guarda aparte para poder pausar y saltar de escena.
  const reloj = useRef({ t: 0, ultimo: 0 });

  const escenas = useMemo(() => (recursos ? lineaDeTiempo(recursos) : []), [recursos]);
  const dura = duracion(escenas);
  // undefined = todavía no se revisa (en el servidor no hay MediaRecorder).
  const [formato, setFormato] = useState<Formato | null | undefined>(undefined);
  const texto = useMemo(() => descripcionTikTok(t), [t]);

  useEffect(() => setFormato(formatoDisponible()), []);

  useEffect(() => {
    let vivo = true;
    setEstado({ tipo: "cargando" });
    cargarRecursos(t)
      .then((r) => {
        if (!vivo) return;
        setRecursos(r);
        setEstado({ tipo: "listo" });
      })
      .catch(() => vivo && setEstado({ tipo: "error", mensaje: "No se pudo preparar el video." }));
    return () => {
      vivo = false;
    };
  }, [t]);

  const pintar = useCallback(
    (seg: number) => {
      const ctx = lienzo.current?.getContext("2d");
      if (ctx && recursos) dibujarCuadro(ctx, recursos, escenas, seg);
    },
    [recursos, escenas]
  );

  // Vista previa en bucle (se detiene mientras se graba: la grabación pinta sola).
  useEffect(() => {
    if (!recursos || estado.tipo === "grabando") return;
    let id = 0;
    reloj.current.ultimo = performance.now();
    const cuadro = (ahora: number) => {
      const r = reloj.current;
      if (tocando) r.t = (r.t + (ahora - r.ultimo) / 1000) % (dura + 1.2);
      r.ultimo = ahora;
      pintar(Math.min(r.t, dura - 0.001));
      setSegundo(Math.floor(Math.min(r.t, dura)));
      id = requestAnimationFrame(cuadro);
    };
    id = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(id);
  }, [recursos, estado.tipo, tocando, dura, pintar]);

  const verEscena = (inicio: number, largo: number) => {
    // Casi al final de la escena, cuando ya se armó completa.
    reloj.current.t = inicio + largo - 0.5;
    setTocando(false);
  };

  const descargar = async () => {
    if (!lienzo.current || !formato || !recursos) return;
    setEstado({ tipo: "grabando", avance: 0 });
    try {
      const archivo = await grabarLienzo(lienzo.current, formato, dura, pintar, (avance) =>
        setEstado({ tipo: "grabando", avance })
      );
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `palabra-del-dia-${t.fecha}.${formato.extension}`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      reloj.current.t = 0;
      setTocando(true);
      setEstado({ tipo: "listo" });
    } catch (e) {
      setEstado({ tipo: "error", mensaje: e instanceof Error ? e.message : "No se pudo grabar el video." });
    }
  };

  const grabando = estado.tipo === "grabando";
  const boton = "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold";
  const secundario = { background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <div className="flex flex-col gap-3 w-full max-w-[360px]">
        <div className="relative w-full" style={{ aspectRatio: "9 / 16" }}>
          <canvas
            ref={lienzo}
            width={ANCHO}
            height={ALTO}
            aria-label="Vista previa del video para TikTok"
            className="absolute inset-0 w-full h-full rounded-2xl"
            style={{ background: "#0A0A12", border: "1px solid var(--color-border)" }}
          />
          {estado.tipo === "cargando" && (
            <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
              <Loader2 size={16} className="animate-spin" /> Preparando video…
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className={boton}
            style={secundario}
            disabled={!recursos || grabando}
            onClick={() => setTocando((v) => !v)}
            aria-label={tocando ? "Pausar" : "Reproducir"}
          >
            {tocando ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <span className="text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>
            {segundo}s / {Math.round(dura)}s
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {escenas.map((e) => (
            <button
              key={e.id}
              type="button"
              disabled={grabando}
              onClick={() => verEscena(e.inicio, e.dura)}
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={secundario}
            >
              {e.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-md">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={descargar}
            disabled={!recursos || !formato || grabando}
            className={`${boton} py-3 text-base disabled:opacity-60`}
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            {grabando ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {grabando ? `Grabando… ${Math.round(estado.avance * 100)}%` : `Descargar video (${formato?.extension.toUpperCase() ?? "—"})`}
          </button>
          {grabando && (
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-surface-elevated)" }}>
              <div className="h-full" style={{ width: `${estado.avance * 100}%`, background: "var(--color-primary)" }} />
            </div>
          )}
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {formato === undefined
              ? ""
              : !formato
              ? "Este navegador no puede generar video. Ábrelo en Chrome o Safari actualizados."
              : grabando
                ? "No cambies de pestaña ni minimices la ventana hasta que termine (unos segundos)."
                : formato.extension === "mp4"
                  ? `Se genera un MP4 de ${Math.round(dura)} segundos, sin sonido (la música se agrega en TikTok).`
                  : `Este navegador solo puede generar WebM (${Math.round(dura)} s, sin sonido). Para MP4, usa Chrome actualizado o Safari.`}
          </p>
          {estado.tipo === "error" && (
            <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
              {estado.mensaje}
            </p>
          )}
        </div>
        <TextoTikTok texto={texto} />
      </div>
    </div>
  );
}
