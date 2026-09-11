import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// admin borra cualquier cosa; moderador solo tiene este permiso puntual
// (borrar en el muro de Opinión y Sugerencias), no acceso a /admin.
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

  const { error } = await service.from("opiniones").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
