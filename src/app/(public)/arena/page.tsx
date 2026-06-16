import { getProfile } from "@/lib/supabase/server";
import { JoinCodeForm } from "@/components/arena/JoinCodeForm";
import { Trophy, Zap, Hash, Timer, Crown, Sparkles } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Elim Arena — Elim LLDM",
  description:
    "Trivia bíblica multijugador en tiempo real. Únete con un código desde tu celular y compite por el primer lugar.",
};

export default async function ArenaPage() {
  const profile = await getProfile();
  const canCreate = profile?.role === "admin" || profile?.role === "anfitrion";

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
            <Trophy size={32} style={{ color: "var(--color-primary)" }} />
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
              Elim Arena
            </h1>
            <p style={{ color: "var(--color-text-muted)" }}>
              Trivia bíblica multijugador en tiempo real, directo desde tu celular
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
          <JoinCodeForm />
        </div>

        {/* Crear sala (solo admin/anfitrión) */}
        {canCreate && (
          <Link
            href="/arena/nueva"
            className="flex items-center gap-3 px-5 py-4 rounded-2xl transition-colors"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            <Sparkles size={20} />
            <div className="flex-1">
              <p className="text-base font-bold">Crear una nueva sala</p>
              <p className="text-xs opacity-80">Configura preguntas y comparte el código</p>
            </div>
          </Link>
        )}

        {/* Cómo funciona */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              ¿Cómo funciona?
            </h2>
          </div>
          <div className="flex flex-col">
            <Step
              icon={Hash}
              title="Ingresa el código"
              desc="El anfitrión comparte un código de 4 letras para unirse."
            />
            <Step
              icon={Timer}
              title="Responde rápido"
              desc="Cada pregunta dura 15 segundos. Mientras más rápido respondas, más puntos ganas."
            />
            <Step
              icon={Crown}
              title="Sube en la tabla"
              desc="Mira el marcador en vivo después de cada ronda."
            />
            <Step
              icon={Zap}
              title="¡Gana la corona!"
              desc="Al final, el jugador con más puntos se lleva la victoria."
              last
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({
  icon: Icon,
  title,
  desc,
  last,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  title: string;
  desc: string;
  last?: boolean;
}) {
  return (
    <div
      className="flex gap-3 p-5"
      style={{ borderBottom: last ? undefined : "1px solid var(--color-border)" }}
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
  );
}
