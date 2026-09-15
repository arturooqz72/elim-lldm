"use client";

import { useEffect, useRef, useState } from "react";
import { useMaybeRoomContext, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Radio, Mic, Users, MonitorSpeaker, Loader2, AlertCircle, Square, Play, Pause, Volume2, Copy, Check, MessageCircleHeart } from "lucide-react";
import {
  AudioMixer,
  captureTabAudio,
  connectRadioBridge,
  startStreamingToBridge,
  type LiveClip,
} from "@/lib/radio-broadcast";
import { createClient } from "@/lib/supabase/client";
import { AudioLevelMeter } from "./AudioLevelMeter";
import type { ProgramaAudio, Saludo } from "@/types";

interface SaludoEnVivo extends Saludo {
  signedUrl: string | null;
}

type Status = "idle" | "connecting" | "live" | "error";

interface RadioBroadcastPanelProps {
  platikaId: string;
  programaAudios?: ProgramaAudio[];
}

// LiveKitRoom.tsx renders the sidebar (and this component inside it) both
// before a room connection exists (loading/error states) and after. useTracks
// throws if called outside a Room context, which would crash the whole page
// during those pre-connection states. useMaybeRoomContext never throws, so it
// gates whether the real panel (and its useTracks call) mounts at all.
export function RadioBroadcastPanel({ platikaId, programaAudios }: RadioBroadcastPanelProps) {
  const room = useMaybeRoomContext();
  if (!room) return null;
  return <ConnectedRadioBroadcastPanel platikaId={platikaId} programaAudios={programaAudios} />;
}

