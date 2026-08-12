"use client";

import { useTracks, useParticipants, AudioTrack } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Mic } from "lucide-react";
import { StageTile } from "./StageTile";

interface StagePanelProps {
  isHost: boolean;
  isSpeaker: boolean;
}

export function StagePanel({ isHost, isSpeaker }: StagePanelProps) {
  const participants = useParticipants();
  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const micTracks = useTracks([{ source: Track.Source.Microphone, withPlaceholder: false }]);

  if (participants.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full rounded-2xl"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.2)" }}
          >
            <Mic size={24} style={{ color: "var(--color-primary)" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
            El anfitrión iniciará pronto
          </p>
        </div>
      </div>
    );
  }

  // Render all audio tracks (invisible)
  const audioTracks = micTracks.filter((t) => !t.publication?.isMuted);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Audio renderer for all participants */}
      {audioTracks.map((trackRef) =>
        trackRef.publication ? (
          <AudioTrack key={trackRef.participant.sid + "-audio"} trackRef={trackRef} className="hidden" />
        ) : null
      )}

      {/* Video grid */}
      <div
        className={`grid gap-3 flex-1 ${
          participants.length === 1
            ? "grid-cols-1"
            : participants.length <= 4
            ? "grid-cols-2"
            : "grid-cols-3"
        }`}
      >
        {cameraTracks.map((trackRef) => {
          const participant = trackRef.participant;
          const hasVideo = Boolean(trackRef.publication && !trackRef.publication.isMuted);
          const micTrack = micTracks.find((t) => t.participant.sid === participant.sid);
          const isMuted = !micTrack?.publication || micTrack.publication.isMuted;
          const canControlCamera = participant.isLocal && (isHost || isSpeaker);

          return (
            <StageTile
              key={participant.sid}
              trackRef={trackRef}
              participant={participant}
              hasVideo={hasVideo}
              isMuted={isMuted}
              canControlCamera={canControlCamera}
            />
          );
        })}
      </div>
    </div>
  );
}
