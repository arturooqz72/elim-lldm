"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Mic,
  Radio,
  ChevronRight,
  Clock,
  Archive,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { EditPlatikaModal } from "./EditPlatikaModal";

export interface PláticaRow {
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

const ACTIVE_SELECT =
  "id, title, description, status, scheduled_at, started_at, ended_at, thumbnail_url, radio_output_active, host_id, profiles(display_name, avatar_url)";

interface PlatikaSessionsProps {
  initialLive: PláticaRow[];
  initialScheduled: PláticaRow[];
  initialEnded: PláticaRow[];
  isAdmin: boolean;
}

export function PlatikaSessions({
  initialLive,
  initialScheduled,
  initialEnded,
  isAdmin,
}: PlatikaSessionsProps) {
  const [live, setLive] = useState(initialLive);
  const [scheduled, setScheduled] = useState(initialScheduled);
  const [ended, setEnded] = useState(initialEnded);
  const [editing, setEditing] = useState<PláticaRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const instanceId = useId();

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [{ data: activeRaw }, { data: endedRaw }] = await Promise.all([
      supabase
        .from("platikas")
        .select(ACTIVE_SELECT)
        .in("status", ["live", "scheduled"])
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("platikas")
        .select(ACTIVE_SELECT)
        .eq("status", "ended")
        .order("ended_at", { ascending: false })
        .limit(4),
    ]);

    const active = (activeRaw ?? []) as unknown as PláticaRow[];
    setLive(active.filter((p) => p.status === "live"));
    setScheduled(active.filter((p) => p.status === "scheduled"));
    setEnded((endedRaw ?? []) as unknown as PláticaRow[]);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`platikas-sessions-${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "platikas" }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId, refresh]);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta sesión permanentemente? Esta acción no se puede deshacer.")) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/platikas/${id}`, { method: "DELETE" });
      if (res.ok) {
        await refresh();
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error ?? "Error al eliminar la sesión");
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
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
                <LiveCard
                  key={p.id}
                  p={p}
                  isAdmin={isAdmin}
                  onEdit={() => setEditing(p)}
                />
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
            title="Próximas sesiones"
          />

          {scheduled.length === 0 ? (
            <EmptyScheduled />
          ) : (
            <div className="flex flex-col gap-3">
              {scheduled.map((p) => (
                <ScheduledCard
                  key={p.id}
                  p={p}
                  isAdmin={isAdmin}
                  deleting={deletingId === p.id}
                  onEdit={() => setEditing(p)}
                  onDelete={() => handleDelete(p.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── RECENTLY ENDED ────────────────────────────────────── */}
        {ended.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Archive size={15} style={{ color: "var(--color-text-muted)" }} />
                <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
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
              {ended.map((p) => (
                <EndedCard
                  key={p.id}
                  p={p}
                  isAdmin={isAdmin}
                  deleting={deletingId === p.id}
                  onEdit={() => setEditing(p)}
                  onDelete={() => handleDelete(p.id)}
                />
              ))}
            </div>
          </section>
      )}

      {editing && (
        <EditPlatikaModal
          platika={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await refresh();
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

// ── Section pieces ──────────────────────────────────────────────────────────

function SectionHeader({ badge, title }: { badge: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {badge}
      <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
        {title}
      </h2>
    </div>
  );
}

function AdminControls({
  onEdit,
  onDelete,
  deleting,
}: {
  onEdit: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEdit();
        }}
        title="Editar sesión"
        className="p-1.5 rounded-lg transition-colors"
        style={{
          background: "var(--color-surface-elevated)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text-muted)",
        }}
      >
        <Pencil size={13} />
      </button>
      {onDelete && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          disabled={deleting}
          title="Eliminar sesión"
          className="p-1.5 rounded-lg transition-colors"
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.25)",
            color: "var(--color-destructive)",
          }}
        >
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      )}
    </div>
  );
}

// ── Cards ────────────────────────────────────────────────────────────────────

function LiveCard({
  p,
  isAdmin,
  onEdit,
}: {
  p: PláticaRow;
  isAdmin: boolean;
  onEdit: () => void;
}) {
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
          <img src={p.thumbnail_url} alt={p.title} className="w-full h-full object-cover" />
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
        <div className="flex items-center justify-between gap-2">
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
                style={{ background: "rgba(212,160,23,0.15)", color: "var(--color-primary)" }}
              >
                <Radio size={10} />
                En radio
              </span>
            )}
          </div>
          {isAdmin && <AdminControls onEdit={onEdit} />}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold leading-snug" style={{ color: "var(--color-text)" }}>
          {p.title}
        </h3>

        {p.description && (
          <p className="text-sm line-clamp-2 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            {p.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <HostBadge host={p.profiles} />
          <span className="flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
            Unirse ahora
            <ChevronRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function ScheduledCard({
  p,
  isAdmin,
  deleting,
  onEdit,
  onDelete,
}: {
  p: PláticaRow;
  isAdmin: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Link
      href={`/platikas/${p.id}`}
      className="platika-card rounded-2xl flex items-center gap-4 px-5 py-4"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
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
        <h3 className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
          {p.title}
        </h3>
        {p.description && (
          <p className="text-xs line-clamp-1" style={{ color: "var(--color-text-muted)" }}>
            {p.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-0.5">
          <HostBadge host={p.profiles} small />
          {p.scheduled_at && (
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
              <Clock size={10} />
              {formatDate(p.scheduled_at).split(",")[1]?.trim()}
            </span>
          )}
        </div>
      </div>

      {isAdmin && <AdminControls onEdit={onEdit} onDelete={onDelete} deleting={deleting} />}

      <ChevronRight size={15} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
    </Link>
  );
}

function EndedCard({
  p,
  isAdmin,
  deleting,
  onEdit,
  onDelete,
}: {
  p: PláticaRow;
  isAdmin: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Link
      href={`/platikas/${p.id}`}
      className="ended-card flex gap-3 p-4 rounded-2xl"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {/* Thumbnail or icon */}
      <div
        className="w-16 h-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
        style={{ background: "var(--color-surface-elevated)" }}
      >
        {p.thumbnail_url ? (
          <img src={p.thumbnail_url} alt={p.title} className="w-full h-full object-cover" />
        ) : (
          <Mic size={16} style={{ color: "var(--color-text-muted)" }} />
        )}
      </div>

      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className="px-1.5 py-0.5 rounded text-xs w-fit"
            style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}
          >
            terminada
          </span>
          {isAdmin && <AdminControls onEdit={onEdit} onDelete={onDelete} deleting={deleting} />}
        </div>
        <p className="text-xs font-medium line-clamp-2 leading-snug" style={{ color: "var(--color-text)" }}>
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
    <div className={`flex items-center gap-1.5 ${textSize}`} style={{ color: "var(--color-text-muted)" }}>
      {host?.avatar_url ? (
        <img src={host.avatar_url} alt={name} className={`${size} rounded-full object-cover shrink-0`} />
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
      style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.15)" }}
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
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(212,160,23,0.08)" }}
      >
        <Calendar size={22} style={{ color: "var(--color-text-muted)" }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
          No hay sesiones programadas
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          Los anfitriones verificados pueden programar transmisiones
        </p>
      </div>
    </div>
  );
}
