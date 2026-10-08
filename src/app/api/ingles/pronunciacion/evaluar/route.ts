import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { inglesConfig, inglesPaquetes } from "@/lib/ingles/config";
import { azureConfigurado, evaluarPronunciacion } from "@/lib/ingles/azure.server";
import { pedirAlModelo } from "@/lib/ingles/anthropic.server";
import { pedidoExplicacion, SISTEMA_EXPLICACION } from "@/lib/ingles/pronunciacion-prompts";
import { leerProgreso } from "@/lib/ingles/progreso.server";
import { leerSaldo } from "@/lib/ingles/saldo.server";
import { sonidosFallados } from "@/lib/ingles/sonidos";
import { bytesMaximos, leerWav } from "@/lib/ingles/wav";
import type { InglesNivel, InglesSaldo, PronResultado } from "@/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_SEGUNDOS = 0.5;

interface Consumo {
  origen: "gratis" | "credito" | "limite_alcanzado";
  gratis_restantes: number;
  creditos: number;
  gratis_usados: number;
  creditos_usados: number;
  dia: string;
}

// Evalúa un intento de pronunciación:
// 1) valida el WAV (formato y duración reales, leídos del encabezado),
// 2) aparta el costo con la RPC atómica (sin saldo → no se llama a Azure),
// 3) llama a Azure; si falla o no hubo voz, devuelve exactamente lo apartado,
// 4) pide la explicación a la tutora y guarda el intento (sin el audio).
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (!azureConfigurado()) {
    return NextResponse.json({ error: "La evaluación de pronunciación no está configurada" }, { status: 500 });
  }

  const cfg = inglesConfig();
  const limiteBytes = bytesMaximos(cfg.pronMaxSegundos);
  const declarado = Number(request.headers.get("content-length") ?? 0);
  if (declarado > limiteBytes + 4096) {
    return NextResponse.json({ error: `La grabación es demasiado larga (máximo ${cfg.pronMaxSegundos} segundos)` }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  const fraseId = form?.get("frase_id");
  const audio = form?.get("audio");
  if (typeof fraseId !== "string" || !UUID.test(fraseId) || !(audio instanceof Blob)) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }
  if (audio.size > limiteBytes) {
    return NextResponse.json({ error: `La grabación es demasiado larga (máximo ${cfg.pronMaxSegundos} segundos)` }, { status: 413 });
  }

  const wav = await audio.arrayBuffer();
  const info = leerWav(wav);
  if (!info.ok) return NextResponse.json({ error: info.motivo }, { status: 400 });
  if (info.segundos > cfg.pronMaxSegundos + 0.5) {
    return NextResponse.json({ error: `La grabación es demasiado larga (máximo ${cfg.pronMaxSegundos} segundos)` }, { status: 413 });
  }
  if (info.segundos < MIN_SEGUNDOS) {
    return NextResponse.json({ estado: "sin_voz", error: "La grabación es muy corta. Lee la frase completa." }, { status: 422 });
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

  // Apartar el costo (todo o nada).
  const { data: consumoData, error: consumoError } = await admin
    .rpc("english_consumir_mensaje", {
      p_user: user.id,
      p_limite_gratis: cfg.gratisDiarios,
      p_cantidad: cfg.costoPronunciacion,
    })
    .single();
  if (consumoError || !consumoData) {
    console.error("Elim English — error al descontar intento:", consumoError?.message);
    return NextResponse.json({ error: "No se pudo verificar tu saldo" }, { status: 500 });
  }
  const consumo = consumoData as Consumo;
  if (consumo.origen === "limite_alcanzado") {
    const saldo: InglesSaldo = {
      gratisRestantes: consumo.gratis_restantes,
      gratisDiarios: cfg.gratisDiarios,
      creditos: consumo.creditos,
    };
    return NextResponse.json({ estado: "limite_alcanzado", saldo, paquetes: inglesPaquetes() });
  }

  const azure = await evaluarPronunciacion(wav, texto);
  if (!azure.ok) {
    await admin.rpc("english_devolver_mensajes", {
      p_user: user.id,
      p_dia: consumo.dia,
      p_gratis: consumo.gratis_usados,
      p_creditos: consumo.creditos_usados,
    });
    const saldo = await leerSaldo(admin, user.id);
    if (azure.tipo === "sin_voz") {
      return NextResponse.json(
        { estado: "sin_voz", error: "No escuchamos tu voz. Acércate al micrófono, lee la frase completa e intenta de nuevo. No se cobró este intento.", saldo },
        { status: 422 },
      );
    }
    console.error("Elim English — error de Azure:", azure.detalle);
    return NextResponse.json(
      { estado: "error", error: "No se pudo evaluar tu pronunciación en este momento. No se cobró este intento; intenta de nuevo.", saldo },
      { status: 502 },
    );
  }

  const { evaluacion } = azure;
  const sonidos = sonidosFallados(evaluacion.palabras);
  const explicacion = await pedirAlModelo(SISTEMA_EXPLICACION, pedidoExplicacion(texto, nivel, evaluacion), 350);

  const { error: insertError } = await admin.from("english_pron_intentos").insert({
    user_id: user.id,
    frase_id: fraseId,
    texto,
    nivel,
    puntaje: evaluacion.puntaje,
    precision: evaluacion.precision,
    fluidez: evaluacion.fluidez,
    completitud: evaluacion.completitud,
    palabras: evaluacion.palabras,
    sonidos_fallados: sonidos,
    duracion_seg: Math.round(info.segundos * 10) / 10,
  });
  if (insertError) console.error("Elim English — no se guardó el intento:", insertError.message);

  const resultado: PronResultado = { ...evaluacion, sonidosFallados: sonidos, explicacion };
  const saldo: InglesSaldo = {
    gratisRestantes: consumo.gratis_restantes,
    gratisDiarios: cfg.gratisDiarios,
    creditos: consumo.creditos,
  };
  const progreso = await leerProgreso(admin, user.id);

  return NextResponse.json({ estado: "ok", resultado, saldo, progreso });
}
