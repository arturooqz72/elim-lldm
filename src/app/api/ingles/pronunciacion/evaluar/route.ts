import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { azureConfigurado } from "@/lib/ingles/azure.server";
import { leerProgreso } from "@/lib/ingles/progreso.server";
import { leerSaldo } from "@/lib/ingles/saldo.server";
import { apartarVoz, devolverVoz, evaluarYExplicar, leerAudio, respuestaSinEvaluar } from "@/lib/ingles/voz.server";
import type { InglesNivel } from "@/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Evalúa un intento del modo Pronunciación:
// 1) valida el WAV (formato y duración reales, leídos del encabezado),
// 2) aparta un intento de voz del día (sin intentos → no se llama a Azure),
// 3) llama a Azure; si falla o no hubo voz, devuelve el intento apartado,
// 4) pide la explicación a la tutora y guarda el intento (sin el audio).
// La voz tiene su propio límite diario: ya no descuenta mensajes escritos.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (!azureConfigurado()) {
    return NextResponse.json({ error: "La evaluación de pronunciación no está configurada" }, { status: 500 });
  }

  const audio = await leerAudio(request);
  if (!audio.ok) return audio.respuesta;
  const fraseId = audio.form.get("frase_id");
  if (typeof fraseId !== "string" || !UUID.test(fraseId)) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  // El texto de referencia sale de la base de datos, nunca del navegador.
  const admin = await createServiceClient();
  const { data: frase } = await admin
    .from("english_pron_frases")
    .select("id, texto, nivel")
    .eq("id", fraseId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!frase) return NextResponse.json({ error: "Frase no encontrada" }, { status: 404 });
  const { texto, nivel } = frase as { id: string; texto: string; nivel: InglesNivel };

  const apartado = await apartarVoz(admin, user.id);
  if (!apartado) return NextResponse.json({ error: "No se pudo verificar tus intentos de voz" }, { status: 500 });
  if (!apartado.permitido) {
    return NextResponse.json({ estado: "limite_voz", saldo: await leerSaldo(admin, user.id) });
  }

  const evaluado = await evaluarYExplicar(audio.wav, texto, nivel);
  if (!evaluado.ok) {
    await devolverVoz(admin, user.id, apartado.dia);
    if (evaluado.tipo === "error") console.error("Elim English — error de Azure:", evaluado.detalle);
    return respuestaSinEvaluar(evaluado.tipo, { saldo: await leerSaldo(admin, user.id) });
  }

  const { resultado, sonidos } = evaluado;
  const { error: insertError } = await admin.from("english_pron_intentos").insert({
    user_id: user.id,
    frase_id: fraseId,
    texto,
    nivel,
    puntaje: resultado.puntaje,
    precision: resultado.precision,
    fluidez: resultado.fluidez,
    completitud: resultado.completitud,
    palabras: resultado.palabras,
    sonidos_fallados: sonidos,
    duracion_seg: Math.round(audio.segundos * 10) / 10,
    origen: "modo",
  });
  if (insertError) console.error("Elim English — no se guardó el intento:", insertError.message);

  const [saldo, progreso] = await Promise.all([leerSaldo(admin, user.id), leerProgreso(admin, user.id)]);
  return NextResponse.json({ estado: "ok", resultado, saldo, progreso });
}