function ConnectedRadioBroadcastPanel({ platikaId, programaAudios }: RadioBroadcastPanelProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [roomOn, setRoomOn] = useState(false);
  const [micVolume, setMicVolume] = useState(1);
  const [pcOn, setPcOn] = useState(false);
  const [pcLoading, setPcLoading] = useState(false);
  const [pcVolume, setPcVolume] = useState(1);

  const audios = programaAudios ?? [];
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(audios[0]?.id ?? null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  // Clip interactivo del "Banco de audios" mientras se está en vivo — se
  // puede pausar/reanudar/detener y ajustar de volumen en tiempo real. Solo
  // el botón explícito "Salir de la radio" corta la transmisión — ningún
  // audio del banco la desconecta por sí solo.
  const [liveAudioId, setLiveAudioId] = useState<string | null>(null);
  const [liveClipPlaying, setLiveClipPlaying] = useState(false);
  const [liveClipLoading, setLiveClipLoading] = useState(false);
  const [liveClipVolume, setLiveClipVolume] = useState(1);
  const liveClipRef = useRef<LiveClip | null>(null);

  // Música de fondo en loop, independiente del banco de audios — suena
  // continuamente hasta que se detenga a mano, con su propio volumen para
  // bajarla mientras se habla y subirla en los silencios.
  const [bgMusicAudioId, setBgMusicAudioId] = useState<string>("");
  const [bgMusicPlaying, setBgMusicPlaying] = useState(false);
  const [bgMusicLoading, setBgMusicLoading] = useState(false);
  const [bgMusicVolume, setBgMusicVolume] = useState(0.4);
  const bgMusicRef = useRef<LiveClip | null>(null);

  // Saludos que la gente deja en vivo por /platikas/[id]/saludo (compartido
  // por WhatsApp) mientras esta transmisión está activa — llegan por
  // Realtime y se reproducen igual que un clip del banco de audios, pero en
  // su propio slot independiente.
  const [saludos, setSaludos] = useState<SaludoEnVivo[]>([]);
  const [activeSaludoId, setActiveSaludoId] = useState<string | null>(null);
  const [saludoPlaying, setSaludoPlaying] = useState(false);
  const [saludoLoading, setSaludoLoading] = useState(false);
  const [saludoVolume, setSaludoVolume] = useState(1);
  const [linkCopied, setLinkCopied] = useState(false);
  const activeSaludoRef = useRef<LiveClip | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mixerRef = useRef<AudioMixer | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const pcTrackRef = useRef<MediaStreamTrack | null>(null);

  const micTracks = useTracks([{ source: Track.Source.Microphone, withPlaceholder: false }]);
  const localMicTrack = micTracks.find((t) => t.participant.isLocal)?.publication?.track?.mediaStreamTrack;

  function cleanup() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    wsRef.current = null;
    liveClipRef.current?.disconnect();
    liveClipRef.current = null;
    bgMusicRef.current?.disconnect();
    bgMusicRef.current = null;
    activeSaludoRef.current?.disconnect();
    activeSaludoRef.current = null;
    mixerRef.current?.close();
    mixerRef.current = null;
    pcTrackRef.current?.stop();
    pcTrackRef.current = null;
    setMicOn(false);
    setRoomOn(false);
    setPcOn(false);
    setLiveAudioId(null);
    setLiveClipPlaying(false);
    setBgMusicPlaying(false);
    setActiveSaludoId(null);
    setSaludoPlaying(false);

    const supabase = createClient();
    void supabase.from("platikas").update({ radio_output_active: false }).eq("id", platikaId);
  }

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync mic/room toggles against the live set of LiveKit mic tracks
  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer || status !== "live") return;

    for (const ref of micTracks) {
      const mediaTrack = ref.publication?.track?.mediaStreamTrack;
      if (!mediaTrack) continue;
      const key = `livekit-${ref.participant.sid}`;
      const shouldBeOn = ref.participant.isLocal ? micOn : roomOn;

      if (shouldBeOn) {
        mixer.connect(key, new MediaStream([mediaTrack]));
        if (ref.participant.isLocal) mixer.setVolume(key, micVolume);
      } else if (mixer.has(key)) {
        mixer.disconnect(key);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micTracks, micOn, roomOn, micVolume, status]);

  // Carga los saludos ya dejados para esta transmisión y se suscribe a los
  // nuevos por Realtime, para que aparezcan en la cola sin recargar la
  // página mientras alguien los va dejando desde /platikas/[id]/saludo.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function signAndAdd(row: Saludo) {
      const { data } = await supabase.storage.from("saludos").createSignedUrl(row.audio_path, 3600);
      if (cancelled) return;
      setSaludos((prev) => {
        if (prev.some((s) => s.id === row.id)) return prev;
        return [...prev, { ...row, signedUrl: data?.signedUrl ?? null }];
      });
    }

    async function loadInitial() {
      const { data } = await supabase
        .from("saludos")
        .select("*")
        .eq("platika_id", platikaId)
        .order("created_at", { ascending: true });
      if (cancelled || !data) return;
      const withUrls = await Promise.all(
        (data as Saludo[]).map(async (row) => {
          const { data: signed } = await supabase.storage.from("saludos").createSignedUrl(row.audio_path, 3600);
          return { ...row, signedUrl: signed?.signedUrl ?? null };
        })
      );
      if (!cancelled) setSaludos(withUrls);
    }

    void loadInitial();

    const channel = supabase
      .channel(`saludos-en-vivo-${platikaId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "saludos", filter: `platika_id=eq.${platikaId}` },
        (payload) => void signAndAdd(payload.new as Saludo)
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [platikaId]);

  async function markSaludoPlayed(id: string) {
    const supabase = createClient();
    const playedAt = new Date().toISOString();
    setSaludos((prev) => prev.map((s) => (s.id === id ? { ...s, played_at: playedAt } : s)));
    await supabase.from("saludos").update({ played_at: playedAt }).eq("id", id);
  }

  async function toggleSaludo(item: SaludoEnVivo) {
    const mixer = mixerRef.current;
    if (!mixer || !item.signedUrl) return;

    if (activeSaludoId === item.id && activeSaludoRef.current) {
      const clip = activeSaludoRef.current;
      if (clip.isPlaying) {
        clip.pause();
        setSaludoPlaying(false);
      } else {
        clip.play();
        setSaludoPlaying(true);
      }
      return;
    }

    activeSaludoRef.current?.disconnect();
    activeSaludoRef.current = null;
    setActiveSaludoId(item.id);
    setSaludoPlaying(false);
    setSaludoLoading(true);
    setSaludoVolume(1);
    try {
      const clip = await mixer.loadClip(item.signedUrl);
      clip.setVolume(1);
      clip.onEnded = () => setSaludoPlaying(false);
      clip.play();
      activeSaludoRef.current = clip;
      setSaludoPlaying(true);
      if (!item.played_at) void markSaludoPlayed(item.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo cargar el saludo");
      setActiveSaludoId(null);
    } finally {
      setSaludoLoading(false);
    }
  }

  function stopSaludo() {
    activeSaludoRef.current?.disconnect();
    activeSaludoRef.current = null;
    setActiveSaludoId(null);
    setSaludoPlaying(false);
  }

  function changeSaludoVolume(volume: number) {
    setSaludoVolume(volume);
    activeSaludoRef.current?.setVolume(volume);
  }

  function copyLiveGreetingLink() {
    const url = `${window.location.origin}/platikas/${platikaId}/saludo`;
    void navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  async function startBroadcast() {
    setStatus("connecting");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/platikas/${platikaId}/radio-key`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo iniciar la transmisión");

      const ws = await connectRadioBridge(data.wsUrl, data.key);
      wsRef.current = ws;

      const mixer = new AudioMixer();
      mixerRef.current = mixer;
      recorderRef.current = startStreamingToBridge(mixer.destination.stream, ws);

      ws.addEventListener("close", () => {
        if (wsRef.current !== ws) return;
        cleanup();
        setStatus("error");
        setErrorMsg("Se perdió la conexión con la radio.");
      });

      setMicOn(true);
      setStatus("live");

      const supabase = createClient();
      await supabase.from("platikas").update({ radio_output_active: true }).eq("id", platikaId);
    } catch (err) {
      wsRef.current?.close();
      cleanup();
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "No se pudo conectar con la radio");
    }
  }

  function stopBroadcast() {
    wsRef.current?.close();
    cleanup();
    setStatus("idle");
    setErrorMsg("");
  }

  async function togglePc() {
    const mixer = mixerRef.current;
    if (!mixer) return;
    setErrorMsg("");

    if (pcOn) {
      mixer.disconnect("pc-audio");
      pcTrackRef.current?.stop();
      pcTrackRef.current = null;
      setPcOn(false);
      return;
    }

    setPcLoading(true);
    try {
      const track = await captureTabAudio();
      pcTrackRef.current = track;
      mixer.connect("pc-audio", new MediaStream([track]));
      mixer.setVolume("pc-audio", pcVolume);
      track.addEventListener("ended", () => {
        mixer.disconnect("pc-audio");
        pcTrackRef.current = null;
        setPcOn(false);
      });
      setPcOn(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo compartir el audio de la PC");
    } finally {
      setPcLoading(false);
    }
  }

  function previewClip(audio: ProgramaAudio) {
    if (previewingId === audio.id) {
      previewRef.current?.pause();
      setPreviewingId(null);
      return;
    }
    if (!previewRef.current) previewRef.current = new Audio();
    previewRef.current.src = audio.audio_url;
    previewRef.current.onended = () => setPreviewingId(null);
    void previewRef.current.play();
    setPreviewingId(audio.id);
  }

  async function entrarALaRadioConIntro() {
    await startBroadcast();
    const mixer = mixerRef.current;
    if (!mixer) return;
    const clip = audios.find((a) => a.id === selectedAudioId);
    if (!clip) return;
    await new Promise((resolve) => setTimeout(resolve, 5000));
    if (mixerRef.current !== mixer) return;
    await mixer.playClip(clip.audio_url);
  }

  async function toggleLiveClip(audio: ProgramaAudio) {
    const mixer = mixerRef.current;
    if (!mixer) return;

    // Mismo clip ya cargado: play/pausa sin volver a descargarlo.
    if (liveAudioId === audio.id && liveClipRef.current) {
      const clip = liveClipRef.current;
      if (clip.isPlaying) {
        clip.pause();
        setLiveClipPlaying(false);
      } else {
        clip.play();
        setLiveClipPlaying(true);
      }
      return;
    }

    // Cambiar de clip: soltar el anterior y cargar el nuevo. El volumen
    // SIEMPRE arranca en 100% para el clip nuevo — si se dejaba el nivel
    // del clip anterior (ej. lo bajaste para que se apagara solo), el
    // siguiente audio heredaba ese mismo volumen bajo y "no se escuchaba".
    liveClipRef.current?.disconnect();
    liveClipRef.current = null;
    setLiveAudioId(audio.id);
    setLiveClipPlaying(false);
    setLiveClipLoading(true);
    setLiveClipVolume(1);
    try {
      const clip = await mixer.loadClip(audio.audio_url);
      clip.setVolume(1);
      clip.onEnded = () => {
        setLiveClipPlaying(false);
      };
      clip.play();
      liveClipRef.current = clip;
      setLiveClipPlaying(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo cargar el audio");
      setLiveAudioId(null);
    } finally {
      setLiveClipLoading(false);
    }
  }

  function stopLiveClip() {
    liveClipRef.current?.disconnect();
    liveClipRef.current = null;
    setLiveAudioId(null);
    setLiveClipPlaying(false);
  }

  function changeLiveClipVolume(volume: number) {
    setLiveClipVolume(volume);
    liveClipRef.current?.setVolume(volume);
  }

  async function toggleBgMusic() {
    const mixer = mixerRef.current;
    if (!mixer || !bgMusicAudioId) return;

    // Ya cargada: solo play/pausa.
    if (bgMusicRef.current) {
      const clip = bgMusicRef.current;
      if (clip.isPlaying) {
        clip.pause();
        setBgMusicPlaying(false);
      } else {
        clip.play();
        setBgMusicPlaying(true);
      }
      return;
    }

    const audio = audios.find((a) => a.id === bgMusicAudioId);
    if (!audio) return;

    setBgMusicLoading(true);
    try {
      const clip = await mixer.loadClip(audio.audio_url);
      clip.setLoop(true);
      clip.setVolume(bgMusicVolume);
      clip.play();
      bgMusicRef.current = clip;
      setBgMusicPlaying(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo cargar la música de fondo");
    } finally {
      setBgMusicLoading(false);
    }
  }

  function changeBgMusicTrack(audioId: string) {
    bgMusicRef.current?.disconnect();
    bgMusicRef.current = null;
    setBgMusicAudioId(audioId);
    setBgMusicPlaying(false);
  }

  function changeBgMusicVolume(volume: number) {
    setBgMusicVolume(volume);
    bgMusicRef.current?.setVolume(volume);
  }

  function changePcVolume(volume: number) {
    setPcVolume(volume);
    mixerRef.current?.setVolume("pc-audio", volume);
  }

  if (status === "idle" || status === "connecting") {
    if (audios.length === 0) {
      return (
        <div className="flex flex-col gap-2">
          <MicSoundcheck track={localMicTrack} volume={micVolume} onVolumeChange={setMicVolume} />
          <button
            type="button"
            onClick={startBroadcast}
            disabled={status === "connecting"}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            {status === "connecting" ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
            {status === "connecting" ? "Conectando…" : "Salir al aire a la radio"}
          </button>
          <SaludosEnVivoSection
            saludos={saludos}
            activeSaludoId={activeSaludoId}
            saludoLoading={saludoLoading}
            saludoPlaying={saludoPlaying}
            saludoVolume={saludoVolume}
            linkCopied={linkCopied}
            canPlay={false}
            onCopyLink={copyLiveGreetingLink}
            onToggle={toggleSaludo}
            onStop={stopSaludo}
            onVolumeChange={changeSaludoVolume}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        <MicSoundcheck track={localMicTrack} volume={micVolume} onVolumeChange={setMicVolume} />
        <SaludosEnVivoSection
          saludos={saludos}
          activeSaludoId={activeSaludoId}
          saludoLoading={saludoLoading}
          saludoPlaying={saludoPlaying}
          saludoVolume={saludoVolume}
          linkCopied={linkCopied}
          canPlay={false}
          onCopyLink={copyLiveGreetingLink}
          onToggle={toggleSaludo}
          onStop={stopSaludo}
          onVolumeChange={changeSaludoVolume}
        />
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          Elige tu intro
        </p>
        {audios.map((audio) => (
          <div key={audio.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedAudioId(audio.id)}
              className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-left"
              style={{
                background: selectedAudioId === audio.id ? "rgba(212,160,23,0.15)" : "var(--color-surface)",
                border: `1px solid ${selectedAudioId === audio.id ? "rgba(212,160,23,0.4)" : "var(--color-border)"}`,
                color: selectedAudioId === audio.id ? "var(--color-primary)" : "var(--color-text)",
              }}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  border: "1.5px solid currentColor",
                  background: selectedAudioId === audio.id ? "currentColor" : "transparent",
                }}
              />
              {audio.titulo}
            </button>
            <button
              type="button"
              onClick={() => previewClip(audio)}
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
              aria-label="Escuchar"
            >
              <Play size={12} style={{ color: previewingId === audio.id ? "var(--color-primary)" : "var(--color-text-muted)" }} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={entrarALaRadioConIntro}
          disabled={status === "connecting" || !selectedAudioId}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all mt-1"
          style={{ background: "var(--color-primary)", color: "#000", opacity: !selectedAudioId ? 0.6 : 1 }}
        >
          {status === "connecting" ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
          {status === "connecting" ? "Conectando…" : "Salir al aire a la radio"}
        </button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col gap-2">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.3)",
            color: "var(--color-destructive)",
          }}
        >
          <AlertCircle size={14} className="shrink-0" />
          {errorMsg}
        </div>
        <button
          type="button"
          onClick={startBroadcast}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          <Radio size={14} />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2"
      style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.3)" }}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--color-primary)" }}>
          <Radio size={13} />
          En vivo en la radio
        </span>
        <button
          type="button"
          onClick={stopBroadcast}
          aria-label="Detener transmisión"
          style={{ color: "var(--color-destructive)" }}
        >
          <Square size={14} />
        </button>
      </div>

      <SourceToggle
        icon={Mic}
        label="Mi micrófono"
        active={micOn}
        onToggle={() => setMicOn((v) => !v)}
        meterTrack={micOn ? localMicTrack : null}
      />
      {micOn && (
        <div className="flex items-center gap-2 px-0.5 -mt-1">
          <Volume2 size={12} style={{ color: "var(--color-text-muted)" }} />
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={micVolume}
            onChange={(e) => setMicVolume(Number(e.target.value))}
            className="flex-1 h-1"
            style={{ accentColor: "var(--color-primary)" }}
            aria-label="Volumen de mi micrófono"
          />
          <span className="text-[10px] w-8 text-right shrink-0" style={{ color: "var(--color-text-muted)" }}>
            {Math.round(micVolume * 100)}%
          </span>
        </div>
      )}
      <SourceToggle icon={Users} label="Sala completa" active={roomOn} onToggle={() => setRoomOn((v) => !v)} />
      <SourceToggle
        icon={MonitorSpeaker}
        label="Audio de mi PC"
        active={pcOn}
        loading={pcLoading}
        onToggle={togglePc}
        meterTrack={pcOn ? pcTrackRef.current : null}
      />
      {pcOn && (
        <div className="flex items-center gap-2 px-0.5 -mt-1">
          <Volume2 size={12} style={{ color: "var(--color-text-muted)" }} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={pcVolume}
            onChange={(e) => changePcVolume(Number(e.target.value))}
            className="flex-1 h-1"
            style={{ accentColor: "var(--color-primary)" }}
            aria-label="Volumen del audio de la PC"
          />
          <span className="text-[10px] w-8 text-right shrink-0" style={{ color: "var(--color-text-muted)" }}>
            {Math.round(pcVolume * 100)}%
          </span>
        </div>
      )}

      {!micOn && !roomOn && !pcOn && !liveClipPlaying && !bgMusicPlaying && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{
            background: "rgba(255,68,68,0.1)",
            border: "1px solid rgba(255,68,68,0.3)",
            color: "var(--color-live)",
          }}
        >
          <AlertCircle size={14} className="shrink-0" />
          Sin ninguna fuente activa — no se está transmitiendo nada real ahora mismo.
        </div>
      )}

      {audios.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1" style={{ borderTop: "1px solid rgba(212,160,23,0.2)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider pt-1" style={{ color: "var(--color-text-muted)" }}>
            Música de fondo
          </p>
          <div className="flex items-center gap-1.5">
            <select
              value={bgMusicAudioId}
              onChange={(e) => changeBgMusicTrack(e.target.value)}
              className="flex-1 rounded-lg px-2 py-1.5 text-xs outline-none"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              <option value="">Elegir audio…</option>
              {audios.map((audio) => (
                <option key={audio.id} value={audio.id}>
                  {audio.titulo}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void toggleBgMusic()}
              disabled={!bgMusicAudioId || bgMusicLoading}
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: bgMusicPlaying ? "rgba(212,160,23,0.2)" : "var(--color-surface)",
                border: "1px solid var(--color-border)",
                opacity: !bgMusicAudioId ? 0.5 : 1,
              }}
              aria-label={bgMusicPlaying ? "Pausar música de fondo" : "Reproducir música de fondo"}
            >
              {bgMusicLoading ? (
                <Loader2 size={12} className="animate-spin" style={{ color: "var(--color-primary)" }} />
              ) : bgMusicPlaying ? (
                <Pause size={12} style={{ color: "var(--color-primary)" }} />
              ) : (
                <Play size={12} style={{ color: "var(--color-text)" }} />
              )}
            </button>
          </div>
          <div className="flex items-center gap-2 px-0.5">
            <Volume2 size={12} style={{ color: "var(--color-text-muted)" }} />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={bgMusicVolume}
              onChange={(e) => changeBgMusicVolume(Number(e.target.value))}
              className="flex-1 h-1"
              style={{ accentColor: "var(--color-primary)" }}
              aria-label="Volumen de la música de fondo"
            />
            <span className="text-[10px] w-8 text-right shrink-0" style={{ color: "var(--color-text-muted)" }}>
              {Math.round(bgMusicVolume * 100)}%
            </span>
          </div>
        </div>
      )}

      {audios.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1" style={{ borderTop: "1px solid rgba(212,160,23,0.2)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider pt-1" style={{ color: "var(--color-text-muted)" }}>
            Banco de audios
          </p>
          {audios.map((audio) => {
            const isActive = liveAudioId === audio.id;
            const isLoadingThis = isActive && liveClipLoading;
            const isPlayingThis = isActive && liveClipPlaying;
            return (
              <div key={audio.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void toggleLiveClip(audio)}
                  disabled={liveClipLoading && !isActive}
                  className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left"
                  style={{
                    background: isActive ? "rgba(212,160,23,0.15)" : "var(--color-surface)",
                    border: `1px solid ${isActive ? "rgba(212,160,23,0.4)" : "var(--color-border)"}`,
                    color: isActive ? "var(--color-primary)" : "var(--color-text)",
                    opacity: liveClipLoading && !isActive ? 0.5 : 1,
                  }}
                >
                  {isLoadingThis ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : isPlayingThis ? (
                    <Pause size={11} />
                  ) : (
                    <Play size={11} />
                  )}
                  {audio.titulo}
                </button>
                {isActive && (
                  <button
                    type="button"
                    onClick={stopLiveClip}
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
                    aria-label="Detener"
                    title="Detener"
                  >
                    <Square size={10} style={{ color: "var(--color-text-muted)" }} />
                  </button>
                )}
              </div>
            );
          })}
          {liveAudioId && (
            <div className="flex items-center gap-2 px-0.5 pt-1">
              <Volume2 size={12} style={{ color: "var(--color-text-muted)" }} />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={liveClipVolume}
                onChange={(e) => changeLiveClipVolume(Number(e.target.value))}
                className="flex-1 h-1"
                style={{ accentColor: "var(--color-primary)" }}
                aria-label="Volumen del audio en vivo"
              />
              <span className="text-[10px] w-8 text-right shrink-0" style={{ color: "var(--color-text-muted)" }}>
                {Math.round(liveClipVolume * 100)}%
              </span>
            </div>
          )}
        </div>
      )}

      <SaludosEnVivoSection
        saludos={saludos}
        activeSaludoId={activeSaludoId}
        saludoLoading={saludoLoading}
        saludoPlaying={saludoPlaying}
        saludoVolume={saludoVolume}
        linkCopied={linkCopied}
        canPlay
        onCopyLink={copyLiveGreetingLink}
        onToggle={toggleSaludo}
        onStop={stopSaludo}
        onVolumeChange={changeSaludoVolume}
      />

      {errorMsg && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {errorMsg}
        </p>
      )}
    </div>
  );
}

