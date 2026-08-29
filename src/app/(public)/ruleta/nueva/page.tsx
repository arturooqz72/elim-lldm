import { getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { RuletaCreateForm } from "@/components/ruleta/RuletaCreateForm";
import { VerJugadoresLink } from "@/components/juegos/VerJugadoresLink";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nueva sala — La Ruleta" };

export default async function NuevaSalaRuletaPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?returnUrl=/ruleta/nueva");

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/ruleta" className="flex items-center gap-1.5 text-sm" style={{ color: "var(--color-text-muted)" }}>
            <ArrowLeft size={15} />
            La Ruleta
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text)" }}>
          Nueva sala de La Ruleta
        </h1>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
          Elige cuántas rondas dura la partida. Podrás compartir el código en el siguiente paso.
        </p>

        <VerJugadoresLink />

        <RuletaCreateForm />
      </div>
    </div>
  );
}
