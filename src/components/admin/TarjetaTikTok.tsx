// src/components/admin/TarjetaTikTok.tsx
//
// Video vertical 9:16 (1080×1920) de la Palabra del Día para TikTok, con
// la voz de ElevenLabs y la canción de fondo. La vista previa y el archivo
// que se descarga salen del mismo dibujo (src/lib/palabra/video) y del
// mismo plan de sonido (sincronia.ts), así lo que se ve y se oye es lo que
// se sube. Con nombre solo quien dio permiso, en forma corta ("Arturo
// O."); los demás se resumen en "y N hermanos más". Sin iglesia ni correos.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Pause, Play } from "lucide-react";
import type { PalabraTarjetaTikTok } from "@/types";
import { ALTO, ANCHO } from "@/lib/palabra/video/lienzo";
import { dibujarCuadro, lineaDeTiempo, type Recursos } from "@/lib/palabra/video/escenas";
import { cargarRecursos } from "@/lib/palabra/video/recursos";
import { formatoDisponible, grabarLienzo, type Formato } from "@/lib/palabra/video/grabar";
import { descripcionTikTok } from "@/lib/palabra/video/descripcion";
import { guionDelDia } from "@/lib/palabra/video/guion";
import { planConVoz, planSinVoz } from "@/lib/palabra/video/sincronia";
import { tocarSonido, type Reproduccion } from "@/lib/palabra/video/sonido";
import { TextoTikTok } from "./TextoTikTok";
import { PanelVozTikTok } from "./PanelVozTikTok";
import { useSonidoTikTok } from "./useSonidoTikTok";

type Estado = { tipo: "cargando" } | { tipo: "listo" } | { tipo: "grabando"; avance: number } | { tipo: "error"; mensaje: string };

/** Silencio entre una vuelta y otra de la vista previa. */
const PAUSA_BUCLE = 1.2;

function avisoFormato(formato: Formato | null | undefined, grabando: boolean, dura: number, conVoz: boolean): string {
  if (formato === undefined) return "";
  if (!formato) return "Este navegador no puede generar video. Ábrelo en Chrome o Safari actualizados.";
  if (grabando) return "No cambies de pestaña ni minimices la ventana hasta que termine (dura lo mismo que el video).";
  const sonido = !formato.conAudio ? "sin sonido (este navegador no graba audio)" : conVoz ? "con voz y música" : "solo con música (genera la voz primero)";
  return formato.extension === "mp4"
    ? `Se genera un MP4 vertical de ${Math.round(dura)} segundos, ${sonido}.`
    : `Este navegador solo puede generar WebM (${Math.round(dura)} s, ${sonido}). Para MP4, usa Chrome actualizado o Safari.`;
}