// Chequeo de sonido antes de salir al aire — mismo medidor y control de
// volumen que se usa ya conectado (ver SourceToggle "Mi micrófono" más
// abajo), pero disponible desde antes de presionar el botón de conectar.
// El volumen elegido aquí se aplica en cuanto arranca la transmisión.
function MicSoundcheck({
  track,
  volume,
  onVolumeChange,
}: {
  track: MediaStreamTrack | null | undefined;
  volume: number;
  onVolumeChange: (volume: number) => void;
}) {
  const hasSignal = !!track && track.readyState === "live" && !track.muted;

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2"
      style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: "var(--color-text)" }}>
          <Mic size={13} />
          Prueba de sonido
        </span>
        <AudioLevelMeter track={track} height={14} activeColor="var(--color-primary)" />
      </div>
      <div className="flex items-center gap-2">
        <Volume2 size={12} style={{ color: "var(--color-text-muted)" }} />
        <input
          type="range"
          min={0}
          max={2}
          step={0.05}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="flex-1 h-1"
          style={{ accentColor: "var(--color-primary)" }}
          aria-label="Volumen de mi micrófono"
        />
        <span className="text-[10px] w-8 text-right shrink-0" style={{ color: "var(--color-text-muted)" }}>
          {Math.round(volume * 100)}%
        </span>
      </div>
      {!hasSignal && (
        <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
          Activa tu micrófono en los controles de abajo para probar el sonido antes de salir al aire a la radio.
        </p>
      )}
    </div>
  );
}

