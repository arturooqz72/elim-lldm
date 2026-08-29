import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getProfile, createClient } from "@/lib/supabase/server";
import { JugadoresEnLineaForm } from "@/components/juegos/JugadoresEnLineaForm";
import { JugadoresEnLineaList } from "@/components/juegos/JugadoresEnLineaList";

export const metadata: Metadata = {
  title: "Jugadores en línea — Elim LLDM",
  description: "Miembros que quieren que los inviten a jugar. Invítalos por WhatsApp cuando abras una sala.",
};

export default async function JugadoresEnLineaPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?returnUrl=/juegos/jugadores");

  const supabase = await createClient();
  const { data: jugadores } = await supabase
    .from("jugadores_en_linea")
    .select("id, user_id, nombre, whatsapp")
    .order("created_at", { ascending: false });

  const propio = jugadores?.find((j) => j.user_id === profile.id) ?? null;

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/juegos" className="flex items-center gap-1.5 text-sm" style={{ color: "var(--color-text-muted)" }}>
            <ArrowLeft size={15} />
            Juegos
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <Users size={22} style={{ color: "var(--color-primary)" }} />
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
            Jugadores en línea
          </h1>
        </div>
        <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
          Miembros que quieren que los inviten a jugar. Si vas a abrir una sala, invita desde aquí por WhatsApp.
        </p>

        <div className="flex flex-col gap-6">
          <JugadoresEnLineaForm userId={profile.id} registrado={propio ? { nombre: propio.nombre, whatsapp: propio.whatsapp } : null} />

          <div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
              Lista de jugadores ({jugadores?.length ?? 0})
            </h2>
            <JugadoresEnLineaList jugadores={jugadores ?? []} currentUserId={profile.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
