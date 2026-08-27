import { getProfile } from "@/lib/supabase/server";
import { RuletaJoinCodeForm } from "@/components/ruleta/RuletaJoinCodeForm";
import { Disc3, Hash, Users, Sparkles } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "La Ruleta en línea — Elim LLDM",
  description: "Juega La Ruleta con tus amigos desde sus propios celulares, en tiempo real.",
};

export default async function RuletaPage() {
  const profile = await getProfile();

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
            <Disc3 size={32} style={{ color: "var(--color-primary)" }} />
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
              La Ruleta en línea
            </h1>
            <p style={{ color: "var(--color-text-muted)" }}>
              De 2 a 6 jugadores, cada quien desde su propio celular
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-10 flex flex-col gap-8">
        {/* Unirse con código */}
        <div
          className="rounded-2xl p-6"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Hash size={15} style={{ color: "var(--color-primary)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              Unirse con código
            </h2>
          </div>
          <RuletaJoinCodeForm />
        </div>

        {/* Crear sala (cualquier usuario con sesión iniciada) */}
        {profile ? (
          <Link
            href="/ruleta/nueva"
            className="flex items-center gap-3 px-5 py-4 rounded-2xl transition-colors"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            <Sparkles size={20} />
            <div className="flex-1">
              <p className="text-base font-bold">Crear una nueva sala</p>
              <p className="text-xs opacity-80">Comparte el código con hasta 5 amigos más</p>
            </div>
          </Link>
        ) : (
          <Link
            href="/login?returnUrl=/ruleta/nueva"
            className="flex items-center gap-3 px-5 py-4 rounded-2xl transition-colors"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <Users size={20} style={{ color: "var(--color-primary)" }} />
            <div className="flex-1">
              <p className="text-base font-bold">Inicia sesión para crear una sala</p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Unirse a una sala no requiere cuenta
              </p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