// Cola de saludos de esta transmisión — visible siempre (backstage
// incluido), no solo una vez conectado a la radio, para que el
// anfitrión vea desde antes lo que ya le fueron dejando. Reproducir
// (canPlay) solo es posible una vez conectado, porque necesita el
// mixer de audio que arranca con la conexión al bridge.
function SaludosEnVivoSection({
  saludos,
  activeSaludoId,
  saludoLoading,
  saludoPlaying,
  saludoVolume,
  linkCopied,
  canPlay,
  onCopyLink,
  onToggle,
  onStop,
  onVolumeChange,
}: {
  saludos: SaludoEnVivo[];
  activeSaludoId: string | null;
  saludoLoading: boolean;
  saludoPlaying: boolean;
  saludoVolume: number;
  linkCopied: boolean;
  canPlay: boolean;
  onCopyLink: () => void;
  onToggle: (saludo: SaludoEnVivo) => void;
  onStop: () => void;
  onVolumeChange: (volume: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 pt-1" style={{ borderTop: "1px solid rgba(212,160,23,0.2)" }}>
      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          Saludos en vivo
        </p>
        <button
          type="button"
          onClick={onCopyLink}
          className="flex items-center gap-1 text-[10px] font-medium"
          style={{ color: "var(--color-primary)" }}
          title="Copiar link para compartir por WhatsApp"
        >
          {linkCopied ? <Check size={11} /> : <Copy size={11} />}
          {linkCopied ? "¡Copiado!" : "Copiar link"}
        </button>
      </div>

      {saludos.length === 0 ? (
        <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
          Comparte el link por WhatsApp — los saludos que dejen aparecerán aquí solos.
        </p>
      ) : (
        <>
          {!canPlay && (
            <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
              Conéctate a la radio para reproducirlos al aire.
            </p>
          )}
          {saludos.map((saludo) => {
            const isActive = canPlay && activeSaludoId === saludo.id;
            const isLoadingThis = isActive && saludoLoading;
            const isPlayingThis = isActive && saludoPlaying;
            return (
              <div key={saludo.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onToggle(saludo)}
                  disabled={!canPlay || (saludoLoading && !isActive) || !saludo.signedUrl}
                  className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left min-w-0"
                  style={{
                    background: isActive ? "rgba(212,160,23,0.15)" : "var(--color-surface)",
                    border: `1px solid ${isActive ? "rgba(212,160,23,0.4)" : "var(--color-border)"}`,
                    color: isActive ? "var(--color-primary)" : "var(--color-text)",
                    opacity: !canPlay ? 0.6 : saludoLoading && !isActive ? 0.5 : 1,
                  }}
                >
                  {isLoadingThis ? (
                    <Loader2 size={11} className="shrink-0 animate-spin" />
                  ) : isPlayingThis ? (
                    <Pause size={11} className="shrink-0" />
                  ) : (
                    <MessageCircleHeart
                      size={11}
                      className="shrink-0"
                      style={{ color: saludo.played_at ? "var(--color-text-muted)" : "var(--color-primary)" }}
                    />
                  )}
                  <span className="truncate">{saludo.nombre}</span>
                </button>
                {isActive && (
                  <button
                    type="button"
                    onClick={onStop}
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
                    aria-label="Detener"
                    title="Detener"
                  >
                    <Square size={10} style={{ color: "var(--color-text-muted)" }} />
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}
      {canPlay && activeSaludoId && (
        <div className="flex items-center gap-2 px-0.5 pt-1">
          <Volume2 size={12} style={{ color: "var(--color-text-muted)" }} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={saludoVolume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="flex-1 h-1"
            style={{ accentColor: "var(--color-primary)" }}
            aria-label="Volumen del saludo"
          />
          <span className="text-[10px] w-8 text-right shrink-0" style={{ color: "var(--color-text-muted)" }}>
            {Math.round(saludoVolume * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}

function SourceToggle({
  icon: Icon,
  label,
  active,
  loading,
  onToggle,
  meterTrack,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  active: boolean;
  loading?: boolean;
  onToggle: () => void;
  meterTrack?: MediaStreamTrack | null;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors"
      style={{
        background: active ? "rgba(212,160,23,0.15)" : "var(--color-surface)",
        border: `1px solid ${active ? "rgba(212,160,23,0.4)" : "var(--color-border)"}`,
        color: active ? "var(--color-primary)" : "var(--color-text-muted)",
      }}
    >
      <span className="flex items-center gap-2">
        <Icon size={13} />
        {label}
      </span>
      <span className="flex items-center gap-2">
        {meterTrack !== undefined && meterTrack !== null && (
          <AudioLevelMeter track={meterTrack} height={11} activeColor="var(--color-primary)" />
        )}
        {loading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <span
            className="w-8 h-4 rounded-full relative transition-colors shrink-0"
            style={{ background: active ? "var(--color-primary)" : "var(--color-border)" }}
          >
            <span
              className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
              style={{ left: active ? "18px" : "2px" }}
            />
          </span>
        )}
      </span>
    </button>
  );
}
