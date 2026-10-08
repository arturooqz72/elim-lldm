import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { inglesConfig } from "@/lib/ingles/config";
import { promptTutora } from "@/lib/ingles/prompts";
import { conversar, type MensajeModelo } from "@/lib/ingles/anthropic.server";
import { anonIdValido, COOKIE_PRUEBA, hashIp, opcionesCookiePrueba } from "@/lib/ingles/prueba.server";

interface Consumo {
  origen: "ok" | "limite" | "reclamado" | "saturado";
  restantes: number;
  dia_pacifico: string;
}

// Prueba sin cuenta: Conversación libre, nivel Principiante, siempre. El
// límite se cuenta en Postgres por cookie anónima y por IP (con hash); el
// navegador solo muestra lo que el servidor responde.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return NextResponse.json({ error: "Ya iniciaste sesión; recarga la página." }, { status: 409 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Elim English no está configurado" }, { status: 500 });
  }

  const cfg = inglesConfig();
  const body = (await request.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  if (message.length > cfg.maxCaracteres) {
    return NextResponse.json(
      { error: `El mensaje es muy largo (máximo ${cfg.maxCaracteres} caracteres)` },
      { status: 400 },
    );
  }

  const anonId = anonIdValido((await cookies()).get(COOKIE_PRUEBA)?.value) ?? crypto.randomUUID();
  const ipHash = hashIp(request);

  function responder(datos: Record<string, unknown>, status = 200) {
    const res = NextResponse.json(datos, { status });
    res.cookies.set(COOKIE_PRUEBA, anonId, opcionesCookiePrueba);
    return res;
  }

  // 1) Apartar el mensaje ANTES de llamar al modelo (atómico, en Postgres).
  const admin = await createServiceClient();
  const { data: consumoData, error: consumoError } = await admin
    .rpc("english_prueba_consumir", {
      p_anon: anonId,
      p_ip_hash: ipHash,
      p_limite: cfg.pruebaMensajes,
      p_limite_ip: cfg.pruebaPorIpDiaria,
      p_limite_global: cfg.pruebaGlobalDiaria,
    })
    .single();

  if (consumoError || !consumoData) {
    console.error("Elim English — error al apartar mensaje de prueba:", consumoError?.message);
    return responder({ error: "No se pudo enviar tu mensaje. Intenta de nuevo." }, 500);
  }

  const consumo = consumoData as Consumo;
  if (consumo.origen === "limite" || consumo.origen === "reclamado") {
    return responder({ estado: consumo.origen, restantes: 0 });
  }
  if (consumo.origen === "saturado") {
    return responder(
      { error: "La prueba gratis está muy concurrida hoy. Crea tu cuenta gratis para seguir practicando." },
      503,
    );
  }

  // 2) Historial de esta prueba, leído del servidor (no del navegador).
  const { data: historyData } = await admin
    .from("english_prueba_mensajes")
    .select("role, content")
    .eq("anon_id", anonId)
    .order("created_at", { ascending: false })
    .limit(cfg.historial);
  const history = ((historyData ?? []) as MensajeModelo[]).reverse();
  while (history.length && history[0].role !== "user") history.shift();

  // 3) Llamar al modelo; si falla, se devuelve el mensaje apartado.
  const reply = await conversar(
    promptTutora("principiante", "conversacion", "restaurante"),
    [...history, { role: "user", content: message }],
    cfg.maxTokens,
  );
  if (!reply) {
    await admin.rpc("english_prueba_devolver", { p_anon: anonId, p_ip_hash: ipHash, p_dia: consumo.dia_pacifico });
    return responder({ error: "Error al consultar a la tutora. Este mensaje no se contó; intenta de nuevo." }, 502);
  }

  // 4) Guardar la conversación (pregunta siempre antes que la respuesta).
  const ahora = Date.now();
  const { error: insertError } = await admin.from("english_prueba_mensajes").insert([
    { anon_id: anonId, role: "user", content: message, created_at: new Date(ahora).toISOString() },
    { anon_id: anonId, role: "assistant", content: reply, created_at: new Date(ahora + 1).toISOString() },
  ]);
  if (insertError) console.error("Elim English — no se guardó la prueba:", insertError.message);

  return responder({ estado: "ok", reply, restantes: consumo.restantes });
}
