import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { tryStartMatch } from "@/lib/ruleta/advance.server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const service = await createServiceClient();

  const { data: sala } = await service
    .from("ruleta_salas")
    .select("id")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  if (!sala) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

  const { applied, error } = await tryStartMatch(sala.id, true);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ success: applied });
}
