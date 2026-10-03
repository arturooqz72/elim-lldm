// src/app/(public)/juegos/palabra/page.tsx
import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";
import { getProfile } from "@/lib/supabase/server";
import { numeroDelDia, sumarDias } from "@/lib/palabra/logica";
import { fechaDeHoy, getEstadoJugador, getRankings, hayPalabraHoy } from "@/lib/palabra/servidor";
import { PalabraGame } from "@/components/juegos/palabra/PalabraGame";
import { PalabraRanking } from "@/components/juegos/palabra/PalabraRanking";

export const metadata: Metadata = {
  title: "Palabra del Día — Elim LLDM",
  description:
    "Reto diario: adivina la palabra bíblica de 5 letras en 6 intentos. Una palabra nueva cada día para todos.",
};

// Depende de la fecha y de la sesión: nunca se cachea.
export const dynamic = "force-dynamic";

function etiquetaFecha(fecha: string): string {
  // Mediodía UTC para que ninguna zona horaria la corra de día al formatear.
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${fecha}T12:00:00Z`));
}

export default async function PalabraDelDiaPage() {
  const hoy = fechaDeHoy();
  // A diferencia de Ahorcado, aquí NO se exige sesión: sin sesión el
  // progreso se guarda en localStorage y se invita a iniciar sesión.
  const profile = await getProfile();

  const [hayPalabra, estado, rankings] = await Promise.all([
    hayPalabraHoy(hoy),
    profile ? getEstadoJugador(profile.id, hoy) : Promise.resolve(null),
    getRankings(hoy),
  ]);

  const etiquetaSemana = `${etiquetaFecha(rankings.inicioSemana)} – ${etiquetaFecha(
    sumarDias(rankings.inicioSemana, 6)
  )}`;

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div
        // En celular se oculta: el título va en la barra del juego para que
        // tablero y teclado quepan en pantalla sin scroll.
        className="hidden sm:block py-10 px-4"
        style={{
          background: "linear-gradient(to bottom, rgba(212,160,23,0.05) 0%, transparent 100%)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-2 sm:gap-3">
          <div
            className="flex w-14 h-14 rounded-2xl items-center justify-center"
            style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}
          >
            <CalendarCheck size={28} style={{ color: "var(--color-primary)" }} />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--color-text)" }}>
              Palabra del Día
            </h1>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Una palabra bíblica nueva cada día · {etiquetaFecha(hoy)}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-3 sm:px-4 py-3 sm:py-8 flex flex-col gap-6">
        <PalabraGame
          fecha={hoy}
          numero={numeroDelDia(hoy)}
          hayPalabra={hayPalabra}
          conSesion={Boolean(profile)}
          estadoInicial={estado}
        />

        <PalabraRanking
          semanal={rankings.semanal}
          rachas={rankings.rachas}
          iglesias={rankings.iglesias}
          etiquetaSemana={etiquetaSemana}
          usuario={
            profile
              ? { id: profile.id as string, iglesia: (profile.iglesia as string | null | undefined) ?? null }
              : null
          }
        />
      </div>
    </div>
  );
}
