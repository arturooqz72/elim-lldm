import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { EncuestaRespuesta, EncuestaTipo } from "@/types";

const TIPOS: EncuestaTipo[] = ["voz", "mensajes"];
const RESPUESTAS: EncuestaRespuesta[] = ["no", "3", "5", "10"];

// Guarda la respuesta a "¿Pagarías…?" (voz o mensajes escritos). Una por
// persona y por tipo; si ya respondió, se actualiza. Es solo una encuesta:
// no crea cobros ni compromisos.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para responder." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { tipo?: unknown; respuesta?: unknown } | null;
  const tipo = TIPOS.find((t) => t === body?.tipo);
  const respuesta = RESPUESTAS.find((r) => r === body?.respuesta);
  if (!tipo || !respuesta) return NextResponse.json({ error: "Respuesta no válida" }, { status: 400 });

  const admin = await createServiceClient();
  const { error } = await admin
    .from("english_encuestas")
    .upsert(
      { user_id: user.id, tipo, respuesta, updated_at: new Date().toISOString() },
      { onConflict: "user_id,tipo" },
    );
  if (error) {
    console.error("Elim English — no se guardó la encuesta:", error.message);
    return NextResponse.json({ error: "No se pudo guardar. Intenta de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, tipo, respuesta });
}
