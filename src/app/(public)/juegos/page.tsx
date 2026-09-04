import { Gamepad2, RotateCw, Users, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { getEstadoPuertaArenaAbierta } from "@/lib/arena-publica/estado-puerta.server";
import { PuertaArenaAbierta } from "@/components/juegos/PuertaArenaAbierta";

export const metadata: Metadata = {
  title: "Juegos en línea — Elim LLDM",
  description: "Entra directo a jugar con otros miembros — sin códigos, sin esperar a nadie que organice.",
};

export default async function JuegosHubPage() {
  const estadoArenaAbierta = await getEstadoPuertaArenaAbierta();

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
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
            style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}
          >
            <Gamepad2 size={32} style={{ color: "var(--color-primary)" }} />
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
              Juegos en línea
            </h1>
            <p style={{ color: "var(--color-text-muted)" }}>
              Elige una puerta y entra directo — sin códigos
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-4">
        <PuertaArenaAbierta
          disponible={estadoArenaAbierta.disponible}
          jugandoAhora={estadoArenaAbierta.jugandoAhora}
        />

        <Link
          href="/ruleta"
          className="flex items-center gap-4 p-6 rounded-2xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.3)" }}
          >
            <Users size={20} style={{ color: "#3B82F6" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
              Ruleta en línea
            </h2>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Crea una sala y comparte el código con hasta 6 amigos
            </p>
          </div>
          <ChevronRight size={18} style={{ color: "var(--color-text-muted)" }} />
        </Link>

        <a
          href="/juegos/ruleta-elimlldm.html"
          className="flex items-center gap-4 p-6 rounded-2xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: "rgba(29,158,117,0.08)", border: "1px solid rgba(29,158,117,0.3)" }}
          >
            <RotateCw size={20} style={{ color: "#1D9E75" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
              Ruleta de retos
            </h2>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Gira solo y descubre tu reto
            </p>
          </div>
          <ChevronRight size={18} style={{ color: "var(--color-text-muted)" }} />
        </a>
      </div>
    </div>
  );
}