export function TarjetaTikTok({ t }: { t: PalabraTarjetaTikTok }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [recursos, setRecursos] = useState<Recursos | null>(null);
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  // Empieza en pausa: el navegador no deja sonar nada hasta el primer clic.
  const [tocando, setTocando] = useState(false);
  const [segundo, setSegundo] = useState(0);
  // Tiempo de la vista previa: se guarda aparte para poder pausar y saltar de escena.
  const reloj = useRef({ t: 0, ultimo: 0 });
  const sonando = useRef<Reproduccion | null>(null);

  const audio = useSonidoTikTok(t.fecha);
  const sugerido = useMemo(() => guionDelDia(t), [t]);
  const conVoz = Boolean(audio.voz && audio.sonido.voz);

  // Las escenas de siempre, y con voz, alargadas para ir con lo que dice.
  const { escenas, plan } = useMemo(() => {
    if (!recursos) return { escenas: [], plan: planSinVoz([]) };
    const base = lineaDeTiempo(recursos);
    if (!audio.voz || !audio.sonido.voz) return { escenas: base, plan: planSinVoz(base) };
    const p = planConVoz(base.map((e) => e.id), audio.voz.alineacion, audio.sonido.voz.duration);
    return { escenas: lineaDeTiempo(recursos, p.duraciones), plan: p };
  }, [recursos, audio.voz, audio.sonido.voz]);
  const dura = plan.dura;

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

  const callar = useCallback(() => {
    sonando.current?.detener();
    sonando.current = null;
  }, []);

  // Vista previa en bucle con sonido (se detiene mientras se graba: la grabación pinta sola).
  const { contexto, sonido } = audio;
  useEffect(() => {
    if (!recursos || estado.tipo === "grabando" || dura <= 0) return;
    const ctxAudio = contexto();
    const sonar = (desde: number) => {
      callar();
      if (tocando && ctxAudio?.state === "running" && desde < dura) {
        sonando.current = tocarSonido(ctxAudio, sonido, plan, desde, [ctxAudio.destination]);
      }
    };
    let id = 0;
    reloj.current.ultimo = performance.now();
    reloj.current.t = Math.min(reloj.current.t, dura);
    sonar(reloj.current.t);
    const cuadro = (ahora: number) => {
      const r = reloj.current;
      if (tocando) {
        const siguiente = r.t + (ahora - r.ultimo) / 1000;
        if (siguiente >= dura + PAUSA_BUCLE) {
          r.t = 0;
          sonar(0);
        } else {
          // Mientras suena, manda el reloj del audio: así la voz y las escenas no se desfasan.
          r.t = sonando.current && siguiente < dura ? sonando.current.segundo() : siguiente;
        }
      }
      r.ultimo = ahora;
      pintar(Math.min(Math.max(r.t, 0), dura - 0.001));
      setSegundo(Math.floor(Math.min(Math.max(r.t, 0), dura)));
      id = requestAnimationFrame(cuadro);
    };
    id = requestAnimationFrame(cuadro);
    return () => {
      cancelAnimationFrame(id);
      callar();
    };
  }, [recursos, estado.tipo, tocando, dura, pintar, plan, contexto, sonido, callar]);

  const alternar = async () => {
    if (!tocando) await audio.despertar();
    setTocando((v) => !v);
  };

  const verEscena = (inicio: number, largo: number) => {
    // Casi al final de la escena, cuando ya se armó completa.
    reloj.current.t = inicio + largo - 0.5;
    setTocando(false);
  };

  const descargar = async () => {
    if (!lienzo.current || !formato || !recursos) return;
    const ctxAudio = await audio.despertar();
    setTocando(false);
    setEstado({ tipo: "grabando", avance: 0 });
    let grabacion: Reproduccion | null = null;
    try {
      const salida = ctxAudio?.createMediaStreamDestination();
      const archivo = await grabarLienzo(
        lienzo.current,
        formato,
        dura,
        pintar,
        (avance) => setEstado({ tipo: "grabando", avance }),
        ctxAudio && salida
          ? {
              pistas: salida.stream.getAudioTracks(),
              empezar: () => {
                // También a las bocinas, para oír cómo va quedando.
                grabacion = tocarSonido(ctxAudio, sonido, plan, 0, [salida, ctxAudio.destination]);
                return grabacion.segundo;
              },
            }
          : undefined
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
      setEstado({ tipo: "listo" });
    } catch (e) {
      setEstado({ tipo: "error", mensaje: e instanceof Error ? e.message : "No se pudo grabar el video." });
    } finally {
      (grabacion as Reproduccion | null)?.detener();
    }
  };

  const grabando = estado.tipo === "grabando";
  const generandoOCargando = audio.voz === undefined || audio.bajandoVoz || !audio.sonido.musica;
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
            onClick={alternar}
            aria-label={tocando ? "Pausar" : "Reproducir con sonido"}
          >
            {tocando ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <span className="text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>
            {segundo}s / {Math.round(dura)}s{conVoz ? " · con voz" : ""}
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
        <PanelVozTikTok
          fecha={t.fecha}
          sugerido={sugerido}
          voz={audio.voz}
          bajandoVoz={audio.bajandoVoz}
          deshabilitado={grabando}
          alGenerar={(nueva) => {
            setTocando(false);
            reloj.current.t = 0;
            audio.cambiarVoz(nueva);
          }}
        />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={descargar}
            disabled={!recursos || !formato || grabando || generandoOCargando}
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
            {avisoFormato(formato, grabando, dura, conVoz)}
          </p>
          {(estado.tipo === "error" || audio.error) && (
            <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
              {estado.tipo === "error" ? estado.mensaje : audio.error}
            </p>
          )}
        </div>
        <TextoTikTok texto={texto} />
      </div>
    </div>
  );
}
