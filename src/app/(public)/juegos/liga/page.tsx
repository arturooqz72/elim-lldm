// src/app/(public)/juegos/liga/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Trophy } from "lucide-react";
import { getProfile } from "@/lib/supabase/server";
import { aceptoVersionActual, TEXTO_PARA_TODOS } from "@/lib/reglas";
import { getHistorialCampeonas, getTablaLiga } from "@/lib/liga/consultas.server";
import { rangoSemana } from "@/lib/juegos/campeones/semana";
import { TablaLiga } from "@/components/juegos/liga/TablaLiga";
import { AvisosJuego, type PerfilAvisos } from "@/components/juegos/liga/AvisosJuego";

export const metadata: Metadata = {
  title: "Liga de Iglesias — Elim LLDM",
  description: "Juega y suma puntos para tu equipo. Todos son bienvenidos. Cada semana hay un equipo campeón.",
};
export const dynamic = "force-dynamic";

export default async function LigaPage() {
  const profile = (await getProfile()) as (PerfilAvisos & { id: string }) | null;
  const acepto = aceptoVersionActual(profile?.acepto_reglas_version);
  const [tabla, historial] = await Promise.all([getTablaLiga(profile?.id ?? null, acepto), getHistorialCampeonas()]);

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <AvisosJuego perfil={profile} />
      <div className="max-w-xl mx-auto px-4 py-8 pb-24 flex flex-col gap-6">
        <Link href="/juegos" className="inline-flex items-center gap-1 text-sm min-h-11" style={{ color: "var(--color-text-muted)" }}><ChevronLeft size={16} /> Juegos</Link>
        <header className="flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)" }}>
            <Trophy size={28} style={{ color: "var(--color-primary)" }} />
          </div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>Liga de Iglesias</h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{rangoSemana(tabla.semana)} · se reinicia cada lunes</p>
          <p className="text-xs max-w-sm" style={{ color: "var(--color-text-muted)" }}>{TEXTO_PARA_TODOS} <Link href="/reglas" className="underline" style={{ color: "var(--color-primary)" }}>Reglas</Link></p>
        </header>

        <TablaLiga inicial={tabla} />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Campeones de semanas anteriores</h2>
          {historial.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>El primer campeón se anuncia el próximo lunes.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {historial.map((c) => (
                <li key={c.semana} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                  <span>🏆</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>{c.nombre}</span>
                    <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>{rangoSemana(c.semana)}</span>
                  </span>
                  <span className="text-right text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                    <strong style={{ color: "var(--color-text)" }}>{c.puntos} pts</strong>
                    <br />
                    {c.jugadores} {c.jugadores === 1 ? "jugador" : "jugadores"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
