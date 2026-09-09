import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { endpoint } = (await request.json()) as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ error: "Falta endpoint" }, { status: 400 });

  // RLS ya limita el borrado a auth.uid() = user_id — el .eq(endpoint) de
  // más solo evita tocar otra suscripción del mismo usuario por accidente.
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
