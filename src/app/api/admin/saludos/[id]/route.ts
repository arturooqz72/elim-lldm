import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile as { role: string }).role !== "admin") return null;
  return user;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = await createServiceClient();

  const { data: saludo, error: fetchError } = await service
    .from("saludos")
    .select("audio_path")
    .eq("id", id)
    .single();

  if (fetchError || !saludo) {
    return NextResponse.json({ error: fetchError?.message ?? "No encontrado" }, { status: 404 });
  }

  const { audio_path } = saludo as { audio_path: string };

  const { error: storageError } = await service.storage.from("saludos").remove([audio_path]);
  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  const { error: deleteError } = await service.from("saludos").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
