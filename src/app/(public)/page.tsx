import Link from "next/link";
import { getNowPlaying } from "@/lib/azuracast/api";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDuration } from "@/lib/utils";
import {
  Radio,
  Mic,
  Gamepad2,
  Archive,
  Play,
  ChevronRight,
  Wifi,
  Eye,
  Calendar,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Elim LLDM — Predicando la Fe al Mundo",
  description:
    "Plataforma cristiana LLDM: radio 24/7, pláticas en vivo con debate, juegos bíblicos en tiempo real y archivo de grabaciones. Abierto a todo el mundo.",
};

export default async function LandingPage() {
  const supabase = await createClient();

  const [nowPlaying, { data: upcomingRaw }, { data: archiveRaw }] =
    await Promise.all([
      getNowPlaying(),
      supabase
        .from("platikas")
        .select("id, title, status, scheduled_at, host_id")
        .in("status", ["live", "scheduled"])
        .order("scheduled_at", { ascending: true })
        .limit(3),
      supabase
        .from("archive")
        .select("id, title, thumbnail_url, duration_seconds, view_count, categories(name, slug)")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(4),
    ]);

  type PláticaRow = { id: string; title: string; status: string; scheduled_at: string | null };
  type ArchiveRow = {
    id: string;
    title: string;
    thumbnail_url: string | null;
    duration_seconds: number | null;
    view_count: number;
    categories: { name: string; slug: string } | null;
  };

  const upcoming = upcomingRaw as PláticaRow[] | null;
  const recentArchive = archiveRaw as unknown as ArchiveRow[] | null;
  const livePláticas = upcoming?.filter((p) => p.status === "live") ?? [];
  const scheduledPláticas = upcoming?.filter((p) => p.status === "scheduled") ?? [];

  return (
    <>
      <style>{`
        .feature-card { transition: border-color 0.2s ease, transform 0.2s ease; }
        .feature-card:hover { border-color: rgba(212,160,23,0.4) !important; transform: translateY(-3px); }
        .hero-btn-primary:hover { box-shadow: 0 0 28px rgba(212,160,23,0.45); }
        .hero-btn-secondary:hover { border-color: rgba(212,160,23,0.35) !important; color: var(--color-text) !important; }
        .archive-card { transition: border-color 0.2s ease, transform 0.2s ease; }
        .archive-card:hover { border-color: rgba(212,160,23,0.35) !important; transform: translateY(-2px); }
        .archive-card:hover .archive-play-overlay { opacity: 1; }
        .archive-play-overlay { opacity: 0; transition: opacity 0.2s ease; }
        .platika-row { transition: background 0.15s ease; }
        .platika-row:hover { background: rgba(212,160,23,0.05) !important; }
      `}</style>

      <div style={{ background: "var(--color-bg)" }}>

        {/* ── HERO ─────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-4 pt-24 pb-20 md:pt-32 md:pb-28">
          {/* Hero background video */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <video
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: 0.6 }}
            >
              <source src="/videos/elim-intro.mp4" type="video/mp4" />
            </video>
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(10,10,18,0.25) 0%, rgba(10,10,18,0.65) 75%, var(--color-bg) 100%)",
              }}
            />
          </div>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(212,160,23,0.11) 0%, transparent 65%)",
            }}
          />
          {/* Subtle grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage:
                "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
              maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 70%)",
            }}
          />

          <div className="max-w-4xl mx-auto text-center relative z-10 flex flex-col items-center gap-7">
            {/* Live pill */}
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider"
              style={{
                background: "rgba(212,160,23,0.1)",
                border: "1px solid rgba(212,160,23,0.25)",
                color: "var(--color-primary)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "var(--color-live)" }}
              />
              Radio en vivo 24/7
              {nowPlaying && nowPlaying.listeners.current > 0 && (
                <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>
                  · {nowPlaying.listeners.current} oyentes
                </span>
              )}
            </div>

            {/* Main title */}
            <h1
              className="text-5xl md:text-[4.5rem] font-bold leading-[1.1] tracking-tight"
              style={{ color: "var(--color-text)" }}
            >
              Donde la{" "}
              <span
                style={{
                  color: "var(--color-primary)",
                  fontFamily: "var(--font-cinzel)",
                }}
              >
                fe
              </span>{" "}
              se vive y se comparte
            </h1>

            <p
              className="text-lg md:text-xl max-w-2xl leading-relaxed"
              style={{ color: "var(--color-text-muted)" }}
            >
              La plataforma de la comunidad LLDM abierta a todos. Escucha la radio,
              participa en pláticas en vivo, compite en juegos bíblicos y accede al
              archivo completo de la doctrina.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-3 mt-1">
              <Link
                href="/radio"
                className="hero-btn-primary flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-base transition-all duration-200"
                style={{ background: "var(--color-primary)", color: "#000" }}
              >
                <Play size={17} fill="currentColor" />
                Escuchar Radio
              </Link>
              <Link
                href="/platikas"
                className="hero-btn-secondary flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-base transition-all duration-200"
                style={{
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-muted)",
                }}
              >
                Ver Pláticas
                <ChevronRight size={16} />
              </Link>
            </div>

            {/* Now playing strip */}
            {nowPlaying?.now_playing?.song?.title && (
              <div
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl mt-2"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <span
                  className="flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: "var(--color-live)", color: "#fff" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  EN VIVO
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
                    {nowPlaying.now_playing.song.title}
                  </p>
                  {nowPlaying.now_playing.song.artist && (
                    <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                      {nowPlaying.now_playing.song.artist}
                    </p>
                  )}
                </div>
                <Link
                  href="/radio"
                  className="shrink-0 flex items-center gap-1 text-xs font-medium"
                  style={{ color: "var(--color-primary)" }}
                >
                  <Radio size={12} />
                  Escuchar
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ── LIVE ALERT ───────────────────────────────────────────── */}
        {livePláticas.length > 0 && (
          <section className="px-4 pb-4">
            <div className="max-w-5xl mx-auto">
              <div
                className="rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3"
                style={{
                  background: "rgba(255,68,68,0.06)",
                  border: "1px solid rgba(255,68,68,0.2)",
                }}
              >
                <span
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shrink-0"
                  style={{ background: "var(--color-live)", color: "#fff" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  EN VIVO AHORA
                </span>
                <div className="flex flex-col gap-1 flex-1">
                  {livePláticas.map((p) => (
                    <Link
                      key={p.id}
                      href={`/platikas/${p.id}`}
                      className="text-sm font-medium hover:underline"
                      style={{ color: "var(--color-text)" }}
                    >
                      {p.title}
                    </Link>
                  ))}
                </div>
                <Link
                  href="/platikas"
                  className="shrink-0 flex items-center gap-1 text-sm font-semibold"
                  style={{ color: "var(--color-live)" }}
                >
                  Unirse <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── FEATURE CARDS ────────────────────────────────────────── */}
        <section className="px-4 py-14">
          <div className="max-w-5xl mx-auto">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  icon: Radio,
                  title: "Radio en Vivo",
                  description:
                    "Transmisión continua 24/7 de música cristiana y mensajes espirituales desde cualquier parte del mundo.",
                  href: "/radio",
                  cta: "Escuchar",
                },
                {
                  icon: Mic,
                  title: "Sala de Pláticas",
                  description:
                    "Pláticas en vivo con debate abierto. Solicita subir al escenario, chatea y comparte tu fe.",
                  href: "/platikas",
                  cta: "Ver pláticas",
                },
                {
                  icon: Gamepad2,
                  title: "Juegos Bíblicos",
                  description:
                    "Compite en tiempo real con creyentes de todo el mundo. Forma equipo y demuestra tu conocimiento.",
                  href: "/juegos",
                  cta: "Jugar",
                },
                {
                  icon: Archive,
                  title: "Archivo",
                  description:
                    "Todas las pláticas grabadas organizadas por tema y categoría. El acervo completo de la doctrina LLDM.",
                  href: "/archivo",
                  cta: "Explorar",
                },
              ].map(({ icon: Icon, title, description, href, cta }) => (
                <Link
                  key={href}
                  href={href}
                  className="feature-card group rounded-2xl p-6 flex flex-col gap-4"
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(212,160,23,0.1)" }}
                  >
                    <Icon size={20} style={{ color: "var(--color-primary)" }} />
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <h3 className="font-semibold" style={{ color: "var(--color-text)" }}>
                      {title}
                    </h3>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {description}
                    </p>
                  </div>
                  <span
                    className="flex items-center gap-1 text-sm font-medium"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {cta}
                    <ChevronRight size={13} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── UPCOMING PLÁTICAS ────────────────────────────────────── */}
        {scheduledPláticas.length > 0 && (
          <section className="px-4 pb-14">
            <div className="max-w-5xl mx-auto">
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between px-6 py-4"
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  <div className="flex items-center gap-2">
                    <Mic size={15} style={{ color: "var(--color-primary)" }} />
                    <h2 className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
                      Próximas pláticas
                    </h2>
                  </div>
                  <Link
                    href="/platikas"
                    className="text-xs flex items-center gap-0.5"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Ver todas <ChevronRight size={12} />
                  </Link>
                </div>

                {/* Rows */}
                <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                  {scheduledPláticas.map((p) => (
                    <Link
                      key={p.id}
                      href={`/platikas/${p.id}`}
                      className="platika-row flex items-center gap-4 px-6 py-4"
                      style={{ background: "transparent" }}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "rgba(212,160,23,0.08)" }}
                      >
                        <Calendar size={15} style={{ color: "var(--color-primary)" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: "var(--color-text)" }}
                        >
                          {p.title}
                        </p>
                        {p.scheduled_at && (
                          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                            {formatDate(p.scheduled_at)}
                          </p>
                        )}
                      </div>
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
                        style={{
                          background: "rgba(212,160,23,0.1)",
                          color: "var(--color-primary)",
                        }}
                      >
                        Programada
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── RECENT ARCHIVE ───────────────────────────────────────── */}
        {recentArchive && recentArchive.length > 0 && (
          <section className="px-4 pb-14">
            <div className="max-w-5xl mx-auto flex flex-col gap-6">
              {/* Section header */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
                    Últimas grabaciones
                  </h2>
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Las pláticas más recientes del archivo
                  </p>
                </div>
                <Link
                  href="/archivo"
                  className="hidden sm:flex items-center gap-1 text-sm font-medium"
                  style={{ color: "var(--color-primary)" }}
                >
                  Ver todo <ChevronRight size={14} />
                </Link>
              </div>

              {/* 2×2 grid (desktop) / 1-col (mobile) */}
              <div className="grid sm:grid-cols-2 gap-4">
                {recentArchive.map((item) => (
                  <Link
                    key={item.id}
                    href={`/archivo/${item.id}`}
                    className="archive-card flex gap-4 p-4 rounded-2xl"
                    style={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {/* Thumbnail */}
                    <div
                      className="relative w-24 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                      style={{ background: "var(--color-surface-elevated)" }}
                    >
                      {item.thumbnail_url ? (
                        <img
                          src={item.thumbnail_url}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Play size={18} style={{ color: "var(--color-primary)" }} />
                      )}
                      <div
                        className="archive-play-overlay absolute inset-0 flex items-center justify-center"
                        style={{ background: "rgba(10,10,18,0.55)" }}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: "var(--color-primary)", color: "#000" }}
                        >
                          <Play size={13} fill="currentColor" />
                        </div>
                      </div>
                      {item.duration_seconds != null && (
                        <span
                          className="absolute bottom-1 right-1 px-1 py-0.5 rounded text-xs font-mono"
                          style={{ background: "rgba(10,10,18,0.75)", color: "var(--color-text)", fontSize: "10px" }}
                        >
                          {formatDuration(item.duration_seconds)}
                        </span>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      {item.categories && (
                        <span className="text-xs font-medium" style={{ color: "var(--color-primary)" }}>
                          {item.categories.name}
                        </span>
                      )}
                      <h3
                        className="text-sm font-semibold leading-snug line-clamp-2"
                        style={{ color: "var(--color-text)" }}
                      >
                        {item.title}
                      </h3>
                      <div
                        className="flex items-center gap-1 text-xs mt-auto"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        <Eye size={10} />
                        <span>{item.view_count.toLocaleString()}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Mobile ver todo */}
              <Link
                href="/archivo"
                className="sm:hidden flex items-center gap-1 text-sm font-medium"
                style={{ color: "var(--color-primary)" }}
              >
                Ver todo el archivo <ChevronRight size={14} />
              </Link>
            </div>
          </section>
        )}

        {/* ── BOTTOM CTA ───────────────────────────────────────────── */}
        <section className="px-4 pb-20">
          <div className="max-w-5xl mx-auto">
            <div
              className="relative rounded-3xl overflow-hidden px-8 py-14 flex flex-col items-center text-center gap-5"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              {/* Gold glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse 70% 50% at 50% 100%, rgba(212,160,23,0.07) 0%, transparent 70%)",
                }}
              />

              <div className="relative z-10 flex flex-col items-center gap-5">
                <div
                  className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    background: "rgba(212,160,23,0.1)",
                    border: "1px solid rgba(212,160,23,0.2)",
                    color: "var(--color-primary)",
                  }}
                >
                  <Wifi size={12} />
                  Acceso libre y gratuito
                </div>

                <h2
                  className="text-2xl md:text-3xl font-bold"
                  style={{ color: "var(--color-text)" }}
                >
                  Únete a la comunidad LLDM
                </h2>
                <p
                  className="text-sm md:text-base max-w-lg leading-relaxed"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Crea tu cuenta con Google para chatear en pláticas en vivo,
                  solicitar subir al escenario de debate y competir en juegos bíblicos.
                  Sin costo, sin requisitos.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <Link
                    href="/login"
                    className="hero-btn-primary flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200"
                    style={{ background: "var(--color-primary)", color: "#000" }}
                  >
                    Crear cuenta con Google
                  </Link>
                  <Link
                    href="/radio"
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    <Radio size={15} />
                    O escucha la radio sin cuenta
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
