import { createClient, getProfile } from "@/lib/supabase/server";
import { Mic, Radio, Users } from "lucide-react";
import type { Metadata } from "next";
import { GoLiveButton } from "@/components/platikas/GoLiveButton";
import { PlatikaSessions, type PláticaRow } from "@/components/platikas/PlatikaSessions";

export const metadata: Metadata = {
  title: "Estudio en Vivo — Elim LLDM",
  description:
    "Transmisiones en vivo y sesiones programadas de la fe LLDM. Participa en el debate, chatea y solicita subir al escenario.",
};

const SESSION_SELECT =
  "id, title, description, status, scheduled_at, started_at, ended_at, thumbnail_url, radio_output_active, host_id, profiles(display_name, avatar_url)";

export default async function PlatikaListPage() {
  const supabase = await createClient();
  const profile = await getProfile();
  const canGoLive = profile?.role === "admin" || profile?.role === "anfitrion";
  const isAdmin = profile?.role === "admin";

  const [{ data: activeRaw }, { data: endedRaw }] = await Promise.all([
    supabase
      .from("platikas")
      .select(SESSION_SELECT)
      .in("status", ["live", "scheduled"])
      .order("status", { ascending: true }) // live sorts before scheduled alphabetically? No — let's sort manually
      .order("scheduled_at", { ascending: true }),

    supabase
      .from("platikas")
      .select(SESSION_SELECT)
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
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1
                  className="text-4xl font-bold mb-2"
                  style={{ color: "var(--color-text)" }}
                >
                  Estudio en Vivo – Elim
                </h1>
                <p style={{ color: "var(--color-text-muted)" }}>
                  Transmisiones en vivo con debate, chat y escenario abierto
                </p>
              </div>
              {canGoLive && <GoLiveButton />}
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
                  label={`${scheduled.length} ${scheduled.length === 1 ? "sesión programada" : "sesiones programadas"}`}
                />
              )}
              {live.length === 0 && scheduled.length === 0 && (
                <Pill dot="muted" label="Sin transmisiones activas" />
              )}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-10">

          <PlatikaSessions
            initialLive={live}
            initialScheduled={scheduled}
            initialEnded={(ended as PláticaRow[] | null) ?? []}
            isAdmin={isAdmin}
          />

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
          ¿Cómo funciona el Estudio en Vivo?
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
            desc: "Algunas sesiones del Estudio en Vivo se transmiten simultáneamente en Elim LLDM Radio.",
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
