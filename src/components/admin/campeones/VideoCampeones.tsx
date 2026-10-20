// src/components/admin/campeones/VideoCampeones.tsx
//
// Video vertical 9:16 (1080×1920) "Campeones de la semana" para TikTok,
// Instagram y YouTube, con la voz de ElevenLabs y la canción de fondo. Es
// el mismo reproductor del video de la Palabra del Día (TarjetaTikTok):
// la vista previa y el archivo que se descarga salen del mismo dibujo
// (src/lib/juegos/campeones) y del mismo plan de sonido.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { CampeonesSemana } from "@/types";
import { ALTO, ANCHO } from "@/lib/palabra/video/lienzo";
import { formatoDisponible, grabarLienzo, type Formato } from "@/lib/palabra/video/grabar";
import { tocarSonido, type Reproduccion } from "@/lib/palabra/video/sonido";
import { dibujarGuiasTikTok, PORTADA_DURA } from "@/lib/palabra/video/portada";
import { dibujarCuadro, duracion, lineaDeTiempo, type Escena } from "@/lib/juegos/campeones/escenas";
import { cargarRecursos, type Recursos } from "@/lib/juegos/campeones/recursos";
import { guionSemana } from "@/lib/juegos/campeones/guion";
import { planConVoz, planSinVoz } from "@/lib/juegos/campeones/sincronia";
import { portadaPng } from "@/lib/juegos/campeones/portada";
import { PanelVozTikTok } from "../PanelVozTikTok";
import { ControlesVistaTikTok } from "../ControlesVistaTikTok";
import { useSonidoTikTok } from "../useSonidoTikTok";
import { TextosCampeones } from "./TextosCampeones";

type Estado = { tipo: "cargando" } | { tipo: "listo" } | { tipo: "grabando"; avance: number } | { tipo: "error"; mensaje: string };

const API_VOZ = "/api/admin/juegos/tiktok/voz";
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

function descargarArchivo(archivo: Blob, nombre: string): void {
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function VideoCampeones({ c }: { c: CampeonesSemana }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [recursos, setRecursos] = useState<Recursos | null>(null);
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [tocando, setTocando] = useState(false);
  const [segundo, setSegundo] = useState(0);
  const [guias, setGuias] = useState(false);
  const reloj = useRef({ t: 0, ultimo: 0 });
  const sonando = useRef<Reproduccion | null>(null);

  const audio = useSonidoTikTok(c.lunes, API_VOZ);
  const sugerido = useMemo(() => guionSemana(c), [c]);
  const conVoz = Boolean(audio.voz && audio.sonido.voz);

  const { escenas, plan } = useMemo(() => {
    if (!recursos) return { escenas: [] as Escena[], plan: planSinVoz(0) };
    const base = lineaDeTiempo(recursos);
    if (!audio.voz || !audio.sonido.voz) return { escenas: base, plan: planSinVoz(duracion(base)) };
    const p = planConVoz(base.map((e) => e.id), audio.voz.alineacion, audio.sonido.voz.duration);
    return { escenas: lineaDeTiempo(recursos, p.duraciones), plan: p };
  }, [recursos, audio.voz, audio.sonido.voz]);
  const dura = plan.dura;

  const [formato, setFormato] = useState<Formato | null | undefined>(undefined);
  useEffect(() => setFormato(formatoDisponible()), []);

  useEffect(() => {
    let vivo = true;
    setEstado({ tipo: "cargando" });
    cargarRecursos(c)
      .then((r) => {
        if (!vivo) return;
        setRecursos(r);
        setEstado({ tipo: "listo" });
      })
      .catch(() => vivo && setEstado({ tipo: "error", mensaje: "No se pudo preparar el video." }));
    return () => {
      vivo = false;
    };
  }, [c]);

  const pintar = useCallback(
    (seg: number) => {
      const ctx = lienzo.current?.getContext("2d");
      if (ctx && recursos) dibujarCuadro(ctx, recursos, escenas, seg);
    },
    [recursos, escenas]
  );

  // Las guías de TikTok solo se pintan en la vista previa, nunca al grabar.
  const pintarVista = useCallback(
    (seg: number) => {
      pintar(seg);
      const ctx = lienzo.current?.getContext("2d");
      if (ctx && guias && seg < PORTADA_DURA) dibujarGuiasTikTok(ctx);
    },
    [pintar, guias]
  );

  const callar = useCallback(() => {
    sonando.current?.detener();
    sonando.current = null;
  }, []);

  // Vista previa en bucle con sonido (se detiene mientras se graba).
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
          r.t = sonando.current && siguiente < dura ? sonando.current.segundo() : siguiente;
        }
      }
      r.ultimo = ahora;
      pintarVista(Math.min(Math.max(r.t, 0), dura - 0.001));
      setSegundo(Math.floor(Math.min(Math.max(r.t, 0), dura)));
      id = requestAnimationFrame(cuadro);
    };
    id = requestAnimationFrame(cuadro);
    return () => {
      cancelAnimationFrame(id);
      callar();
    };
  }, [recursos, estado.tipo, tocando, dura, pintarVista, plan, contexto, sonido, callar]);

  const alternar = async () => {
    if (!tocando) await audio.despertar();
    setTocando((v) => !v);
  };

  const verEscena = (e: Escena) => {
    reloj.current.t = e.id === "portada" ? 0 : e.inicio + e.dura - 0.5;
    setTocando(false);
  };

  const descargarPortada = async () => {
    if (!recursos) return;
    try {
      descargarArchivo(await portadaPng(recursos), `portada-campeones-${c.lunes}.png`);
    } catch (e) {
      setEstado({ tipo: "error", mensaje: e instanceof Error ? e.message : "No se pudo generar la portada." });
    }
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
                grabacion = tocarSonido(ctxAudio, sonido, plan, 0, [salida, ctxAudio.destination]);
                return grabacion.segundo;
              },
            }
          : undefined
      );
      descargarArchivo(archivo, `campeones-semana-${c.lunes}.${formato.extension}`);
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

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <div className="flex flex-col gap-3 w-full max-w-[360px]">
        <div className="relative w-full" style={{ aspectRatio: "9 / 16" }}>
          <canvas
            ref={lienzo}
            width={ANCHO}
            height={ALTO}
            aria-label="Vista previa del video Campeones de la semana"
            className="absolute inset-0 w-full h-full rounded-2xl"
            style={{ background: "#0A0A12", border: "1px solid var(--color-border)" }}
          />
          {estado.tipo === "cargando" && (
            <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
              <Loader2 size={16} className="animate-spin" /> Preparando video…
            </p>
          )}
        </div>
        <ControlesVistaTikTok
          listo={Boolean(recursos)}
          grabando={grabando}
          tocando={tocando}
          segundo={segundo}
          dura={dura}
          conVoz={conVoz}
          escenas={escenas}
          guias={guias}
          alAlternar={alternar}
          alVerEscena={verEscena}
          alCambiarGuias={setGuias}
          alDescargarPortada={descargarPortada}
        />
      </div>

      <div className="flex flex-col gap-4 w-full max-w-md">
        <PanelVozTikTok
          fecha={c.lunes}
          sugerido={sugerido}
          voz={audio.voz}
          bajandoVoz={audio.bajandoVoz}
          deshabilitado={grabando}
          api={API_VOZ}
          periodo="semana"
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
            className="inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-lg text-base font-semibold disabled:opacity-60"
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
        <TextosCampeones c={c} />
      </div>
    </div>
  );
}
