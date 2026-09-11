import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// admin borra cualquier cosa; moderador tiene este mismo permiso puntual
// que ya tiene en Opinión y Sugerencias y el chat en vivo (ver 0030).
async function verifyCanModerate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role: string } | null)?.role;
  if (role !== "admin" && role !== "moderador" && role !== "super_moderador") return null;
  return user;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyCanModerate();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const service = await createServiceClient();

  const { error } = await service.from("video_comments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
