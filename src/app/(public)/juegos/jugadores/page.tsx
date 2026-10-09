import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getProfile, createClient, createServiceClient } from "@/lib/supabase/server";
import { JugadoresEnLineaForm } from "@/components/juegos/JugadoresEnLineaForm";
import { JugadoresEnLineaList } from "@/components/juegos/JugadoresEnLineaList";

export const metadata: Metadata = {
  title: "Jugadores en línea — Elim LLDM",
  description: "Miembros que quieren que los inviten a jugar. Invítalos desde aquí cuando abras una sala.",
};

export default async function JugadoresEnLineaPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?returnUrl=/juegos/jugadores");

  const esAdmin = profile.role === "admin";

  // La lista la arma el servidor: nombres para todos, y el WhatsApp solo
  // si quien mira es admin (desde 0073 nadie más puede leer números).
  const service = await createServiceClient();
  const { data: filas } = await service
    .from("jugadores_en_linea")
    .select(esAdmin ? "id, user_id, nombre, whatsapp" : "id, user_id, nombre")
    .order("created_at", { ascending: false });
  const jugadores = (filas ?? []) as unknown as { id: string; user_id: string; nombre: string; whatsapp?: string | null }[];

  // Tu propia fila (con tu número) con tu sesión: RLS solo deja ver la tuya.
  const supabase = await createClient();
  const { data: propio } = await supabase
    .from("jugadores_en_linea")
    .select("nombre, whatsapp")
    .eq("user_id", profile.id)
    .maybeSingle();

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
          Miembros que quieren que los inviten a jugar. Escoge el juego y toca &ldquo;Invitar&rdquo;: le llega un aviso
          en el sitio y una notificación en su teléfono, sin que nadie vea su número.
        </p>

        <div className="flex flex-col gap-6">
          <JugadoresEnLineaForm
            userId={profile.id}
            registrado={propio ? { nombre: propio.nombre as string, whatsapp: (propio.whatsapp as string | null) ?? "" } : null}
          />

          <div>
            <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>
              Lista de jugadores ({jugadores.length})
            </h2>
            <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
              El punto verde indica quién tiene el sitio abierto ahora mismo.
            </p>
            <JugadoresEnLineaList jugadores={jugadores} currentUserId={profile.id} esAdmin={esAdmin} />
          </div>
        </div>
      </div>
    </div>
  );
}
