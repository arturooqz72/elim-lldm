import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { esNivel, inglesConfig, inglesPaquetes } from "@/lib/ingles/config";
import { promptReto } from "@/lib/ingles/prompts";
import { conversar } from "@/lib/ingles/anthropic.server";
import { limpiarRespuesta } from "@/lib/ingles/frases-chat";
import { hoyPacifico, saldoTrasMensaje } from "@/lib/ingles/saldo.server";
import { completarReto, leerRacha, leerReto, mensajesRetoHoy } from "@/lib/ingles/retos.server";
import type { InglesRetoAvance } from "@/types";

interface Consumo {
  origen: "gratis" | "credito" | "limite_alcanzado";
  gratis_restantes: number;
  creditos: number;
}

// Conversación del Reto del día. Cada mensaje cuesta igual que en el chat
// (mismo límite diario). El servidor cuenta los mensajes del reto de hoy y,
// al llegar a los necesarios, lo marca como completado.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const cfg = inglesConfig();
  const body = (await request.json().catch(() => null)) as { message?: string; nivel?: string } | null;
  const message = body?.message?.trim();
  const nivel = esNivel(body?.nivel) ? body.nivel : "principiante";
  if (!message) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  if (message.length > cfg.maxCaracteres) {
    return NextResponse.json(
      { error: `El mensaje es muy largo (máximo ${cfg.maxCaracteres} caracteres)` },
      { status: 400 },
    );
  }

  const admin = await createServiceClient();
  const hoy = hoyPacifico();
  const reto = await leerReto(admin, hoy);
  if (!reto) return NextResponse.json({ error: "El reto de hoy no está listo. Intenta en un momento." }, { status: 503 });

  // 1) Descontar el mensaje ANTES de llamar al modelo (misma RPC que el chat).
  const { data: consumoData, error: consumoError } = await admin
    .rpc("english_consumir_mensaje", { p_user: user.id, p_limite_gratis: cfg.gratisDiarios })
    .single();
  if (consumoError || !consumoData) {
    console.error("Elim English — error al descontar mensaje del reto:", consumoError?.message);
    return NextResponse.json({ error: "No se pudo verificar tu saldo" }, { status: 500 });
  }
  const consumo = consumoData as Consumo;
  const saldo = await saldoTrasMensaje(admin, user.id, consumo);
  if (consumo.origen === "limite_alcanzado") {
    return NextResponse.json({ estado: "limite_alcanzado", saldo, paquetes: inglesPaquetes() });
  }

  // 2) Solo la conversación del reto de HOY.
  const historial = await mensajesRetoHoy(admin, user.id, hoy);
  const previos = historial.filter((m) => m.role === "user").length;
  // Al modelo solo van rol y texto (el id es para las tarjetas de voz).
  const contexto = historial.slice(-cfg.historial).map(({ role, content }) => ({ role, content }));
  while (contexto.length && contexto[0].role !== "user") contexto.shift();

  // 3) Llamar al modelo; si falla, se devuelve el mensaje descontado.
  const respuesta = await conversar(
    promptReto(nivel, reto, cfg.retoMensajes),
    [...contexto, { role: "user", content: message }],
    cfg.maxTokens,
  );
  if (!respuesta) {
    await admin.rpc("english_devolver_mensaje", { p_user: user.id, p_origen: consumo.origen });
    return NextResponse.json({ error: "Error al consultar a la tutora. Tu mensaje no se cobró." }, { status: 502 });
  }

  // Como mucho 2 frases marcadas para practicar con la voz (ver frases-chat.ts).
  const reply = limpiarRespuesta(respuesta);

  const ahora = Date.now();
  const { data: guardados, error: insertError } = await admin
    .from("english_mensajes")
    .insert([
      { user_id: user.id, modo: "reto", role: "user", content: message, created_at: new Date(ahora).toISOString() },
      { user_id: user.id, modo: "reto", role: "assistant", content: reply, created_at: new Date(ahora + 1).toISOString() },
    ])
    .select("id, role");
  if (insertError) console.error("Elim English — no se guardó el reto:", insertError.message);
  const mensajeId = (guardados as { id: string; role: string }[] | null)?.find((m) => m.role === "assistant")?.id ?? null;

  // 4) ¿Ya completó el reto? (true solo la primera vez, para felicitar una vez)
  const mensajes = previos + 1;
  const retoCompletado = mensajes >= cfg.retoMensajes ? await completarReto(admin, user.id, hoy) : false;
  const { data: yaCompletado } = await admin
    .from("english_retos_completados")
    .select("dia")
    .eq("user_id", user.id)
    .eq("dia", hoy)
    .maybeSingle();
  const avance: InglesRetoAvance = { completado: Boolean(yaCompletado), mensajes, requeridos: cfg.retoMensajes };
  const racha = await leerRacha(admin, user.id, hoy);

  return NextResponse.json({ estado: "ok", reply, mensajeId, saldo, avance, racha, retoCompletado });
}
