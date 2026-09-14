import { redirect, notFound } from "next/navigation";
import { getProfile, createClient } from "@/lib/supabase/server";
import { NuevaTransmisionForm } from "@/components/platikas/NuevaTransmisionForm";

export const metadata = { title: "Configurar transmisión — Estudio en Vivo" };

interface Props {
  params: Promise<{ programaId: string }>;
}

export default async function NuevaTransmisionPage({ params }: Props) {
  const { programaId } = await params;
  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_moderador")) {
    redirect("/platikas");
  }

  const supabase = await createClient();
  const { data: programa } = await supabase
    .from("programas")
    .select("id, nombre, activo")
    .eq("id", programaId)
    .single();

  if (!programa || !programa.activo) notFound();

  // Un programa no puede tener dos sesiones abiertas a la vez — si ya
  // hay una, se manda directo ahí en vez de dejar configurar otra.
  const { data: activeSession } = await supabase
    .from("platikas")
    .select("id")
    .eq("programa_id", programaId)
    .in("status", ["backstage", "live"])
    .maybeSingle();

  if (activeSession) redirect(`/platikas/${activeSession.id}`);

  return <NuevaTransmisionForm programaId={programa.id} nombrePrograma={programa.nombre} />;
}
