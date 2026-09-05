import { MessageSquareText } from "lucide-react";
import type { Metadata } from "next";
import { createClient, getProfile } from "@/lib/supabase/server";
import { OpinionForm } from "@/components/opiniones/OpinionForm";
import { OpinionCard } from "@/components/opiniones/OpinionCard";
import type { Opinion } from "@/types";

export const metadata: Metadata = {
  title: "Opinión y Sugerencias — Elim LLDM",
  description: "Comparte tu opinión o sugerencia con toda la comunidad de Elim LLDM.",
};

export default async function OpinionesPage() {
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: opiniones } = await supabase
    .from("opiniones")
    .select("id, user_id, mensaje, created_at, profiles(display_name, avatar_url)")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
            style={{
              background: "rgba(212,160,23,0.1)",
              border: "1px solid rgba(212,160,23,0.2)",
            }}
          >
            <MessageSquareText size={24} style={{ color: "var(--color-primary)" }} />
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--color-text)" }}>
            Opinión y Sugerencias
          </h1>
          <p className="text-base" style={{ color: "var(--color-text-muted)" }}>
            Un espacio abierto para toda la comunidad — comparte tu opinión y lee la de los demás.
          </p>
        </div>

        <div className="mb-8">
          <OpinionForm userId={profile?.id ?? null} />
        </div>

        <div className="flex flex-col gap-3">
          {(opiniones ?? []).length === 0 && (
            <p className="text-center text-sm py-8" style={{ color: "var(--color-text-muted)" }}>
              Todavía no hay opiniones — sé el primero en escribir algo.
            </p>
          )}
          {(opiniones as unknown as Opinion[] | null ?? []).map((opinion) => (
            <OpinionCard key={opinion.id} opinion={opinion} isAdmin={profile?.role === "admin"} />
          ))}
        </div>
      </div>
    </div>
  );
}
