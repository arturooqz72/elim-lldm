import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ElimIAMode } from "@/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { mode?: ElimIAMode } | null;
  const mode: ElimIAMode = body?.mode === "general" ? "general" : "lldm";

  await supabase.from("elim_ia_messages").delete().eq("user_id", user.id).eq("mode", mode);

  return NextResponse.json({ ok: true });
}
