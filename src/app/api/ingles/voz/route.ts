import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { esNivel, inglesConfig } from "@/lib/ingles/config";
import { azureConfigurado } from "@/lib/ingles/azure.server";
import { frasesDe } from "@/lib/ingles/frases-chat";
import { anonIdValido, COOKIE_PRUEBA } from "@/lib/ingles/prueba.server";
import { leerSaldo } from "@/lib/ingles/saldo.server";
import { apartarVoz, devolverVoz, evaluarYExplicar, leerAudio, respuestaSinEvaluar } from "@/lib/ingles/voz.server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Intento de voz de una tarjeta del chat ("🎤 Dilo tú"). El navegador solo
// manda qué mensaje y qué tarjeta: la frase se lee del mensaje guardado de la
// tutora. Con cuenta usa el contador diario de voz; en la prueba sin cuenta,
// el intento único de la prueba. Solo se cuenta si Azure evaluó.
export async function POST(request: Request) {
  if (!azureConfigurado()) {
    return NextResponse.json({ error: "La evaluación de pronunciación no está configurada" }, { status: 500 });
  }

  const audio = await leerAudio(request);
  if (!audio.ok) return audio.respuesta;
  const mensajeId = audio.form.get("mensaje_id");
  const indice = Number(audio.form.get("indice"));
  const nivelPedido = audio.form.get("nivel");
  if (typeof mensajeId !== "string" || !UUID.test(mensajeId) || !Number.isInteger(indice) || indice < 0) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = await createServiceClient();

  // ── Prueba sin cuenta ────────────────────────────────────────────────
  if (!user) {
    const anonId = anonIdValido((await cookies()).get(COOKIE_PRUEBA)?.value);
    if (!anonId) return NextResponse.json({ estado: "limite_prueba" });

    const { data: mensaje } = await admin
      .from("english_prueba_mensajes")
      .select("content")
      .eq("id", mensajeId)
      .eq("anon_id", anonId)
      .eq("role", "assistant")
      .maybeSingle();
    const texto = mensaje ? frasesDe((mensaje as { content: string }).content)[indice] : undefined;
    if (!texto) return NextResponse.json({ error: "Frase no encontrada" }, { status: 404 });

    const cfg = inglesConfig();
    const { data: consumoData, error } = await admin
      .rpc("english_prueba_consumir_voz", {
        p_anon: anonId,
        p_limite: cfg.pruebaVoz,
        p_limite_global: cfg.pruebaVozGlobalDiaria,
      })
      .single();
    if (error || !consumoData) {
      console.error("Elim English — error al apartar voz de prueba:", error?.message);
      return NextResponse.json({ error: "No se pudo evaluar tu voz. Intenta de nuevo." }, { status: 500 });
    }
    const consumo = consumoData as { origen: "ok" | "limite" | "reclamado" | "saturado"; dia_pacifico: string };
    if (consumo.origen !== "ok") return NextResponse.json({ estado: "limite_prueba" });

    const evaluado = await evaluarYExplicar(audio.wav, texto, "principiante");
    if (!evaluado.ok) {
      await admin.rpc("english_prueba_devolver_voz", { p_anon: anonId, p_dia: consumo.dia_pacifico });
      if (evaluado.tipo === "error") console.error("Elim English — error de Azure (prueba):", evaluado.detalle);
      return respuestaSinEvaluar(evaluado.tipo, { vozPrueba: 1 });
    }

    const { error: insertError } = await admin.from("english_prueba_voz_intentos").insert({
      anon_id: anonId,
      mensaje_id: mensajeId,
      texto,
      puntaje: evaluado.resultado.puntaje,
      duracion_seg: Math.round(audio.segundos * 10) / 10,
    });
    if (insertError) console.error("Elim English — no se guardó el intento de prueba:", insertError.message);
    return NextResponse.json({ estado: "ok", resultado: evaluado.resultado, vozPrueba: 0 });
  }

  // ── Con cuenta ───────────────────────────────────────────────────────
  const { data: mensaje } = await admin
    .from("english_mensajes")
    .select("content")
    .eq("id", mensajeId)
    .eq("user_id", user.id)
    .eq("role", "assistant")
    .maybeSingle();
  const texto = mensaje ? frasesDe((mensaje as { content: string }).content)[indice] : undefined;
  if (!texto) return NextResponse.json({ error: "Frase no encontrada" }, { status: 404 });

  const apartado = await apartarVoz(admin, user.id);
  if (!apartado) return NextResponse.json({ error: "No se pudo verificar tus intentos de voz" }, { status: 500 });
  if (!apartado.permitido) {
    return NextResponse.json({ estado: "limite_voz", saldo: await leerSaldo(admin, user.id) });
  }

  const nivel = esNivel(nivelPedido) ? nivelPedido : "principiante";
  const evaluado = await evaluarYExplicar(audio.wav, texto, nivel);
  if (!evaluado.ok) {
    await devolverVoz(admin, user.id, apartado.dia);
    if (evaluado.tipo === "error") console.error("Elim English — error de Azure (chat):", evaluado.detalle);
    return respuestaSinEvaluar(evaluado.tipo, { saldo: await leerSaldo(admin, user.id) });
  }

  const { resultado, sonidos } = evaluado;
  const { error: insertError } = await admin.from("english_pron_intentos").insert({
    user_id: user.id,
    texto,
    nivel,
    puntaje: resultado.puntaje,
    precision: resultado.precision,
    fluidez: resultado.fluidez,
    completitud: resultado.completitud,
    palabras: resultado.palabras,
    sonidos_fallados: sonidos,
    duracion_seg: Math.round(audio.segundos * 10) / 10,
    origen: "chat",
    mensaje_id: mensajeId,
  });
  if (insertError) console.error("Elim English — no se guardó el intento del chat:", insertError.message);

  return NextResponse.json({ estado: "ok", resultado, saldo: await leerSaldo(admin, user.id) });
}
