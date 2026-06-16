import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return {};
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const body = await request.json();
  const title = (body.title as string | undefined)?.trim();

  if (!title) {
    return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    title,
    description: (body.description as string | undefined)?.trim() || null,
  };

  if (body.scheduled_at !== undefined) {
    updates.scheduled_at = body.scheduled_at
      ? new Date(body.scheduled_at as string).toISOString()
      : null;
  }

  const supabase = await createServiceClient();
  const { error } = await supabase.from("platikas").update(updates).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const supabase = await createServiceClient();

  const { data: platika } = await supabase
    .from("platikas")
    .select("status")
    .eq("id", id)
    .single();

  if (platika?.status === "live") {
    return NextResponse.json(
      { error: "No se puede eliminar una sesión en vivo" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("platikas").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
