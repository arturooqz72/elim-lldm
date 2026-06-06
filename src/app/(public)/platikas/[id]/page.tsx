import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { LiveKitRoom } from "@/components/platikas/LiveKitRoom";
import { Mic, Calendar, Radio, ArrowLeft, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("platikas")
    .select("title, description, thumbnail_url")
    .eq("id", id)
    .single();

  const p = data as { title?: string; description?: string; thumbnail_url?: string | null } | null;

  return {
    title: p?.title ? `${p.title} — Elim LLDM` : "Plática — Elim LLDM",
    description: p?.description ?? undefined,
    openGraph: p?.thumbnail_url ? { images: [p.thumbnail_url] } : undefined,
  };
}

export default async function PlatikaRoomPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: platica } = await supabase
    .from("platikas")
    .select("*, profiles(display_name, avatar_url, role)")
    .eq("id", id)
    .single();

  if (!platica) notFound();

  const profile = await getProfile();
  const currentUserId = profile?.id ?? null;

  const p = platica as {
    id: string;
    title: string;
    description: string | null;
    status: string;
    host_id: string;
    livekit_room_name: string | null;
    radio_output_active: boolean;
    scheduled_at: string | null;
    started_at: string | null;
    thumbnail_url: string | null;
    recording_url: string | null;
    profiles: { display_name: string; avatar_url: string | null; role: string } | null;
  };

  const isHost = currentUserId === p.host_id;

  let isSpeaker = false;
  if (currentUserId && !isHost && p.status === "live") {
    const { data: req } = await supabase
      .from("platikas_requests")
      .select("status")
      .eq("platikas_id", id)
      .eq("user_id", currentUserId)
      .eq("status", "approved")
      .maybeSingle();
    isSpeaker = !!req;
  }

  const isLive = p.status === "live";
  const isScheduled = p.status === "scheduled";
  const isEnded = p.status === "ended";

  return (
    <>
      <style>{`
        .back-link:hover { color: var(--color-primary) !important; }
        .recording-btn:hover { box-shadow: 0 0 20px rgba(212,160,23,0.4); }
      `}</style>
      <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>

        {/* Thumbnail banner */}
        {p.thumbnail_url && (
          <div className="relative w-full overflow-hidden" style={{ height: "220px" }}>
            <img
              src={p.thumbnail_url}
              alt={p.title}
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(10,10,18,0.2) 0%, rgba(10,10,18,0.96) 100%)",
              }}
            />
          </div>
        )}

        {/* Header */}
        <div
          className="px-4 py-6"
          style={{
            background: p.thumbnail_url
              ? "var(--color-bg)"
              : "linear-gradient(to bottom, rgba(212,160,23,0.04) 0%, transparent 100%)",
            borderBottom: "1px solid var(--color-border)",
            ...(p.thumbnail_url
              ? { marginTop: "-52px", position: "relative", zIndex: 10 }
              : {}),
          }}
        >
          <div className="max-w-7xl mx-auto flex flex-col gap-4">

            {/* Breadcrumb */}
            <Link
              href="/platikas"
              className="back-link flex items-center gap-1.5 text-sm transition-colors w-fit"
              style={{ color: "var(--color-text-muted)" }}
            >
              <ArrowLeft size={14} />
              Pláticas
            </Link>

            {/* Status badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {isLive && (
                <span
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold animate-pulse"
                  style={{ background: "var(--color-live)", color: "#fff" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                  EN VIVO
                </span>
              )}
              {isScheduled && (
                <span
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: "rgba(212,160,23,0.1)",
                    border: "1px solid rgba(212,160,23,0.2)",
                    color: "var(--color-primary)",
                  }}
                >
                  <Clock size={11} />
                  PRÓXIMA
                </span>
              )}
              {isEnded && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: "var(--color-surface-elevated)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  TERMINADA
                </span>
              )}
              {isLive && p.radio_output_active && (
                <span
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: "rgba(96,165,250,0.1)",
                    border: "1px solid rgba(96,165,250,0.2)",
                    color: "#60A5FA",
                  }}
                >
                  <Radio size={11} />
                  En radio
                </span>
              )}
            </div>

            {/* Title */}
            <h1
              className="text-2xl md:text-3xl font-bold leading-snug"
              style={{ color: "var(--color-text)" }}
            >
              {p.title}
            </h1>

            {/* Host + date row */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                {p.profiles?.avatar_url ? (
                  <img
                    src={p.profiles.avatar_url}
                    alt={p.profiles.display_name}
                    className="w-7 h-7 rounded-full object-cover"
                    style={{ border: "1px solid rgba(212,160,23,0.3)" }}
                  />
                ) : (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: "var(--color-primary)", color: "#000" }}
                  >
                    {p.profiles?.display_name?.[0]?.toUpperCase() ?? "A"}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Mic size={12} style={{ color: "var(--color-primary)" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                    {p.profiles?.display_name ?? "Anfitrión"}
                  </span>
                </div>
              </div>

              {isScheduled && p.scheduled_at && (
                <div
                  className="flex items-center gap-1.5 text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <Calendar size={12} />
                  <span>{formatDate(p.scheduled_at)}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {p.description && (
              <p
                className="text-sm max-w-2xl leading-relaxed"
                style={{ color: "var(--color-text-muted)" }}
              >
                {p.description}
              </p>
            )}
          </div>
        </div>

        {/* Room / state area */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          {isLive && p.livekit_room_name ? (
            <LiveKitRoom
              platikaId={id}
              roomName={p.livekit_room_name}
              isHost={isHost}
              isSpeaker={isSpeaker}
              currentUserId={currentUserId}
              radioOutputActive={p.radio_output_active}
            />
          ) : isScheduled ? (
            <ScheduledState scheduledAt={p.scheduled_at} />
          ) : isEnded ? (
            <EndedState recordingUrl={p.recording_url} />
          ) : null}
        </div>
      </div>
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function ScheduledState({ scheduledAt }: { scheduledAt: string | null }) {
  const date = scheduledAt ? new Date(scheduledAt) : null;

  const dateStr = date
    ? date.toLocaleDateString("es-MX", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const timeStr = date
    ? date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      className="flex flex-col items-center justify-center py-20 rounded-2xl gap-6"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center"
        style={{
          background: "rgba(212,160,23,0.08)",
          border: "1px solid rgba(212,160,23,0.2)",
        }}
      >
        <Calendar size={36} style={{ color: "var(--color-primary)" }} />
      </div>

      <div className="text-center flex flex-col gap-2 max-w-sm px-4">
        <p className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
          Esta plática aún no ha comenzado
        </p>
        {dateStr && (
          <p
            className="text-base font-semibold capitalize"
            style={{ color: "var(--color-primary)" }}
          >
            {dateStr}
          </p>
        )}
        {timeStr && (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            a las {timeStr}
          </p>
        )}
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          Regresa en esa fecha para unirte a la transmisión en vivo.
        </p>
      </div>

      <Link
        href="/platikas"
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        style={{
          background: "var(--color-surface-elevated)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      >
        <ArrowLeft size={14} />
        Ver todas las pláticas
      </Link>
    </div>
  );
}

function EndedState({ recordingUrl }: { recordingUrl: string | null }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 rounded-2xl gap-6"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center"
        style={{
          background: "var(--color-surface-elevated)",
          border: "1px solid var(--color-border)",
        }}
      >
        <Mic size={36} style={{ color: "var(--color-text-muted)" }} />
      </div>

      <div className="text-center flex flex-col gap-2 max-w-sm px-4">
        <p className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
          Esta plática ha terminado
        </p>
        {recordingUrl ? (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            La grabación ya está disponible.
          </p>
        ) : (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            La grabación estará disponible en el{" "}
            <Link href="/archivo" style={{ color: "var(--color-primary)" }}>
              Archivo
            </Link>{" "}
            próximamente.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap justify-center">
        {recordingUrl && (
          <a
            href={recordingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="recording-btn flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            Ver grabación
          </a>
        )}
        <Link
          href="/platikas"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        >
          <ArrowLeft size={14} />
          Más pláticas
        </Link>
        <Link
          href="/archivo"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        >
          Ver archivo
        </Link>
      </div>
    </div>
  );
}
