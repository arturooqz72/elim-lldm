"use client";

import { VideoTrack, ParticipantName, useParticipantInfo, type TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { Mic, MicOff, VideoOff } from "lucide-react";
import { type Participant } from "livekit-client";
import { parseCameraOffImage, DEFAULT_CAMERA_OFF_IMAGE } from "@/lib/livekit/camera-off-image";

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
        <img src={DEFAULT_CAMERA_OFF_IMAGE} alt="" className="w-20 h-20 object-contain opacity-80" />
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
    </div>
  );
}
