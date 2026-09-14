import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { StudioShell } from "@/components/platikas/StudioShell";
import { Mic, Calendar, ArrowLeft, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import type { Metadata } from "next";
import type { ProgramaAudio } from "@/types";

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
    title: p?.title ? `${p.title} — Elim LLDM` : "Estudio en Vivo — Elim LLDM",
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
    programa_id: string | null;
    profiles: { display_name: string; avatar_url: string | null; role: string } | null;
  };

  // getProfile() y la consulta de programa_audios no dependen una de la otra
  // (esta última solo depende de p.programa_id, ya disponible), así que corren
  // en paralelo con Promise.all en vez de secuencialmente.
  const [profile, audiosResult] = await Promise.all([
    getProfile(),
    p.programa_id
      ? supabase
          .from("programa_audios")
          .select("*")
          .eq("programa_id", p.programa_id)
          .order("orden", { ascending: true })
      : Promise.resolve({ data: null as ProgramaAudio[] | null }),
  ]);
  const currentUserId = profile?.id ?? null;
  const programaAudios: ProgramaAudio[] = audiosResult.data ?? [];

  const isHost = currentUserId === p.host_id;
  // Además del anfitrión de ESTA plática: admin y moderador pueden borrar
  // mensajes del chat en cualquier plática en vivo, sin ser su anfitrión.
  const canModerateChat =
    isHost ||
    profile?.role === "admin" ||
    profile?.role === "moderador" ||
    profile?.role === "super_moderador";

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
  const isBackstage = p.status === "backstage";
  const isScheduled = p.status === "scheduled";
  const isEnded = p.status === "ended";
  const inStudio = (isLive || isBackstage) && !!p.livekit_room_name;

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      {inStudio ? (
        <StudioShell
          platikaId={id}
          roomName={p.livekit_room_name!}
          title={p.title}
          isHost={isHost}
          isSpeaker={isSpeaker}
          currentUserId={currentUserId}
          canModerateChat={canModerateChat}
          programaAudios={programaAudios}
          initialIsLive={isLive}
          radioActive={p.radio_output_active}
        />
      ) : (
        <>
          {/* Barra superior mínima — reemplaza el menú completo del sitio
              para que el estudio se sienta como una aplicación propia, no
              una página más de elimlldm.net (igual que StreamYard). */}
          <div
            className="flex items-center justify-between gap-3 px-4 py-2.5 shrink-0"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <Link
              href="/platikas"
              className="flex items-center gap-2 shrink-0"
              style={{ color: "var(--color-text-muted)" }}
            >
              <ArrowLeft size={16} />
              <span
                className="text-sm font-bold tracking-wide"
                style={{ fontFamily: "var(--font-cinzel)", color: "var(--color-primary)" }}
              >
                Elim LLDM
              </span>
            </Link>

            <div className="flex items-center gap-2 min-w-0">
              {isBackstage && isHost && (
                <span
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
                  style={{
                    background: "rgba(212,160,23,0.1)",
                    border: "1px solid rgba(212,160,23,0.2)",
                    color: "var(--color-primary)",
                  }}
                >
                  <Clock size={11} />
                  BACKSTAGE
                </span>
              )}
              <span
                className="text-sm font-medium truncate"
                style={{ color: "var(--color-text)" }}
                title={p.title}
              >
                {p.title}
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-4">
            {isBackstage ? (
              <BackstageBlockedState />
            ) : isScheduled ? (
              <ScheduledState
                title={p.title}
                description={p.description}
                scheduledAt={p.scheduled_at}
                hostName={p.profiles?.display_name ?? "Anfitrión"}
              />
            ) : isEnded ? (
              <EndedState recordingUrl={p.recording_url} title={p.title} />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function BackstageBlockedState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-8 rounded-2xl gap-6 max-w-md"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center"
        style={{
          background: "rgba(212,160,23,0.08)",
          border: "1px solid rgba(212,160,23,0.2)",
        }}
      >
        <Clock size={32} style={{ color: "var(--color-primary)" }} />
      </div>
      <div className="text-center max-w-sm">
        <p className="font-semibold mb-1" style={{ color: "var(--color-text)" }}>
          Todavía no está en vivo
        </p>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          El conductor está preparando esta transmisión. Vuelve a intentarlo en unos minutos.
        </p>
      </div>
    </div>
  );
}

function ScheduledState({
  title,
  description,
  scheduledAt,
  hostName,
}: {
  title: string;
  description: string | null;
  scheduledAt: string | null;
  hostName: string;
}) {
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
      className="flex flex-col items-center justify-center py-16 px-8 rounded-2xl gap-6 max-w-lg"
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
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {hostName}
        </p>
        <p className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
          {title}
        </p>
        {description && (
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            {description}
          </p>
        )}
        {dateStr && (
          <p
            className="text-base font-semibold capitalize mt-2"
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
        Ver Estudio en Vivo
      </Link>
    </div>
  );
}

function EndedState({ recordingUrl, title }: { recordingUrl: string | null; title: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-8 rounded-2xl gap-6 max-w-lg"
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
          {title}
        </p>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Esta sesión del Estudio en Vivo ha terminado.
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
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
          Más del Estudio en Vivo
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
