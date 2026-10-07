import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { esModo, esNivel, esSituacion, inglesConfig, inglesPaquetes } from "@/lib/ingles/config";
import { promptTutora } from "@/lib/ingles/prompts";
import type { InglesSaldo } from "@/types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface Consumo {
  origen: "gratis" | "credito" | "limite_alcanzado";
  gratis_restantes: number;
  creditos: number;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Elim English no está configurado" }, { status: 500 });

  const cfg = inglesConfig();
  const body = (await request.json().catch(() => null)) as
    | { message?: string; nivel?: string; modo?: string; situacion?: string }
    | null;

  const message = body?.message?.trim();
  const nivel = esNivel(body?.nivel) ? body.nivel : "principiante";
  const modo = esModo(body?.modo) ? body.modo : "conversacion";
  const situacion = esSituacion(body?.situacion) ? body.situacion : "restaurante";

  if (!message) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  if (message.length > cfg.maxCaracteres) {
    return NextResponse.json(
      { error: `El mensaje es muy largo (máximo ${cfg.maxCaracteres} caracteres)` },
      { status: 400 },
    );
  }

  // 1) Descontar el mensaje ANTES de llamar al modelo (atómico, en Postgres).
  const admin = await createServiceClient();
  const { data: consumoData, error: consumoError } = await admin
    .rpc("english_consumir_mensaje", { p_user: user.id, p_limite_gratis: cfg.gratisDiarios })
    .single();

  if (consumoError || !consumoData) {
    console.error("Elim English — error al descontar mensaje:", consumoError?.message);
    return NextResponse.json({ error: "No se pudo verificar tu saldo" }, { status: 500 });
  }

  const consumo = consumoData as Consumo;
  const saldo: InglesSaldo = {
    gratisRestantes: consumo.gratis_restantes,
    gratisDiarios: cfg.gratisDiarios,
    creditos: consumo.creditos,
  };

  if (consumo.origen === "limite_alcanzado") {
    return NextResponse.json({ estado: "limite_alcanzado", saldo, paquetes: inglesPaquetes() });
  }

  // 2) Solo los últimos mensajes de este modo, no todo el historial.
  const { data: historyData } = await supabase
    .from("english_mensajes")
    .select("role, content")
    .eq("user_id", user.id)
    .eq("modo", modo)
    .order("created_at", { ascending: false })
    .limit(cfg.historial);

  const history = ((historyData ?? []) as { role: "user" | "assistant"; content: string }[]).reverse();
  // La API exige que la conversación empiece con un mensaje del usuario.
  while (history.length && history[0].role !== "user") history.shift();

  // 3) Llamar al modelo; si falla, se devuelve el mensaje descontado.
  async function devolver() {
    await admin.rpc("english_devolver_mensaje", { p_user: user!.id, p_origen: consumo.origen });
  }

  let reply = "";
  try {
    const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.modelo,
        max_tokens: cfg.maxTokens,
        system: promptTutora(nivel, modo, situacion),
        messages: [...history, { role: "user", content: message }],
      }),
    });

    if (!anthropicResponse.ok) {
      console.error("Elim English — error de Anthropic API:", await anthropicResponse.text());
      await devolver();
      return NextResponse.json({ error: "Error al consultar a la tutora. Tu mensaje no se cobró." }, { status: 502 });
    }

    const data = (await anthropicResponse.json()) as { content: AnthropicContentBlock[] };
    reply = data.content
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n\n")
      .trim();
  } catch (err) {
    console.error("Elim English — fallo de red con Anthropic:", err);
    await devolver();
    return NextResponse.json({ error: "Error al consultar a la tutora. Tu mensaje no se cobró." }, { status: 502 });
  }

  if (!reply) {
    await devolver();
    return NextResponse.json({ error: "La tutora no generó una respuesta. Tu mensaje no se cobró." }, { status: 502 });
  }

  // 4) Guardar la conversación. created_at explícito para que la pregunta
  // quede siempre antes que la respuesta al ordenar.
  const ahora = Date.now();
  const { error: insertError } = await admin.from("english_mensajes").insert([
    { user_id: user.id, modo, role: "user", content: message, created_at: new Date(ahora).toISOString() },
    { user_id: user.id, modo, role: "assistant", content: reply, created_at: new Date(ahora + 1).toISOString() },
  ]);
  if (insertError) console.error("Elim English — no se guardó el historial:", insertError.message);

  return NextResponse.json({ estado: "ok", reply, saldo });
}
