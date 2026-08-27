import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ROUNDS_MIN, ROUNDS_MAX, ROUNDS_DEFAULT } from "@/lib/ruleta/wheel";

const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function generateCode() {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { rondas?: number };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const rondas = Math.max(
    ROUNDS_MIN,
    Math.min(ROUNDS_MAX, Math.round(body.rondas ?? ROUNDS_DEFAULT))
  );

  const service = await createServiceClient();

  let codigo = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateCode();
    const { data: existing } = await service
      .from("ruleta_salas")
      .select("id")
      .eq("codigo", candidate)
      .maybeSingle();
    if (!existing) {
      codigo = candidate;
      break;
    }
  }

  if (!codigo) {
    return NextResponse.json({ error: "No se pudo generar un código único" }, { status: 500 });
  }

  const { data: sala, error } = await service
    .from("ruleta_salas")
    .insert({ codigo, rondas_totales: rondas, created_by: user.id })
    .select("codigo")
    .single();

  if (error || !sala) {
    return NextResponse.json({ error: error?.message ?? "Error al crear la sala" }, { status: 500 });
  }

  return NextResponse.json({ codigo: sala.codigo });
}
