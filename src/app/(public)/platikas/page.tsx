import { createClient, getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { UnderConstruction } from "@/components/platikas/UnderConstruction";

export const metadata: Metadata = {
  title: "Estudio en Vivo — Elim LLDM",
  description:
    "Transmisiones en vivo y sesiones programadas de la fe LLDM. Participa en el debate, chatea y solicita subir al escenario.",
};

export default async function PlatikaListPage() {
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";

  // El Estudio en Vivo se está reconstruyendo — solo administradores
  // pueden verlo mientras tanto (ver UnderConstruction.tsx).
  if (!isAdmin) return <UnderConstruction />;

  const supabase = await createClient();

  // Mientras solo haya un Programa, "Estudio en Vivo" va directo a esa
  // sesión (si ya hay una abierta) o a configurar una nueva — sin pasar
  // por una lista intermedia. Si hay 0 o 2+ programas, no hay uno obvio
  // al que saltar, así que se muestra /platikas/programas para elegir.
  const { data: activeSession } = await supabase
    .from("platikas")
    .select("id")
    .in("status", ["backstage", "live"])
    .maybeSingle();

  if (activeSession) redirect(`/platikas/${activeSession.id}`);

  const { data: programasActivos } = await supabase
    .from("programas")
    .select("id")
    .eq("activo", true);

  if (programasActivos?.length === 1) {
    redirect(`/platikas/programas/${programasActivos[0].id}/nueva`);
  }
  redirect("/platikas/programas");
}
