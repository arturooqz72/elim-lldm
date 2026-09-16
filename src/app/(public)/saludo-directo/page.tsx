import Link from "next/link";
import type { Metadata } from "next";
import { Mic, LogIn, Lock, Radio } from "lucide-react";
import { getProfile, createClient } from "@/lib/supabase/server";
import { SaludoDirectoButton } from "@/components/saludo-directo/SaludoDirectoButton";
import type { Profile } from "@/types";

export const metadata: Metadata = {
  title: "Saludo Directo — Elim LLDM",
  description: "Conecta tu micrófono en vivo a Elim LLDM Radio por 10 segundos.",
};

export default async function SaludoDirectoPage() {
  // Mismo cast que src/app/(public)/layout.tsx — getProfile() no está
  // tipado contra el schema generado (aún no se corrió
  // `supabase gen types`, ver TODO en src/lib/supabase/server.ts).
  const profile = (await getProfile()) as Profile | null;
  const eligible =
    profile?.role === "oyente_plus" || profile?.role === "admin" || profile?.role === "moderador";

  let isLive = false;
  if (profile && eligible) {
    const supabase = await createClient();
    const { data: livePláticas } = await supabase
      .from("platikas")
      .select("id")
      .in("status", ["live", "backstage"])
      .limit(1);
    isLive = Boolean(livePláticas && livePláticas.length > 0);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center text-center">
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
          style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.2)" }}
        >
          <Mic size={24} style={{ color: "var(--color-primary)" }} />
        </div>
        <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--color-text)" }}>
          Saludo Directo
        </h1>
        <p className="text-base mb-10" style={{ color: "var(--color-text-muted)" }}>
          Deja un saludo en vivo, en tu propia voz, directo a Elim LLDM Radio por 10 segundos.
        </p>

        {!profile && (
          <div
            className="rounded-2xl p-6 flex flex-col items-center gap-3"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Inicia sesión para usar Saludo Directo.
            </p>
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "var(--color-primary)", color: "#000" }}
            >
              <LogIn size={15} />
              Iniciar sesión
            </Link>
          </div>
        )}

        {profile && !eligible && (
          <div
            className="rounded-2xl p-6 flex flex-col items-center gap-2"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <Lock size={20} style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Saludo Directo es una función exclusiva para la categoría Oyente Plus.
            </p>
          </div>
        )}

        {profile && eligible && isLive && (
          <div
            className="rounded-2xl p-6 flex flex-col items-center gap-2"
            style={{ background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.25)" }}
          >
            <Radio size={20} style={{ color: "var(--color-live)" }} />
            <p className="text-sm" style={{ color: "var(--color-text)" }}>
              Hay una transmisión en vivo ahora mismo — Saludo Directo solo está disponible en
              tiempo regular. Inténtalo más tarde.
            </p>
          </div>
        )}

        {profile && eligible && !isLive && <SaludoDirectoButton />}
      </div>
    </div>
  );
}
