import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptStreamKey } from "@/lib/crypto/destinos";

const PLATAFORMAS = ["youtube", "facebook", "tiktok", "otro"];

async function tieneEgresoActivo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  destinoId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("platikas_stream_egresos")
    .select("id")
    .eq("destino_id", destinoId)
    .is("stopped_at", null)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function PATCH(
  request: Request,
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

  if (await tieneEgresoActivo(supabase, id)) {
    return NextResponse.json(
      { error: "No se puede editar un destino mientras está transmitiendo" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { nombre, plataforma, rtmp_url, stream_key } = body as {
    nombre?: string;
    plataforma?: string;
    rtmp_url?: string;
    stream_key?: string;
  };

  if (plataforma && !PLATAFORMAS.includes(plataforma)) {
    return NextResponse.json({ error: "Plataforma inválida" }, { status: 400 });
  }

  const update: Record<string, string> = { updated_at: new Date().toISOString() };
  if (nombre?.trim()) update.nombre = nombre.trim();
  if (plataforma) update.plataforma = plataforma;
  if (rtmp_url?.trim()) update.rtmp_url = rtmp_url.trim();
  if (stream_key?.trim()) update.stream_key_cifrado = encryptStreamKey(stream_key.trim());

  const { data, error } = await supabase
    .from("destinos")
    .update(update)
    .eq("id", id)
    .select("id, nombre, plataforma, rtmp_url, activo, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ destino: data });
}

export async function DELETE(
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

  if (await tieneEgresoActivo(supabase, id)) {
    return NextResponse.json(
      { error: "No se puede borrar un destino mientras está transmitiendo" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("destinos")
    .update({ activo: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
