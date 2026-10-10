// src/lib/ingles/voz.server.ts
// Práctica de voz de Elim English (modo Pronunciación y tarjetas del chat):
// contador diario propio (aparte de los mensajes escritos), validación del
// audio y evaluación con Azure + explicación de la tutora. Solo servidor.

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inglesConfig } from "./config";
import { evaluarPronunciacion } from "./azure.server";
import { pedirAlModelo } from "./anthropic.server";
import { pedidoExplicacion, SISTEMA_EXPLICACION } from "./pronunciacion-prompts";
import { sonidosFallados } from "./sonidos";
import { bytesMaximos, leerWav } from "./wav";
import type { InglesNivel, InglesSonido, PronResultado } from "@/types";

const MIN_SEGUNDOS = 0.5;

/** Intentos de voz que le quedan hoy (día del Pacífico, igual que la RPC). */
export async function vozRestantesHoy(admin: SupabaseClient, userId: string, dia: string): Promise<number> {
  const { vozGratisDiarios } = inglesConfig();
  const { data } = await admin
    .from("english_voz_diario")
    .select("usados")
    .eq("user_id", userId)
    .eq("dia", dia)
    .maybeSingle();
  return Math.max(0, vozGratisDiarios - ((data as { usados: number } | null)?.usados ?? 0));
}

export interface Apartado {
  permitido: boolean;
  restantes: number;
  dia: string;
}

/** Aparta un intento de voz (atómico). Si Azure falla, hay que devolverlo. */
export async function apartarVoz(admin: SupabaseClient, userId: string): Promise<Apartado | null> {
  const { data, error } = await admin
    .rpc("english_consumir_voz", { p_user: userId, p_limite: inglesConfig().vozGratisDiarios })
    .single();
  if (error || !data) {
    console.error("Elim English — error al apartar intento de voz:", error?.message);
    return null;
  }
  const r = data as { permitido: boolean; restantes: number; dia_pacifico: string };
  return { permitido: r.permitido, restantes: r.restantes, dia: r.dia_pacifico };
}

export async function devolverVoz(admin: SupabaseClient, userId: string, dia: string): Promise<void> {
  const { error } = await admin.rpc("english_devolver_voz", { p_user: userId, p_dia: dia });
  if (error) console.error("Elim English — no se devolvió el intento de voz:", error.message);
}

export type AudioLeido = { ok: true; wav: ArrayBuffer; segundos: number; form: FormData } | { ok: false; respuesta: NextResponse };

/**
 * Lee y valida la grabación (WAV 16 kHz mono, duración real leída del
 * encabezado) antes de apartar nada.
 */
export async function leerAudio(request: Request): Promise<AudioLeido> {
  const { pronMaxSegundos } = inglesConfig();
  const largo = () =>
    NextResponse.json({ error: `La grabación es demasiado larga (máximo ${pronMaxSegundos} segundos)` }, { status: 413 });
  const limiteBytes = bytesMaximos(pronMaxSegundos);
  if (Number(request.headers.get("content-length") ?? 0) > limiteBytes + 4096) return { ok: false, respuesta: largo() };

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!form || !(audio instanceof Blob)) {
    return { ok: false, respuesta: NextResponse.json({ error: "Datos incompletos" }, { status: 400 }) };
  }
  if (audio.size > limiteBytes) return { ok: false, respuesta: largo() };

  const wav = await audio.arrayBuffer();
  const info = leerWav(wav);
  if (!info.ok) return { ok: false, respuesta: NextResponse.json({ error: info.motivo }, { status: 400 }) };
  if (info.segundos > pronMaxSegundos + 0.5) return { ok: false, respuesta: largo() };
  if (info.segundos < MIN_SEGUNDOS) {
    return {
      ok: false,
      respuesta: NextResponse.json(
        { estado: "sin_voz", error: "La grabación es muy corta. Di la frase completa." },
        { status: 422 },
      ),
    };
  }
  return { ok: true, wav, segundos: info.segundos, form };
}

export type Evaluado =
  | { ok: true; resultado: PronResultado; sonidos: InglesSonido[] }
  | { ok: false; tipo: "sin_voz" | "error"; detalle: string };

/** Azure + explicación corta en español de la tutora. */
export async function evaluarYExplicar(wav: ArrayBuffer, texto: string, nivel: InglesNivel): Promise<Evaluado> {
  const azure = await evaluarPronunciacion(wav, texto);
  if (!azure.ok) return azure;
  const { evaluacion } = azure;
  const sonidos = sonidosFallados(evaluacion.palabras);
  const explicacion = await pedirAlModelo(SISTEMA_EXPLICACION, pedidoExplicacion(texto, nivel, evaluacion), 350);
  return { ok: true, resultado: { ...evaluacion, sonidosFallados: sonidos, explicacion }, sonidos };
}

/** Respuesta cuando Azure no evaluó (no se descontó el intento). */
export function respuestaSinEvaluar(tipo: "sin_voz" | "error", extra: Record<string, unknown>): NextResponse {
  if (tipo === "sin_voz") {
    return NextResponse.json(
      {
        estado: "sin_voz",
        error: "No escuchamos tu voz. Acércate al micrófono, di la frase completa e intenta de nuevo. Este intento no se contó.",
        ...extra,
      },
      { status: 422 },
    );
  }
  return NextResponse.json(
    {
      estado: "error",
      error: "No se pudo evaluar tu pronunciación en este momento. Este intento no se contó; intenta de nuevo.",
      ...extra,
    },
    { status: 502 },
  );
}
