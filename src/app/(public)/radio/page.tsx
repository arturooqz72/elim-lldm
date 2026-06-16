import { getNowPlaying } from "@/lib/azuracast/api";
import { RadioPlayer } from "@/components/radio/RadioPlayer";
import { Radio, Wifi } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Radio en Vivo — Elim LLDM",
  description: "Escucha Elim LLDM Radio en vivo, 24/7. Transmisión continua de música cristiana y mensajes espirituales de la fe LLDM.",
};

export default async function RadioPage() {
  const nowPlaying = await getNowPlaying();

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--color-bg)" }}
    >
      {/* Hero + Player with video background */}
      <div
        className="relative overflow-hidden"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
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

        {/* Hero text */}
        <div className="relative z-10 py-16 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
              style={{
                background: "rgba(212,160,23,0.1)",
                border: "1px solid rgba(212,160,23,0.2)",
                color: "var(--color-primary)",
              }}
            >
              <Wifi size={12} />
              Transmisión continua 24 / 7
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-3" style={{ color: "var(--color-text)" }}>
              Elim{" "}
              <span style={{ color: "var(--color-primary)" }}>LLDM</span> Radio
            </h1>
            <p className="text-base" style={{ color: "var(--color-text-muted)" }}>
              Música cristiana, pláticas y mensajes espirituales de la fe de la Luz del Mundo
            </p>
          </div>
        </div>

        {/* Player — all metadata passed as props, no separate metadata card */}
        <div className="relative z-10 max-w-2xl mx-auto px-4 pb-10 flex flex-col gap-6">
          <RadioPlayer
            listenerCount={nowPlaying?.listeners.current}
            nowPlayingTitle={nowPlaying?.now_playing.song.title}
            nowPlayingArtist={nowPlaying?.now_playing.song.artist}
            albumArt={nowPlaying?.now_playing.song.art}
          />

          {/* Live streamer badge */}
          {nowPlaying?.live.is_live && nowPlaying.live.streamer_name && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{
                background: "rgba(255,68,68,0.08)",
                border: "1px solid rgba(255,68,68,0.2)",
              }}
            >
              <span
                className="w-2 h-2 rounded-full animate-pulse shrink-0"
                style={{ background: "var(--color-live)" }}
              />
              <p className="text-sm" style={{ color: "var(--color-text)" }}>
                <span style={{ color: "var(--color-live)", fontWeight: 600 }}>
                  {nowPlaying.live.streamer_name}
                </span>{" "}
                está transmitiendo en vivo ahora
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="grid sm:grid-cols-2 gap-4">
          <InfoCard
            icon={<Radio size={18} style={{ color: "var(--color-primary)" }} />}
            title="Señal estable"
            description="Stream de alta calidad desde servidores dedicados en AzuraCast"
          />
          <InfoCard
            icon={<Wifi size={18} style={{ color: "var(--color-primary)" }} />}
            title="Sin interrupciones"
            description="Si experimentas cortes, refresca la página para reconectar"
          />
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex gap-3"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "rgba(212,160,23,0.1)" }}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          {title}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          {description}
        </p>
      </div>
    </div>
  );
}
