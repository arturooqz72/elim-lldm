"use client";

import { useEffect, useState } from "react";
import { useMaybeRoomContext, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Users2, Mic, MicOff, UserMinus, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SpeakerControlsProps {
  platikaId: string;
}

interface ApprovedSpeaker {
  user_id: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

// Same useMaybeRoomContext gate as RadioBroadcastPanel — this renders inside
// the sidebar, which LiveKitRoom.tsx also mounts before a room connection
// exists (loading/error states). useTracks throws outside a Room context.
export function SpeakerControls({ platikaId }: SpeakerControlsProps) {
  const room = useMaybeRoomContext();
  if (!room) return null;
  return <ConnectedSpeakerControls platikaId={platikaId} />;
}

function ConnectedSpeakerControls({ platikaId }: SpeakerControlsProps) {
  const [speakers, setSpeakers] = useState<ApprovedSpeaker[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const micTracks = useTracks([{ source: Track.Source.Microphone, withPlaceholder: false }]);

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("platikas_requests")
      .select("user_id, profiles(display_name, avatar_url)")
      .eq("platikas_id", platikaId)
      .eq("status", "approved")
      .then(({ data }) => {
        if (data) setSpeakers(data as unknown as ApprovedSpeaker[]);
      });

    const channel = supabase
      .channel(`speakers:${platikaId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "platikas_requests",
          filter: `platikas_id=eq.${platikaId}`,
        },
        async (payload) => {
          if (payload.new.status === "approved") {
            const { data } = await supabase
              .from("platikas_requests")
              .select("user_id, profiles(display_name, avatar_url)")
              .eq("id", payload.new.id)
              .single();
            if (data) {
              const speaker = data as unknown as ApprovedSpeaker;
              setSpeakers((prev) => [...prev.filter((s) => s.user_id !== speaker.user_id), speaker]);
            }
          } else {
            setSpeakers((prev) => prev.filter((s) => s.user_id !== payload.new.user_id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [platikaId]);

  if (speakers.length === 0) return null;

  async function toggleMute(identity: string, currentlyMuted: boolean) {
    setBusy(identity);
    try {
      await fetch(`/api/platikas/${platikaId}/participants/${identity}/mute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muted: !currentlyMuted }),
      });
    } finally {
      setBusy(null);
    }
  }

  async function removeSpeaker(identity: string) {
    if (!confirm("¿Bajar a este invitado del escenario?")) return;
    setBusy(identity);
    try {
      const res = await fetch(`/api/platikas/${platikaId}/participants/${identity}/remove`, {
        method: "POST",
      });
      if (res.ok) {
        setSpeakers((prev) => prev.filter((s) => s.user_id !== identity));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <Users2 size={15} style={{ color: "var(--color-primary)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          En el escenario
        </span>
      </div>

      <div className="p-3 flex flex-col gap-2">
        {speakers.map((speaker) => {
          const micTrack = micTracks.find((t) => t.participant.identity === speaker.user_id);
          const isMuted = !micTrack?.publication || micTrack.publication.isMuted;
          const isBusy = busy === speaker.user_id;

          return (
            <div
              key={speaker.user_id}
              className="flex items-center gap-3 p-2.5 rounded-xl"
              style={{
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: "rgba(212,160,23,0.2)", color: "var(--color-primary)" }}
              >
                {speaker.profiles?.display_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <p
                className="flex-1 min-w-0 text-sm font-medium truncate"
                style={{ color: "var(--color-text)" }}
              >
                {speaker.profiles?.display_name ?? "Invitado"}
              </p>
              <button
                type="button"
                onClick={() => toggleMute(speaker.user_id, isMuted)}
                disabled={isBusy}
                aria-label={isMuted ? "Activar micrófono" : "Silenciar"}
                title={isMuted ? "Activar micrófono" : "Silenciar micrófono"}
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                style={{
                  background: isMuted ? "rgba(248,113,113,0.15)" : "rgba(74,222,128,0.15)",
                  color: isMuted ? "var(--color-destructive)" : "var(--color-success)",
                }}
              >
                {isBusy ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : isMuted ? (
                  <MicOff size={13} />
                ) : (
                  <Mic size={13} />
                )}
              </button>
              <button
                type="button"
                onClick={() => removeSpeaker(speaker.user_id)}
                disabled={isBusy}
                aria-label="Bajar del escenario"
                title="Bajar del escenario"
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                style={{ background: "rgba(248,113,113,0.15)", color: "var(--color-destructive)" }}
              >
                <UserMinus size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
