import { Gamepad2, RotateCw, Trophy, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Juegos — Elim LLDM",
  description: "Hub de juegos bíblicos interactivos: Ruleta de retos y Elim Arena.",
};

const GAMES = [
  {
    href: "/juegos/ruleta-elimlldm.html",
    external: true,
    className: "card-ruleta",
    emoji: "🎡",
    icon: RotateCw,
    title: "Ruleta",
    desc: "Gira y descubre tu reto",
    accentBg: "rgba(29,158,117,0.08)",
    accentBorder: "rgba(29,158,117,0.3)",
    accentColor: "#1D9E75",
  },
  {
    href: "/arena",
    external: false,
    className: "card-arena",
    emoji: "🏟️",
    icon: Trophy,
    title: "Elim Arena",
    desc: "Trivia bíblica multijugador en tiempo real",
    accentBg: "rgba(212,160,23,0.08)",
    accentBorder: "rgba(212,160,23,0.3)",
    accentColor: "#D4A017",
  },
] as const;

export default function JuegosHubPage() {
  return (
    <>
      <style>{`
        .game-hub-card {
          transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease;
        }
        .game-hub-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 36px rgba(0,0,0,.28);
        }
        .card-ruleta:hover  { border-color: rgba(29,158,117,.45) !important; }
        .card-arena:hover   { border-color: rgba(212,160,23,.45) !important; }
      `}</style>

      <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>

        {/* ── Hero ──────────────────────────────────────────────── */}
        <div
          className="py-12 px-4"
          style={{
            background: "linear-gradient(to bottom, rgba(212,160,23,0.05) 0%, transparent 100%)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "rgba(212,160,23,0.1)",
                border: "1px solid rgba(212,160,23,0.3)",
              }}
            >
              <Gamepad2 size={32} style={{ color: "var(--color-primary)" }} />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
                Juegos
              </h1>
              <p style={{ color: "var(--color-text-muted)" }}>
                Elige un juego y diviértete con la comunidad Elim
              </p>
            </div>
          </div>
        </div>

        {/* ── Cards grid ─────────────────────────────────────────── */}
        <div className="max-w-2xl mx-auto px-4 py-10">
          <div className="grid sm:grid-cols-2 gap-5">
            {GAMES.map(({ href, external, className, emoji, icon: Icon, title, desc, accentBg, accentBorder, accentColor }) => {
              const cardClassName = `game-hub-card ${className} flex flex-col gap-5 p-7 rounded-2xl`;
              const cardStyle = {
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              };
              const content = (
                <>
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                    style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
                  >
                    {emoji}
                  </div>

                  <div className="flex-1">
                    <h2 className="text-xl font-bold mb-1" style={{ color: "var(--color-text)" }}>
                      {title}
                    </h2>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                      {desc}
                    </p>
                  </div>

                  <div
                    className="flex items-center gap-2 text-sm font-semibold"
                    style={{ color: accentColor }}
                  >
                    <Icon size={15} />
                    <span>Jugar</span>
                    <ChevronRight size={14} className="ml-auto" />
                  </div>
                </>
              );

              return external ? (
                <a key={href} href={href} className={cardClassName} style={cardStyle}>
                  {content}
                </a>
              ) : (
                <Link key={href} href={href} className={cardClassName} style={cardStyle}>
                  {content}
                </Link>
              );
            })}
          </div>
        </div>

      </div>
    </>
  );
}
