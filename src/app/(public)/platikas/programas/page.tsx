import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfile, createClient } from "@/lib/supabase/server";
import { GoLiveProgramaButton } from "@/components/platikas/GoLiveProgramaButton";
import type { Programa } from "@/types";

export const metadata = { title: "Programas — Estudio en Vivo" };

export default async function ProgramasEnVivoPage() {
  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_moderador")) {
    redirect("/platikas");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("programas")
    .select("*")
    .eq("activo", true)
    .order("nombre", { ascending: true });
  const programas = (data ?? []) as Programa[];

  // Un programa no puede tener dos sesiones abiertas a la vez — se busca
  // si ya hay una en backstage o live para mostrar "Continuar" en vez de
  // dejar crear una segunda (ver docs/superpowers/specs/2026-09-12-backstage-design.md).
  const { data: activeSessions } = await supabase
    .from("platikas")
    .select("id, programa_id")
    .in("status", ["backstage", "live"]);
  const activeSessionByPrograma = new Map(
    (activeSessions ?? []).map((s: { id: string; programa_id: string | null }) => [s.programa_id, s.id])
  );

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-4">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
          Programas
        </h1>

        {programas.length === 0 && (
          <p style={{ color: "var(--color-text-muted)" }}>
            No hay programas activos todavía.
          </p>
        )}

        {programas.map((programa) => {
          const activeSessionId = activeSessionByPrograma.get(programa.id);
          return (
            <div
              key={programa.id}
              className="flex items-center justify-between gap-4 p-5 rounded-2xl"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div>
                <p className="font-semibold" style={{ color: "var(--color-text)" }}>
                  {programa.nombre}
                </p>
                {programa.horario_texto && (
                  <p className="text-xs" style={{ color: "var(--color-primary)" }}>
                    {programa.horario_texto}
                  </p>
                )}
              </div>
              {activeSessionId ? (
                <Link
                  href={`/platikas/${activeSessionId}`}
                  className="flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: "var(--color-primary)", color: "#000" }}
                >
                  Continuar
                </Link>
              ) : (
                <GoLiveProgramaButton programaId={programa.id} nombre={programa.nombre} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
