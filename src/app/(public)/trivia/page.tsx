import { createClient, getProfile } from "@/lib/supabase/server";
import { TriviaJoinCodeForm } from "@/components/trivia/TriviaJoinCodeForm";
import {
  Sparkles,
  Users,
  Hash,
  ChevronRight,
  Plus,
  BookOpen,
  Smartphone,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import type { TriviaDifficulty } from "@/types";
import { TRIVIA_DIFFICULTY_LABEL } from "@/types";

export const metadata: Metadata = {
  title: "Trivia en Vivo — Elim LLDM",
  description:
    "Compite en trivia bíblica en tiempo real, forma tu equipo y sube al marcador. Salas verticales listas para transmitir.",
};

const DIFFICULTY_COLOR: Record<TriviaDifficulty, string> = {
  facil: "var(--color-success)",
  medio: "var(--trivia-gold)",
  dificil: "var(--color-destructive)",
};

export default async function TriviaLobbyPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const { code, error: errorParam } = await searchParams;
  const supabase = await createClient();
  const profile = await getProfile();

  const canHost =
    !!profile && (profile.role === "admin" || profile.role === "anfitrion") && profile.verified_lldm;

  // Resolve join-by-code redirect server-side
  if (code) {
    const { data: found } = await supabase
      .from("trivia_rooms")
      .select("id")
      .eq("join_code", code.toUpperCase().trim())
      .in("status", ["lobby", "in_progress"])
      .single();

    if (found) {
      const { redirect } = await import("next/navigation");
      redirect(`/trivia/${(found as { id: string }).id}`);
    }
  }

  const { data: roomsRaw } = await supabase
    .from("trivia_rooms")
    .select(
      "id, name, category, difficulty, status, join_code, created_at, profiles(display_name), trivia_teams(id, name, color)"
    )
    .in("status", ["lobby", "in_progress"])
    .order("created_at", { ascending: false });

  type RoomRow = {
    id: string;
    name: string;
    category: string;
    difficulty: TriviaDifficulty;
    status: "lobby" | "in_progress";
    join_code: string;
    profiles: { display_name: string } | null;
    trivia_teams: Array<{ id: string; name: string; color: string }>;
  };

  const rooms = roomsRaw as unknown as RoomRow[] | null;

  // Connected player counts per room
  const roomIds = (rooms ?? []).map((r) => r.id);
  const playerCountMap = new Map<string, number>();
  if (roomIds.length > 0) {
    const { data: playerRows } = await supabase
      .from("trivia_players")
      .select("room_id")
      .in("room_id", roomIds);

    (playerRows as Array<{ room_id: string }> | null)?.forEach(({ room_id }) => {
      playerCountMap.set(room_id, (playerCountMap.get(room_id) ?? 0) + 1);
    });
  }

  const totalPlayers = [...playerCountMap.values()].reduce((s, n) => s + n, 0);
  const activeCount = rooms?.length ?? 0;
  const liveCount = rooms?.filter((r) => r.status === "in_progress").length ?? 0;

  const codeNotFound =
    !!code && !(rooms ?? []).some((r) => r.join_code === code.toUpperCase().trim());

  return (
    <>
      <style>{`
        .trivia-card { transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease; }
        .trivia-card:hover { border-color: rgba(245,200,66,.45) !important; transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,.3); }
        .trivia-cta:hover { box-shadow: 0 0 24px rgba(245,200,66,.45); }
      `}</style>

      <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>

        {/* ── HERO ──────────────────────────────────────────────────── */}
        <div
          className="py-12 px-4"
          style={{
            background: "linear-gradient(to bottom, rgba(245,200,66,0.06) 0%, transparent 100%)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div className="max-w-4xl mx-auto flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={18} style={{ color: "var(--trivia-gold)" }} />
                  <h1 className="text-4xl font-bold" style={{ color: "var(--color-text)" }}>
                    Trivia en Vivo
                  </h1>
                </div>
                <p style={{ color: "var(--color-text-muted)" }}>
                  Forma tu equipo, responde rápido y escala el marcador — en vivo y en vertical.
                </p>
              </div>

              {canHost && (
                <Link
                  href="/trivia/nueva"
                  className="trivia-cta hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shrink-0 transition-all duration-200"
                  style={{ background: "var(--trivia-gold)", color: "#1a1500" }}
                >
                  <Plus size={15} />
                  Crear sala
                </Link>
              )}
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap items-center gap-4">
              <StatPill
                icon={<Sparkles size={13} />}
                label={`${activeCount} ${activeCount === 1 ? "sala activa" : "salas activas"}`}
                active={activeCount > 0}
              />
              {totalPlayers > 0 && (
                <StatPill
                  icon={<Users size={13} />}
                  label={`${totalPlayers} ${totalPlayers === 1 ? "jugador conectado" : "jugadores conectados"}`}
                  active
                />
              )}
              {liveCount > 0 && (
                <StatPill
                  icon={<Trophy size={13} />}
                  label={`${liveCount} en curso ahora`}
                  highlight
                />
              )}
              <span
                className="flex items-center gap-1.5 text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                <Smartphone size={13} />
                Optimizado para vertical 9:16
              </span>
            </div>

            {canHost && (
              <Link
                href="/trivia/nueva"
                className="trivia-cta sm:hidden flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{ background: "var(--trivia-gold)", color: "#1a1500" }}
              >
                <Plus size={15} />
                Crear sala
              </Link>
            )}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-8">

          {/* ── JOIN BY CODE ─────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Hash size={15} style={{ color: "var(--trivia-gold)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                Unirse con código
              </h2>
            </div>

            <TriviaJoinCodeForm
              defaultCode={code ?? ""}
              notFound={codeNotFound}
              serverError={errorParam}
            />
          </div>

          {/* ── ACTIVE ROOMS ─────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
                Salas activas
              </h2>
              {activeCount > 0 && (
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    background: "rgba(245,200,66,0.12)",
                    color: "var(--trivia-gold)",
                  }}
                >
                  {activeCount}
                </span>
              )}
            </div>

            {(!rooms || rooms.length === 0) ? (
              <EmptyState canHost={canHost} />
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {rooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    playerCount={playerCountMap.get(room.id) ?? 0}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
          <HowItWorks />

        </div>
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatPill({
  icon,
  label,
  active,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{
        background: highlight
          ? "rgba(184,134,11,0.15)"
          : active
          ? "rgba(245,200,66,0.1)"
          : "var(--color-surface)",
        border: `1px solid ${highlight ? "rgba(184,134,11,0.35)" : active ? "rgba(245,200,66,0.25)" : "var(--color-border)"}`,
        color: highlight ? "var(--trivia-gold)" : active ? "var(--trivia-gold)" : "var(--color-text-muted)",
      }}
    >
      {icon}
      {label}
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: TriviaDifficulty }) {
  const color = DIFFICULTY_COLOR[difficulty];
  return (
    <span
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide"
      style={{ background: `${color}1F`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {TRIVIA_DIFFICULTY_LABEL[difficulty]}
    </span>
  );
}

type RoomRow = {
  id: string;
  name: string;
  category: string;
  difficulty: TriviaDifficulty;
  status: "lobby" | "in_progress";
  join_code: string;
  profiles: { display_name: string } | null;
  trivia_teams: Array<{ id: string; name: string; color: string }>;
};

function RoomCard({ room, playerCount }: { room: RoomRow; playerCount: number }) {
  const isLive = room.status === "in_progress";

  return (
    <Link
      href={`/trivia/${room.id}`}
      className="trivia-card flex flex-col gap-4 p-5 rounded-2xl"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Top row: status + player count */}
      <div className="flex items-center justify-between">
        <span
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${isLive ? "animate-pulse" : ""}`}
          style={{
            background: isLive ? "rgba(74,222,128,0.12)" : "rgba(245,200,66,0.14)",
            color: isLive ? "var(--color-success)" : "var(--trivia-gold)",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: isLive ? "var(--color-success)" : "var(--trivia-gold)" }}
          />
          {isLive ? "EN CURSO" : "EN SALA"}
        </span>

        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
          <Users size={12} />
          <span>{playerCount} {playerCount === 1 ? "jugador" : "jugadores"}</span>
        </div>
      </div>

      {/* Title + host */}
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold leading-snug" style={{ color: "var(--color-text)" }}>
          {room.name}
        </h3>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Organizado por {room.profiles?.display_name ?? "Anfitrión"}
        </p>
      </div>

      {/* Category + difficulty */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          <BookOpen size={11} />
          {room.category}
        </span>
        <DifficultyBadge difficulty={room.difficulty} />
      </div>

      {/* Teams */}
      {room.trivia_teams.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {room.trivia_teams.map((team) => (
            <div key={team.id} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: team.color }} />
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {team.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom row: code + CTA */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <div
          className="flex items-center gap-1 text-sm font-mono font-bold"
          style={{ color: "var(--trivia-gold)" }}
        >
          <Hash size={12} />
          {room.join_code}
        </div>
        <span
          className="flex items-center gap-1 text-xs font-semibold"
          style={{ color: "var(--trivia-gold)" }}
        >
          {isLive ? "Ver sala" : "Unirse"}
          <ChevronRight size={13} />
        </span>
      </div>
    </Link>
  );
}

function EmptyState({ canHost }: { canHost: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 rounded-2xl gap-3"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(245,200,66,0.1)" }}
      >
        <Sparkles size={26} style={{ color: "var(--color-text-muted)" }} />
      </div>
      <div className="text-center">
        <p className="font-medium text-sm" style={{ color: "var(--color-text)" }}>
          No hay salas activas
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          {canHost
            ? "Crea una sala y comparte el código con tu audiencia"
            : "Un anfitrión verificado puede abrir una sala de trivia"}
        </p>
      </div>
      {canHost && (
        <Link
          href="/trivia/nueva"
          className="trivia-cta flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold mt-1 transition-all duration-200"
          style={{ background: "var(--trivia-gold)", color: "#1a1500" }}
        >
          <Plus size={15} />
          Crear sala
        </Link>
      )}
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Hash,
      title: "Entra a la sala",
      desc: "Únete desde la lista o con el código que muestra el anfitrión en pantalla.",
    },
    {
      icon: Users,
      title: "Forma tu equipo",
      desc: "Crea un equipo con el nombre que quieras o únete a uno que ya exista.",
    },
    {
      icon: Hash,
      title: "Responde a tiempo",
      desc: "Cada pregunta tiene 15-30 segundos y 4 opciones. Más rápido = más puntos.",
    },
    {
      icon: Trophy,
      title: "Domina el marcador",
      desc: "Tu puntaje suma al de tu equipo. Al final se corona al equipo campeón.",
    },
  ];

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          ¿Cómo funciona?
        </h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-0">
        {steps.map(({ icon: Icon, title, desc }, i) => (
          <div
            key={title}
            className="flex gap-3 p-5"
            style={{
              borderBottom: i < steps.length - 2 ? "1px solid var(--color-border)" : undefined,
              borderRight: i % 2 === 0 ? "1px solid var(--color-border)" : undefined,
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: "rgba(245,200,66,0.1)" }}
            >
              <Icon size={15} style={{ color: "var(--trivia-gold)" }} />
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
