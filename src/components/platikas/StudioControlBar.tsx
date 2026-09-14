"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalParticipant, useParticipantInfo } from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ImagePlus,
  X,
  Loader2,
  MonitorUp,
  MonitorX,
  Settings2,
  Volume2,
} from "lucide-react";
import { createFreshClient } from "@/lib/supabase/client";
import { AudioLevelMeter } from "./AudioLevelMeter";
import { ManagedMic } from "@/lib/livekit/managed-mic";
import {
  MAX_IMAGE_BYTES,
  parseCameraOffImage,
  type CameraOffMetadata,
} from "@/lib/livekit/camera-off-image";

// Barra de controles flotante del anfitrión/orador — mic, cámara y
// pantalla compartida en un solo lugar, independiente de en qué
// posición de la cuadrícula caiga su propio video (antes vivían
// amontonados en la esquina del tile local, ver StageTile.tsx).
export function StudioControlBar() {
  const { localParticipant, isCameraEnabled, isScreenShareEnabled, microphoneTrack } =
    useLocalParticipant();
  const { metadata } = useParticipantInfo({ participant: localParticipant });
  const cameraOffImageUrl = parseCameraOffImage(metadata);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ver managed-mic.ts: el track publicado nunca cambia, así que LiveKit
  // nunca necesita reiniciar nada al cambiar de dispositivo o volumen.
  const micRef = useRef<ManagedMic | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [micVolume, setMicVolume] = useState(1);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string | undefined>(undefined);
  const [showMicSettings, setShowMicSettings] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const mic = new ManagedMic();

    async function refreshDeviceList() {
      const list = await navigator.mediaDevices.enumerateDevices();
      if (cancelled) return;
      setMicDevices(list.filter((d) => d.kind === "audioinput"));
    }

    (async () => {
      // Defensa extra: si por una reconexión (nuevo sid del participante
      // local monta este componente de nuevo) quedó un mic viejo publicado
      // sin que su cleanup alcanzara a correr, se retira antes de publicar
      // el nuevo — evita el "publishing a second track with the same
      // source: microphone" que dejaba dos micrófonos sonando a la vez.
      const stale = localParticipant.getTrackPublication(Track.Source.Microphone);
      if (stale?.track) {
        await localParticipant.unpublishTrack(stale.track, true).catch(() => {});
      }

      await mic.setDevice(undefined);
      if (cancelled) {
        mic.close();
        return;
      }
      micRef.current = mic;
      setSelectedMicId(mic.deviceId);
      await localParticipant.publishTrack(mic.outputTrack, {
        source: Track.Source.Microphone,
        name: "microphone",
        dtx: true,
      });
      await refreshDeviceList();
    })();

    navigator.mediaDevices.addEventListener("devicechange", refreshDeviceList);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener("devicechange", refreshDeviceList);
      if (micRef.current === mic) micRef.current = null;
      void localParticipant.unpublishTrack(mic.outputTrack, false).catch(() => {});
      mic.close();
    };
    // Solo una vez por montaje: el track publicado se queda fijo mientras
    // el componente exista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleCamera() {
    await localParticipant.setCameraEnabled(!isCameraEnabled);
  }

  function toggleMic() {
    const next = !micOn;
    setMicOn(next);
    micRef.current?.setVolume(next ? micVolume : 0);
  }

  function changeMicVolume(volume: number) {
    setMicVolume(volume);
    if (micOn) micRef.current?.setVolume(volume);
  }

  async function changeMicDevice(deviceId: string) {
    await micRef.current?.setDevice(deviceId);
    setSelectedMicId(deviceId);
    micRef.current?.setVolume(micOn ? micVolume : 0);
  }

  async function toggleScreenShare() {
    setError("");
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled, { audio: true });
    } catch {
      // El usuario canceló el selector de pantalla/pestaña — no es un error real
    }
  }

  async function setCameraOffImage(url: string | null) {
    await localParticipant.setMetadata(
      JSON.stringify({ cameraOffImageUrl: url ?? undefined } satisfies CameraOffMetadata)
    );
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError("");

    if (!file.type.startsWith("image/")) {
      setError("Elige una imagen o GIF");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("La imagen debe pesar menos de 5MB");
      return;
    }

    setUploading(true);
    try {
      const supabase = createFreshClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${localParticipant.identity}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("camera-off-photos")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("camera-off-photos").getPublicUrl(path);
      await setCameraOffImage(data.publicUrl);
    } catch {
      setError("No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  const hasVideo = isCameraEnabled;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div
        className="flex items-center gap-1.5 px-2 py-2 rounded-full backdrop-blur-md"
        style={{ background: "rgba(10,10,18,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <button
          type="button"
          onClick={toggleMic}
          aria-label={micOn ? "Apagar micrófono" : "Encender micrófono"}
          className="w-11 h-11 rounded-full flex items-center justify-center transition-colors"
          style={{ background: micOn ? "rgba(255,255,255,0.1)" : "var(--color-destructive)" }}
        >
          {micOn ? <Mic size={18} style={{ color: "#fff" }} /> : <MicOff size={18} style={{ color: "#fff" }} />}
        </button>

        <button
          type="button"
          onClick={toggleCamera}
          aria-label={hasVideo ? "Apagar cámara" : "Encender cámara"}
          className="w-11 h-11 rounded-full flex items-center justify-center transition-colors"
          style={{ background: hasVideo ? "rgba(255,255,255,0.1)" : "var(--color-destructive)" }}
        >
          {hasVideo ? <Video size={18} style={{ color: "#fff" }} /> : <VideoOff size={18} style={{ color: "#fff" }} />}
        </button>

        <button
          type="button"
          onClick={toggleScreenShare}
          aria-label={isScreenShareEnabled ? "Dejar de compartir pantalla" : "Compartir pantalla"}
          className="w-11 h-11 rounded-full flex items-center justify-center transition-colors"
          style={{ background: isScreenShareEnabled ? "var(--color-primary)" : "rgba(255,255,255,0.1)" }}
        >
          {isScreenShareEnabled ? (
            <MonitorX size={18} style={{ color: "#000" }} />
          ) : (
            <MonitorUp size={18} style={{ color: "#fff" }} />
          )}
        </button>

        {!hasVideo && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Cambiar imagen de cámara apagada"
            className="w-11 h-11 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            {uploading ? (
              <Loader2 size={18} className="animate-spin" style={{ color: "#fff" }} />
            ) : (
              <ImagePlus size={18} style={{ color: "#fff" }} />
            )}
          </button>
        )}

        {!hasVideo && cameraOffImageUrl && (
          <button
            type="button"
            onClick={() => setCameraOffImage(null)}
            aria-label="Quitar imagen"
            className="w-11 h-11 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <X size={18} style={{ color: "#fff" }} />
          </button>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMicSettings((v) => !v)}
            aria-label="Elegir micrófono y volumen"
            className="w-11 h-11 rounded-full flex items-center justify-center transition-colors"
            style={{ background: showMicSettings ? "var(--color-primary)" : "rgba(255,255,255,0.1)" }}
          >
            <Settings2 size={17} style={{ color: showMicSettings ? "#000" : "#fff" }} />
          </button>

          {showMicSettings && (
            <div
              className="absolute bottom-14 left-1/2 -translate-x-1/2 w-64 p-3 rounded-xl flex flex-col gap-3 backdrop-blur-md z-10"
              style={{ background: "rgba(10,10,18,0.92)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {micOn && (
                <div className="flex items-center justify-center">
                  <AudioLevelMeter track={microphoneTrack?.track?.mediaStreamTrack} height={14} barCount={9} />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-medium mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Micrófono
                </label>
                {micDevices.length > 0 ? (
                  <select
                    value={selectedMicId}
                    onChange={(e) => void changeMicDevice(e.target.value)}
                    className="w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
                  >
                    {micDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId} style={{ color: "#000" }}>
                        {d.label || "Micrófono"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                    No se detectaron micrófonos.
                  </p>
                )}
              </div>

              <div>
                <label
                  className="flex items-center gap-1.5 text-[10px] font-medium mb-1"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  <Volume2 size={11} />
                  Volumen ({Math.round(micVolume * 100)}%)
                </label>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={micVolume}
                  onChange={(e) => changeMicVolume(Number(e.target.value))}
                  className="w-full h-1"
                  style={{ accentColor: "var(--color-primary)" }}
                  aria-label="Volumen del micrófono"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div
          className="absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap backdrop-blur-sm"
          style={{ background: "rgba(10,10,18,0.9)", color: "var(--color-destructive)" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
