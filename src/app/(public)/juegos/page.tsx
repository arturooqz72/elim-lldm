import { Gamepad2, RotateCw, ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { getEstadoPuertaArenaAbierta } from "@/lib/arena-publica/estado-puerta.server";
import { PuertaArenaAbierta } from "@/components/juegos/PuertaArenaAbierta";
import { getEstadoPuertaRuleta } from "@/lib/ruleta/estado-puerta.server";
import { PuertaRuleta } from "@/components/juegos/PuertaRuleta";
import { getTablaPosiciones } from "@/lib/juegos/tabla-posiciones.server";
import { TablaPosiciones } from "@/components/juegos/TablaPosiciones";
import { getProfile } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Juegos en línea — Elim LLDM",
  description: "Entra directo a jugar con otros miembros — sin códigos, sin esperar a nadie que organice.",
};

export default async function JuegosHubPage() {
  // En paralelo: las dos puertas y sus dos tablas de posiciones son
  // consultas independientes, así que encadenarlas con await sueltos haría
  // esperar a la página cinco viajes seguidos a Supabase en vez de uno.
  const [estadoArenaAbierta, estadoRuleta, posicionesArena, posicionesRuleta, profile] =
    await Promise.all([
      getEstadoPuertaArenaAbierta(),
      getEstadoPuertaRuleta(),
      getTablaPosiciones("arena_abierta"),
      getTablaPosiciones("ruleta"),
      // null si el visitante no inició sesión — /juegos es pública y la
      // tabla debe verse igual, solo que sin resaltar ninguna fila.
      getProfile(),
    ]);

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
        {/* Antes solo se llegaba aquí desde un link enterrado en las
            páginas viejas de Arena/Trivia con código (ya fuera del flujo
            principal desde el rediseño de Fase 1/2) — nadie la
            encontraba. Ahora es visible desde el propio hub. */}
        <Link
          href="/juegos/jugadores"
          className="flex items-center gap-4 p-6 rounded-2xl transition-transform duration-200 hover:scale-[1.01]"
          style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.3)" }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(37,211,102,0.15)" }}
          >
            <Users size={20} style={{ color: "#25D366" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
              Jugadores en línea
            </h2>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Apúntate para que te inviten, o activa el aviso de cuando alguien se conecta
            </p>
          </div>
          <ChevronRight size={18} style={{ color: "var(--color-text-muted)" }} />
        </Link>

        <div className="flex flex-col gap-3">
          <PuertaArenaAbierta
            disponible={estadoArenaAbierta.disponible}
            jugandoAhora={estadoArenaAbierta.jugandoAhora}
          />
          <TablaPosiciones
            titulo="Tabla de posiciones — Trivia en línea"
            filas={posicionesArena}
            currentUserId={profile?.id ?? null}
          />
        </div>

        <div className="flex flex-col gap-3">
          <PuertaRuleta disponible={estadoRuleta.disponible} jugandoAhora={estadoRuleta.jugandoAhora} />
          <TablaPosiciones
            titulo="Tabla de posiciones — La Ruleta en línea"
            filas={posicionesRuleta}
            currentUserId={profile?.id ?? null}
          />
        </div>

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
