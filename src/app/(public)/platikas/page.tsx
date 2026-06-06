import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import {
  Calendar,
  Mic,
  Radio,
  ChevronRight,
  Users,
  Clock,
  Archive,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pláticas — Elim LLDM",
  description:
    "Transmisiones en vivo y sesiones programadas de la fe LLDM. Participa en el debate, chatea y solicita subir al escenario.",
};

interface PláticaRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  thumbnail_url: string | null;
  radio_output_active: boolean;
  host_id: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
}

export default async function PlatikaListPage() {
  const supabase = await createClient();

  const [{ data: activeRaw }, { data: endedRaw }] = await Promise.all([
    supabase
      .from("platikas")
      .select(
        "id, title, description, status, scheduled_at, started_at, thumbnail_url, radio_output_active, host_id, profiles(display_name, avatar_url)"
      )
      .in("status", ["live", "scheduled"])
      .order("status", { ascending: true }) // live sorts before scheduled alphabetically? No — let's sort manually
      .order("scheduled_at", { ascending: true }),

    supabase
      .from("platikas")
      .select(
        "id, title, ended_at, thumbnail_url, profiles(display_name, avatar_url)"
      )
      .eq("status", "ended")
      .order("ended_at", { ascending: false })
      .limit(4),
  ]);

  const active = activeRaw as unknown as PláticaRow[] | null;
  const ended = endedRaw as unknown as PláticaRow[] | null;

  const live = (active ?? []).filter((p) => p.status === "live");
  const scheduled = (active ?? []).filter((p) => p.status === "scheduled");

  return (
    <>
      <style>{`
        .platika-card { transition: border-color .2s ease, transform .2s ease; }
        .platika-card:hover { border-color: rgba(212,160,23,.4) !important; transform: translateY(-2px); }
        .platika-card-live:hover { border-color: rgba(212,160,23,.6) !important; }
        .ended-card { transition: border-color .2s ease, opacity .2s ease; }
        .ended-card:hover { border-color: rgba(212,160,23,.3) !important; opacity: .85; }
      `}</style>

      <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>

        {/* ── HERO ──────────────────────────────────────────────── */}
        <div
          className="py-12 px-4"
          style={{
            background:
              "linear-gradient(to bottom, rgba(212,160,23,0.05) 0%, transparent 100%)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div className="max-w-4xl mx-auto flex flex-col gap-5">
            <div>
              <h1
                className="text-4xl font-bold mb-2"
                style={{ color: "var(--color-text)" }}
              >
                Pláticas
              </h1>
              <p style={{ color: "var(--color-text-muted)" }}>
                Transmisiones en vivo con debate, chat y escenario abierto
              </p>
            </div>

            {/* Stat pills */}
            <div className="flex flex-wrap gap-3">
              {live.length > 0 && (
                <Pill
                  dot="live"
                  label={`${live.length} en vivo ahora`}
                />
              )}
              {scheduled.length > 0 && (
                <Pill
                  dot="gold"
                  label={`${scheduled.length} ${scheduled.length === 1 ? "plática programada" : "pláticas programadas"}`}
                />
              )}
              {live.length === 0 && scheduled.length === 0 && (
                <Pill dot="muted" label="Sin transmisiones activas" />
              )}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-10">

          {/* ── LIVE ──────────────────────────────────────────────── */}
          {live.length > 0 && (
            <section>
              <SectionHeader
                badge={
                  <span
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold animate-pulse"
                    style={{ background: "var(--color-live)", color: "#fff" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    EN VIVO
                  </span>
                }
                title="Ahora mismo"
              />
              <div className="flex flex-col gap-4">
                {live.map((p) => (
                  <LiveCard key={p.id} p={p} />
                ))}
              </div>
            </section>
          )}

          {/* ── SCHEDULED ─────────────────────────────────────────── */}
          <section>
            <SectionHeader
              badge={
                <span
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: "rgba(212,160,23,0.1)",
                    border: "1px solid rgba(212,160,23,0.2)",
                    color: "var(--color-primary)",
                  }}
                >
                  <Calendar size={11} />
                  Próximas
                </span>
              }
              title="Pláticas programadas"
            />

            {scheduled.length === 0 ? (
              <EmptyScheduled />
            ) : (
              <div className="flex flex-col gap-3">
                {scheduled.map((p) => (
                  <ScheduledCard key={p.id} p={p} />
                ))}
              </div>
            )}
          </section>

          {/* ── RECENTLY ENDED ────────────────────────────────────── */}
          {ended && ended.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Archive size={15} style={{ color: "var(--color-text-muted)" }} />
                  <h2
                    className="text-base font-semibold"
                    style={{ color: "var(--color-text)" }}
                  >
                    Recientes terminadas
                  </h2>
                </div>
                <Link
                  href="/archivo"
                  className="flex items-center gap-1 text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Ver archivo <ChevronRight size={12} />
                </Link>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {(ended as PláticaRow[]).map((p) => (
                  <EndedCard key={p.id} p={p} />
                ))}
              </div>
            </section>
          )}

          {/* ── HOW IT WORKS ──────────────────────────────────────── */}
          <HowItWorks />

        </div>
      </div>
    </>
  );
}

// ── Section pieces ──────────────────────────────────────────────────────────

function Pill({
  dot,
  label,
}: {
  dot: "live" | "gold" | "muted";
  label: string;
}) {
  const dotColor =
    dot === "live"
      ? "var(--color-live)"
      : dot === "gold"
      ? "var(--color-primary)"
      : "var(--color-text-muted)";
  const bg =
    dot === "live"
      ? "rgba(255,68,68,0.1)"
      : dot === "gold"
      ? "rgba(212,160,23,0.08)"
      : "var(--color-surface)";
  const border =
    dot === "live"
      ? "rgba(255,68,68,0.2)"
      : dot === "gold"
      ? "rgba(212,160,23,0.2)"
      : "var(--color-border)";
  const textColor =
    dot === "live"
      ? "var(--color-live)"
      : dot === "gold"
      ? "var(--color-primary)"
      : "var(--color-text-muted)";

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{ background: bg, border: `1px solid ${border}`, color: textColor }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0${dot === "live" ? " animate-pulse" : ""}`}
        style={{ background: dotColor }}
      />
      {label}
    </div>
  );
}

function SectionHeader({
  badge,
  title,
}: {
  badge: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {badge}
      <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
        {title}
      </h2>
    </div>
  );
}

// ── Cards ────────────────────────────────────────────────────────────────────

function LiveCard({ p }: { p: PláticaRow }) {
  return (
    <Link
      href={`/platikas/${p.id}`}
      className="platika-card platika-card-live rounded-2xl overflow-hidden flex flex-col sm:flex-row"
      style={{
        background: "var(--color-surface)",
        border: "1px solid rgba(212,160,23,0.3)",
        boxShadow: "0 0 32px rgba(212,160,23,0.06)",
      }}
    >
      {/* Thumbnail */}
      {p.thumbnail_url && (
        <div
          className="sm:w-48 shrink-0 relative overflow-hidden"
          style={{ background: "var(--color-surface-elevated)", minHeight: "120px" }}
        >
          <img
            src={p.thumbnail_url}
            alt={p.title}
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to right, transparent 60%, var(--color-surface))",
            }}
          />
        </div>
      )}

      <div className="flex flex-col gap-3 p-5 flex-1 min-w-0">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold animate-pulse"
            style={{ background: "var(--color-live)", color: "#fff" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            EN VIVO
          </span>
          {p.radio_output_active && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                background: "rgba(212,160,23,0.15)",
                color: "var(--color-primary)",
              }}
            >
              <Radio size={10} />
              En radio
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          className="text-lg font-bold leading-snug"
          style={{ color: "var(--color-text)" }}
        >
          {p.title}
        </h3>

        {p.description && (
          <p
            className="text-sm line-clamp-2 leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            {p.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <HostBadge host={p.profiles} />
          <span
            className="flex items-center gap-1 text-sm font-semibold"
            style={{ color: "var(--color-primary)" }}
          >
            Unirse ahora
            <ChevronRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function ScheduledCard({ p }: { p: PláticaRow }) {
  return (
    <Link
      href={`/platikas/${p.id}`}
      className="platika-card rounded-2xl flex items-center gap-4 px-5 py-4"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Date block */}
      {p.scheduled_at ? (
        <DateBlock dateStr={p.scheduled_at} />
      ) : (
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(212,160,23,0.08)" }}
        >
          <Calendar size={22} style={{ color: "var(--color-primary)" }} />
        </div>
      )}

      {/* Info */}
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <h3
          className="text-sm font-semibold truncate"
          style={{ color: "var(--color-text)" }}
        >
          {p.title}
        </h3>
        {p.description && (
          <p
            className="text-xs line-clamp-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            {p.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-0.5">
          <HostBadge host={p.profiles} small />
          {p.scheduled_at && (
            <span
              className="flex items-center gap-1 text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              <Clock size={10} />
              {formatDate(p.scheduled_at).split(",")[1]?.trim()}
            </span>
          )}
        </div>
      </div>

      <ChevronRight size={15} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
    </Link>
  );
}

function EndedCard({ p }: { p: PláticaRow }) {
  return (
    <Link
      href={`/platikas/${p.id}`}
      className="ended-card flex gap-3 p-4 rounded-2xl"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Thumbnail or icon */}
      <div
        className="w-16 h-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
        style={{ background: "var(--color-surface-elevated)" }}
      >
        {p.thumbnail_url ? (
          <img
            src={p.thumbnail_url}
            alt={p.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <Mic size={16} style={{ color: "var(--color-text-muted)" }} />
        )}
      </div>

      <div className="flex flex-col gap-1 min-w-0">
        <span
          className="px-1.5 py-0.5 rounded text-xs w-fit"
          style={{
            background: "var(--color-surface-elevated)",
            color: "var(--color-text-muted)",
          }}
        >
          terminada
        </span>
        <p
          className="text-xs font-medium line-clamp-2 leading-snug"
          style={{ color: "var(--color-text)" }}
        >
          {p.title}
        </p>
        <HostBadge host={p.profiles} small />
      </div>
    </Link>
  );
}

// ── Shared atoms ─────────────────────────────────────────────────────────────

function HostBadge({
  host,
  small,
}: {
  host: { display_name: string; avatar_url: string | null } | null;
  small?: boolean;
}) {
  const name = host?.display_name ?? "Anfitrión";
  const size = small ? "w-4 h-4" : "w-5 h-5";
  const textSize = small ? "text-xs" : "text-xs";

  return (
    <div
      className={`flex items-center gap-1.5 ${textSize}`}
      style={{ color: "var(--color-text-muted)" }}
    >
      {host?.avatar_url ? (
        <img
          src={host.avatar_url}
          alt={name}
          className={`${size} rounded-full object-cover shrink-0`}
        />
      ) : (
        <div
          className={`${size} rounded-full flex items-center justify-center text-xs font-bold shrink-0`}
          style={{ background: "rgba(212,160,23,0.15)", color: "var(--color-primary)" }}
        >
          {name[0]?.toUpperCase()}
        </div>
      )}
      <span className="truncate">{name}</span>
    </div>
  );
}

function DateBlock({ dateStr }: { dateStr: string }) {
  const d = new Date(dateStr);
  const day = d.toLocaleDateString("es-MX", { day: "2-digit" });
  const month = d.toLocaleDateString("es-MX", { month: "short" });

  return (
    <div
      className="w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0"
      style={{
        background: "rgba(212,160,23,0.08)",
        border: "1px solid rgba(212,160,23,0.15)",
      }}
    >
      <span className="text-xl font-bold leading-none" style={{ color: "var(--color-primary)" }}>
        {day}
      </span>
      <span className="text-xs uppercase font-medium" style={{ color: "var(--color-text-muted)" }}>
        {month.replace(".", "")}
      </span>
    </div>
  );
}

function EmptyScheduled() {
  return (
    <div
      className="flex flex-col items-center justify-center py-14 rounded-2xl gap-3"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(212,160,23,0.08)" }}
      >
        <Calendar size={22} style={{ color: "var(--color-text-muted)" }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
          No hay pláticas programadas
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          Los anfitriones verificados pueden programar transmisiones
        </p>
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="px-5 py-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          ¿Cómo funcionan las pláticas?
        </h2>
      </div>
      <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x" style={{ borderColor: "var(--color-border)" }}>
        {[
          {
            icon: Users,
            title: "Entra como espectador",
            desc: "Sin cuenta puedes ver y escuchar la transmisión en vivo.",
          },
          {
            icon: Mic,
            title: "Solicita el escenario",
            desc: "Con cuenta, solicita participar. El anfitrión aprueba quién sube.",
          },
          {
            icon: Radio,
            title: "Disponible en radio",
            desc: "Algunas pláticas se transmiten simultáneamente en Radio Elim LLDM.",
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex gap-3 p-5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: "rgba(212,160,23,0.08)" }}
            >
              <Icon size={15} style={{ color: "var(--color-primary)" }} />
            </div>
            <div>
              <p className="text-sm font-medium mb-0.5" style={{ color: "var(--color-text)" }}>
                {title}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                {desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
