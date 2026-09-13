import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptStreamKey } from "@/lib/crypto/destinos";

const PLATAFORMAS = ["youtube", "facebook", "tiktok", "otro"];

export async function GET() {
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

  const { data, error } = await supabase
    .from("destinos")
    .select("id, nombre, plataforma, rtmp_url, activo, created_at")
    .eq("activo", true)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ destinos: data });
}

export async function POST(request: Request) {
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

  const body = await request.json();
  const { nombre, plataforma, rtmp_url, stream_key } = body as {
    nombre?: string;
    plataforma?: string;
    rtmp_url?: string;
    stream_key?: string;
  };

  if (!nombre?.trim() || !plataforma || !rtmp_url?.trim() || !stream_key?.trim()) {
    return NextResponse.json(
      { error: "nombre, plataforma, rtmp_url y stream_key son requeridos" },
      { status: 400 }
    );
  }
  if (!PLATAFORMAS.includes(plataforma)) {
    return NextResponse.json({ error: "Plataforma inválida" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("destinos")
    .insert({
      nombre: nombre.trim(),
      plataforma,
      rtmp_url: rtmp_url.trim(),
      stream_key_cifrado: encryptStreamKey(stream_key.trim()),
      created_by: user.id,
    })
    .select("id, nombre, plataforma, rtmp_url, activo, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ destino: data });
}
