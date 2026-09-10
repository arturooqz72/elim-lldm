// src/app/(public)/juegos/ahorcado/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Puzzle } from "lucide-react";
import { getProfile } from "@/lib/supabase/server";
import { getRankingIndividual } from "@/lib/juegos/ranking-individual.server";
import { TablaPosiciones } from "@/components/juegos/TablaPosiciones";
import { AhorcadoGame } from "@/components/juegos/ahorcado/AhorcadoGame";

export const metadata: Metadata = {
  title: "Ahorcado del Nuevo Testamento — Elim LLDM",
  description:
    "Adivina personajes, lugares, palabras clave y libros del Nuevo Testamento, letra por letra.",
};

export default async function AhorcadoPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?returnUrl=/juegos/ahorcado");

  const ranking = await getRankingIndividual("ahorcado");

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div
        className="py-10 px-4"
        style={{
          background: "linear-gradient(to bottom, rgba(212,160,23,0.05) 0%, transparent 100%)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}
          >
            <Puzzle size={28} style={{ color: "var(--color-primary)" }} />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--color-text)" }}>
              Ahorcado del Nuevo Testamento
            </h1>
            <p style={{ color: "var(--color-text-muted)" }}>Adivina la palabra letra por letra</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
        <AhorcadoGame />
        <TablaPosiciones
          titulo="Tabla de posiciones — Ahorcado del Nuevo Testamento"
          filas={ranking}
          currentUserId={profile.id}
          unidadSingular="palabra"
          unidadPlural="palabras"
          vacio="Aún nadie ha ganado una palabra. ¡Sé el primero!"
        />
      </div>
    </div>
  );
}
