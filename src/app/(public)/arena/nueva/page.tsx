import { getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ArenaCreateForm } from "@/components/arena/ArenaCreateForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nueva sala — Elim Arena" };

export default async function NuevaSalaArenaPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?returnUrl=/arena/nueva");
  if (profile.role !== "admin" && profile.role !== "anfitrion") {
    redirect("/arena");
  }

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/arena"
            className="flex items-center gap-1.5 text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            <ArrowLeft size={15} />
            Elim Arena
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text)" }}>
          Nueva sala de Elim Arena
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
          Configura el título y las preguntas. Necesitas mínimo 5 y máximo 20.
        </p>

        <ArenaCreateForm />
      </div>
    </div>
  );
}
