import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DestinoConEstado } from "@/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_moderador"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: destinos, error: destinosError } = await supabase
    .from("destinos")
    .select("id, nombre, plataforma, rtmp_url")
    .eq("activo", true)
    .order("created_at", { ascending: true });

  if (destinosError) return NextResponse.json({ error: destinosError.message }, { status: 500 });

  const { data: egresosActivos, error: egresosError } = await supabase
    .from("platikas_stream_egresos")
    .select("id, destino_id")
    .eq("platika_id", id)
    .is("stopped_at", null);

  if (egresosError) return NextResponse.json({ error: egresosError.message }, { status: 500 });

  const activosPorDestino = new Map(
    (egresosActivos ?? []).map((e: { id: string; destino_id: string }) => [e.destino_id, e.id])
  );

  const resultado: DestinoConEstado[] = (destinos ?? []).map((d) => ({
    id: d.id,
    nombre: d.nombre,
    plataforma: d.plataforma,
    rtmp_url: d.rtmp_url,
    isActive: activosPorDestino.has(d.id),
    egresoId: activosPorDestino.get(d.id) ?? null,
  }));

  return NextResponse.json({ destinos: resultado });
}
