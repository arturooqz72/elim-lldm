import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// "Avísame cuando haya más mensajes": guarda al usuario en la lista de espera
// de Elim English. Una sola vez por usuario (si ya está, no hace nada).
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = await createServiceClient();
  const { error } = await admin
    .from("english_lista_espera")
    .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });

  if (error) {
    console.error("Elim English — no se guardó en la lista de espera:", error.message);
    return NextResponse.json({ error: "No se pudo guardar. Intenta de nuevo." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
