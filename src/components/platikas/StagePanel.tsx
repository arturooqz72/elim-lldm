"use client";

import {
  useTracks,
  VideoTrack,
  ParticipantName,
  useParticipants,
  AudioTrack,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";

export function StagePanel() {
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
          const hasVideo = trackRef.publication && !trackRef.publication.isMuted;
          const micTrack = micTracks.find((t) => t.participant.sid === participant.sid);
          const isMuted = !micTrack?.publication || micTrack.publication.isMuted;

          return (
            <div
              key={participant.sid}
              className="relative rounded-xl overflow-hidden aspect-video flex items-center justify-center"
              style={{
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
              }}
            >
              {hasVideo ? (
                <VideoTrack trackRef={trackRef} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
                  style={{ background: "rgba(212,160,23,0.2)", color: "var(--color-primary)" }}
                >
                  {participant.name?.[0]?.toUpperCase() ?? "?"}
                </div>
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

              {/* No-video indicator overlay */}
              {!hasVideo && (
                <div
                  className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(248,113,113,0.2)" }}
                >
                  <VideoOff size={12} style={{ color: "var(--color-destructive)" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
