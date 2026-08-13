"use client";

import { useRef, useState } from "react";
import {
  VideoTrack,
  ParticipantName,
  useLocalParticipant,
  useParticipantInfo,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { Mic, MicOff, Video, VideoOff, ImagePlus, X, Loader2, MonitorUp, MonitorX } from "lucide-react";
import { createFreshClient } from "@/lib/supabase/client";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_IMAGE = "/icons/icon-512.png";

interface CameraOffMetadata {
  cameraOffImageUrl?: string;
}

function parseCameraOffImage(metadata: string | undefined): string | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as CameraOffMetadata;
    return parsed.cameraOffImageUrl ?? null;
  } catch {
    return null;
  }
}

interface StageTileProps {
  trackRef: TrackReferenceOrPlaceholder;
  participant: Participant;
  hasVideo: boolean;
  isMuted: boolean;
  canControlCamera: boolean;
}

export function StageTile({ trackRef, participant, hasVideo, isMuted, canControlCamera }: StageTileProps) {
  const { metadata } = useParticipantInfo({ participant });
  const cameraOffImageUrl = parseCameraOffImage(metadata);

  return (
    <div
      className="relative rounded-xl overflow-hidden aspect-video flex items-center justify-center"
      style={{
        background: "var(--color-surface-elevated)",
        border: "1px solid var(--color-border)",
      }}
    >
      {trackRef.publication && hasVideo ? (
        <VideoTrack trackRef={trackRef} className="w-full h-full object-cover" />
      ) : cameraOffImageUrl ? (
        <img src={cameraOffImageUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <img src={DEFAULT_IMAGE} alt="" className="w-20 h-20 object-contain opacity-80" />
      )}

      {/* Participant info bar */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between">
        <div
          className="px-2 py-0.5 rounded-md text-xs font-semibold backdrop-blur-sm"
          style={{ background: "rgba(10,10,18,0.75)", color: "var(--color-text)" }}
        >
          <ParticipantName participant={participant} />
        </div>
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center backdrop-blur-sm"
          style={{
            background: isMuted ? "rgba(248,113,113,0.25)" : "rgba(74,222,128,0.15)",
          }}
        >
          {isMuted ? (
            <MicOff size={12} style={{ color: "var(--color-destructive)" }} />
          ) : (
            <Mic size={12} style={{ color: "var(--color-success)" }} />
          )}
        </div>
      </div>

      {!hasVideo && !canControlCamera && (
        <div
          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: "rgba(248,113,113,0.2)" }}
        >
          <VideoOff size={12} style={{ color: "var(--color-destructive)" }} />
        </div>
      )}

      {canControlCamera && (
        <CameraControls hasVideo={hasVideo} cameraOffImageUrl={cameraOffImageUrl} participantIdentity={participant.identity} />
      )}
    </div>
  );
}

function CameraControls({
  hasVideo,
  cameraOffImageUrl,
  participantIdentity,
}: {
  hasVideo: boolean;
  cameraOffImageUrl: string | null;
  participantIdentity: string;
}) {
  const { localParticipant, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function toggleCamera() {
    await localParticipant.setCameraEnabled(!isCameraEnabled);
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
      const path = `${participantIdentity}/${Date.now()}.${ext}`;

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

  return (
    <div className="absolute top-2 left-2 flex items-center gap-1.5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      <button
        type="button"
        onClick={toggleCamera}
        aria-label={hasVideo ? "Apagar cámara" : "Encender cámara"}
        className="w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
        style={{ background: "rgba(10,10,18,0.75)" }}
      >
        {hasVideo ? (
          <Video size={13} style={{ color: "var(--color-text)" }} />
        ) : (
          <VideoOff size={13} style={{ color: "var(--color-destructive)" }} />
        )}
      </button>

      <button
        type="button"
        onClick={toggleScreenShare}
        aria-label={isScreenShareEnabled ? "Dejar de compartir pantalla" : "Compartir pantalla"}
        className="w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
        style={{ background: "rgba(10,10,18,0.75)" }}
      >
        {isScreenShareEnabled ? (
          <MonitorX size={13} style={{ color: "var(--color-primary)" }} />
        ) : (
          <MonitorUp size={13} style={{ color: "var(--color-text)" }} />
        )}
      </button>

      {!hasVideo && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="Cambiar imagen"
          className="w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
          style={{ background: "rgba(10,10,18,0.75)" }}
        >
          {uploading ? (
            <Loader2 size={13} className="animate-spin" style={{ color: "var(--color-text)" }} />
          ) : (
            <ImagePlus size={13} style={{ color: "var(--color-text)" }} />
          )}
        </button>
      )}

      {!hasVideo && cameraOffImageUrl && (
        <button
          type="button"
          onClick={() => setCameraOffImage(null)}
          aria-label="Quitar imagen"
          className="w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
          style={{ background: "rgba(10,10,18,0.75)" }}
        >
          <X size={13} style={{ color: "var(--color-text)" }} />
        </button>
      )}

      {error && (
        <div
          className="absolute top-9 left-0 px-2 py-1 rounded-md text-[11px] whitespace-nowrap backdrop-blur-sm"
          style={{ background: "rgba(10,10,18,0.85)", color: "var(--color-destructive)" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
