"use client";

import { useTracks, useParticipants, AudioTrack, VideoTrack, ParticipantName } from "@livekit/components-react";
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
  const screenTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }]);
  const screenAudioTracks = useTracks([{ source: Track.Source.ScreenShareAudio, withPlaceholder: false }]);
  const screenShare = screenTracks[0];

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

  const cameraTiles = cameraTracks.map((trackRef) => {
    const participant = trackRef.participant;
    const hasVideo = Boolean(trackRef.publication && !trackRef.publication.isMuted);
    const micTrack = micTracks.find((t) => t.participant.sid === participant.sid);
    const isMuted = !micTrack?.publication || micTrack.publication.isMuted;
    const canControlCamera = participant.isLocal && (isHost || isSpeaker);

    return { id: participant.sid, trackRef, participant, hasVideo, isMuted, canControlCamera };
  });

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Audio renderer for all participants */}
      {audioTracks.map((trackRef) =>
        trackRef.publication ? (
          <AudioTrack key={trackRef.participant.sid + "-audio"} trackRef={trackRef} className="hidden" />
        ) : null
      )}
      {screenAudioTracks.map((trackRef) =>
        trackRef.publication ? (
          <AudioTrack key={trackRef.participant.sid + "-screen-audio"} trackRef={trackRef} className="hidden" />
        ) : null
      )}

      {screenShare && screenShare.publication ? (
        <>
          {/* Pantalla compartida (grande) */}
          <div
            className="relative rounded-xl overflow-hidden flex-1 min-h-0 flex items-center justify-center"
            style={{ background: "#000", border: "1px solid var(--color-border)" }}
          >
            <VideoTrack trackRef={{ ...screenShare, publication: screenShare.publication }} className="w-full h-full object-contain" />
            <div
              className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-xs font-semibold backdrop-blur-sm"
              style={{ background: "rgba(10,10,18,0.75)", color: "var(--color-text)" }}
            >
              <ParticipantName participant={screenShare.participant} /> está compartiendo pantalla
            </div>
          </div>

          {/* Cámaras (miniaturas) */}
          <div className="flex gap-2 shrink-0 overflow-x-auto" style={{ height: "88px" }}>
            {cameraTiles.map((tile) => (
              <div key={tile.id} className="w-32 h-full shrink-0">
                <StageTile {...tile} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div
          className={`grid gap-3 flex-1 ${
            participants.length === 1
              ? "grid-cols-1"
              : participants.length <= 4
              ? "grid-cols-2"
              : "grid-cols-3"
          }`}
        >
          {cameraTiles.map((tile) => (
            <StageTile key={tile.id} {...tile} />
          ))}
        </div>
      )}
    </div>
  );
}
