import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { esNivel, inglesConfig } from "@/lib/ingles/config";
import { pedirAlModelo } from "@/lib/ingles/anthropic.server";
import { leerFrases, pedidoFrases, SISTEMA_FRASES } from "@/lib/ingles/pronunciacion-prompts";
import { rangoDelDia } from "@/lib/historial";
import { hoyPacifico } from "@/lib/ingles/saldo.server";
import type { PronFrase } from "@/types";

const LOTE = 5;
const RECIENTES = 40;

// Siguiente frase para practicar. Sale de la cola del usuario; si está vacía
// se genera un lote nuevo con el modelo (no cuesta mensajes, pero tiene un
// tope diario para limitar el costo de Anthropic).
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { nivel?: string } | null;
  if (!esNivel(body?.nivel)) return NextResponse.json({ error: "Nivel no válido" }, { status: 400 });
  const nivel = body.nivel;

  const admin = await createServiceClient();

  async function servir(frase: PronFrase) {
    await admin.from("english_pron_frases").update({ mostrada_at: new Date().toISOString() }).eq("id", frase.id);
    return NextResponse.json({ frase });
  }

  const { data: enCola } = await admin
    .from("english_pron_frases")
    .select("id, texto, traduccion, sonido")
    .eq("user_id", user.id)
    .eq("nivel", nivel)
    .is("mostrada_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (enCola) return servir(enCola as PronFrase);

  // Tope diario de frases generadas.
  const { pronFrasesDiarias } = inglesConfig();
  const hoy = rangoDelDia(hoyPacifico());
  const { count } = await admin
    .from("english_pron_frases")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", hoy?.desde ?? new Date().toISOString());
  if ((count ?? 0) >= pronFrasesDiarias) {
    return NextResponse.json(
      { error: "Ya practicaste muchas frases nuevas hoy. Puedes repetir la frase actual o volver mañana." },
      { status: 429 },
    );
  }

  const { data: previas } = await admin
    .from("english_pron_frases")
    .select("texto")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(RECIENTES);
  const recientes = ((previas ?? []) as { texto: string }[]).map((f) => f.texto);

  const respuesta = await pedirAlModelo(SISTEMA_FRASES, pedidoFrases(nivel, LOTE, recientes), 900);
  const yaVistas = new Set(recientes.map((t) => t.toLowerCase()));
  const nuevas = (respuesta ? leerFrases(respuesta) : []).filter((f) => !yaVistas.has(f.texto.toLowerCase()));
  if (nuevas.length === 0) {
    return NextResponse.json({ error: "No se pudo preparar una frase. Intenta de nuevo." }, { status: 502 });
  }

  const { data: insertadas, error } = await admin
    .from("english_pron_frases")
    .insert(nuevas.map((f) => ({ user_id: user.id, nivel, texto: f.texto, traduccion: f.traduccion, sonido: f.sonido })))
    .select("id, texto, traduccion, sonido");

  if (error || !insertadas?.length) {
    console.error("Elim English — no se guardaron las frases:", error?.message);
    return NextResponse.json({ error: "No se pudo preparar una frase. Intenta de nuevo." }, { status: 500 });
  }

  return servir(insertadas[0] as PronFrase);
}
