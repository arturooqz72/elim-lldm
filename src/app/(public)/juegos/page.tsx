import { createClient } from "@/lib/supabase/server";
import { JoinCodeForm } from "@/components/juegos/JoinCodeForm";
import {
  Gamepad2,
  Users,
  Hash,
  ChevronRight,
  Zap,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Juegos Bíblicos — Elim LLDM",
  description:
    "Compite en tiempo real con creyentes de todo el mundo en conocimiento bíblico. Únete a una partida o usa un código de acceso.",
};

export default async function JuegosPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const { code, error: errorParam } = await searchParams;
  const supabase = await createClient();

  // Resolve join-by-code redirect server-side
  if (code) {
    const { data: found } = await supabase
      .from("games")
      .select("id")
      .eq("join_code", code.toUpperCase().trim())
      .in("status", ["lobby", "in_progress"])
      .single();

    if (found) redirect(`/juegos/${(found as { id: string }).id}`);
    // Fall through — show "not found" error
  }

  // Active games with team colors
  const { data: gamesRaw } = await supabase
    .from("games")
    .select(
      "id, title, join_code, status, created_at, profiles(display_name), game_teams(id, name, color)"
    )
    .in("status", ["lobby", "in_progress"])
    .order("created_at", { ascending: false });

  type GameRow = {
    id: string;
    title: string;
    join_code: string;
    status: "lobby" | "in_progress";
    profiles: { display_name: string } | null;
    game_teams: Array<{ id: string; name: string; color: string }>;
  };

  const games = gamesRaw as unknown as GameRow[] | null;

  // Player counts per game
  const gameIds = (games ?? []).map((g) => g.id);
  const playerCountMap = new Map<string, number>();
  if (gameIds.length > 0) {
    const { data: playerRows } = await supabase
      .from("game_players")
      .select("game_id")
      .in("game_id", gameIds);

    (playerRows as Array<{ game_id: string }> | null)?.forEach(({ game_id }) => {
      playerCountMap.set(game_id, (playerCountMap.get(game_id) ?? 0) + 1);
    });
  }

  const totalPlayers = [...playerCountMap.values()].reduce((s, n) => s + n, 0);
  const activeCount = games?.length ?? 0;
  const inProgressCount = games?.filter((g) => g.status === "in_progress").length ?? 0;

  const codeNotFound =
    !!code && !(games ?? []).some((g) => g.join_code === code.toUpperCase().trim());

  return (
    <>
      <style>{`
        .game-card { transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease; }
        .game-card:hover { border-color: rgba(212,160,23,.4) !important; transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,.25); }
      `}</style>

      <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>

        {/* ── HERO ──────────────────────────────────────────────────── */}
        <div
          className="py-12 px-4"
          style={{
            background: "linear-gradient(to bottom, rgba(212,160,23,0.05) 0%, transparent 100%)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div className="max-w-4xl mx-auto flex flex-col gap-5">
            <div>
              <h1
                className="text-4xl font-bold mb-2"
                style={{ color: "var(--color-text)" }}
              >
                Juegos Bíblicos
              </h1>
              <p style={{ color: "var(--color-text-muted)" }}>
                Compite en tiempo real con creyentes de todo el mundo
              </p>
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-4">
              <StatPill
                icon={<Gamepad2 size={13} />}
                label={`${activeCount} ${activeCount === 1 ? "partida activa" : "partidas activas"}`}
                active={activeCount > 0}
              />
              {totalPlayers > 0 && (
                <StatPill
                  icon={<Users size={13} />}
                  label={`${totalPlayers} ${totalPlayers === 1 ? "jugador" : "jugadores"} en línea`}
                  active
                />
              )}
              {inProgressCount > 0 && (
                <StatPill
                  icon={<Zap size={13} />}
                  label={`${inProgressCount} en curso ahora`}
                  highlight
                />
              )}
            </div>
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
              <Hash size={15} style={{ color: "var(--color-primary)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                Unirse con código
              </h2>
            </div>

            {/* Client component for auto-uppercase + instant feedback */}
            <JoinCodeForm
              defaultCode={code ?? ""}
              notFound={codeNotFound}
              serverError={errorParam}
            />
          </div>

          {/* ── ACTIVE GAMES ─────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
                Partidas disponibles
              </h2>
              {activeCount > 0 && (
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    background: "rgba(212,160,23,0.1)",
                    color: "var(--color-primary)",
                  }}
                >
                  {activeCount}
                </span>
              )}
            </div>

            {(!games || games.length === 0) ? (
              <EmptyState />
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {games.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    playerCount={playerCountMap.get(game.id) ?? 0}
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
          ? "rgba(74,222,128,0.1)"
          : active
          ? "rgba(212,160,23,0.08)"
          : "var(--color-surface)",
        border: `1px solid ${highlight ? "rgba(74,222,128,0.2)" : active ? "rgba(212,160,23,0.2)" : "var(--color-border)"}`,
        color: highlight
          ? "var(--color-success)"
          : active
          ? "var(--color-primary)"
          : "var(--color-text-muted)",
      }}
    >
      {icon}
      {label}
    </div>
  );
}

type GameRow = {
  id: string;
  title: string;
  join_code: string;
  status: "lobby" | "in_progress";
  profiles: { display_name: string } | null;
  game_teams: Array<{ id: string; name: string; color: string }>;
};

function GameCard({ game, playerCount }: { game: GameRow; playerCount: number }) {
  const isLive = game.status === "in_progress";

  return (
    <Link
      href={`/juegos/${game.id}`}
      className="game-card flex flex-col gap-4 p-5 rounded-2xl"
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
            background: isLive ? "rgba(74,222,128,0.12)" : "rgba(212,160,23,0.12)",
            color: isLive ? "var(--color-success)" : "var(--color-primary)",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: isLive ? "var(--color-success)" : "var(--color-primary)",
            }}
          />
          {isLive ? "EN CURSO" : "EN SALA"}
        </span>

        <div
          className="flex items-center gap-1 text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          <Users size={12} />
          <span>{playerCount} {playerCount === 1 ? "jugador" : "jugadores"}</span>
        </div>
      </div>

      {/* Title + host */}
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold leading-snug" style={{ color: "var(--color-text)" }}>
          {game.title}
        </h3>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Organizado por {game.profiles?.display_name ?? "Admin"}
        </p>
      </div>

      {/* Teams */}
      {game.game_teams.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {game.game_teams.map((team) => (
            <div key={team.id} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: team.color }}
              />
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
          style={{ color: "var(--color-primary)" }}
        >
          <Hash size={12} />
          {game.join_code}
        </div>
        <span
          className="flex items-center gap-1 text-xs font-semibold"
          style={{ color: "var(--color-primary)" }}
        >
          {isLive ? "Ver partida" : "Unirse"}
          <ChevronRight size={13} />
        </span>
      </div>
    </Link>
  );
}

function EmptyState() {
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
        style={{ background: "rgba(212,160,23,0.08)" }}
      >
        <Gamepad2 size={26} style={{ color: "var(--color-text-muted)" }} />
      </div>
      <div className="text-center">
        <p className="font-medium text-sm" style={{ color: "var(--color-text)" }}>
          No hay partidas activas
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          Un administrador puede crear partidas desde el panel admin
        </p>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Hash,
      title: "Ingresa el código",
      desc: "Comparte el código con amigos o únete directamente desde la lista.",
    },
    {
      icon: Users,
      title: "Elige tu equipo",
      desc: "Selecciona un equipo antes de que la partida inicie.",
    },
    {
      icon: Clock,
      title: "Responde a tiempo",
      desc: "Cada pregunta tiene un temporizador. Más rápido = más puntos.",
    },
    {
      icon: Zap,
      title: "Escala el marcador",
      desc: "Tu puntuación suma al total de tu equipo. ¡Que gane el mejor!",
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
      <div
        className="px-5 py-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
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
              borderBottom:
                i < steps.length - 2 ? "1px solid var(--color-border)" : undefined,
              borderRight:
                i % 2 === 0 ? "1px solid var(--color-border)" : undefined,
            }}
          >
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
