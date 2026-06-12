import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildLldmSystemPrompt, SYSTEM_PROMPT_GENERAL } from "@/lib/elim-ia/prompts";
import type { ElimIADocument, ElimIAMessage, ElimIAMode } from "@/types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const HISTORY_LIMIT = 20;
const MAX_MESSAGE_LENGTH = 4000;

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Elim IA no está configurado" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as
    | { message?: string; mode?: ElimIAMode }
    | null;

  const message = body?.message?.trim();
  const mode: ElimIAMode = body?.mode === "general" ? "general" : "lldm";

  if (!message) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "Mensaje demasiado largo" }, { status: 400 });
  }

  const { data: historyData } = await supabase
    .from("elim_ia_messages")
    .select("role, content")
    .eq("user_id", user.id)
    .eq("mode", mode)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const history = ((historyData ?? []) as Pick<ElimIAMessage, "role" | "content">[])
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));

  let systemPrompt: string;
  let tools: Record<string, unknown>[] | undefined;

  if (mode === "lldm") {
    const { data: docsData } = await supabase
      .from("elim_ia_documents")
      .select("title, content")
      .order("created_at", { ascending: true });

    const documents = (docsData ?? []) as Pick<ElimIADocument, "title" | "content">[];
    systemPrompt = buildLldmSystemPrompt(documents);
  } else {
    systemPrompt = SYSTEM_PROMPT_GENERAL;
    tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
  }

  const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1536,
      system: systemPrompt,
      messages: [...history, { role: "user", content: message }],
      ...(tools ? { tools } : {}),
    }),
  });

  if (!anthropicResponse.ok) {
    const errText = await anthropicResponse.text();
    console.error("Elim IA — error de Anthropic API:", errText);
    return NextResponse.json({ error: "Error al consultar Elim IA" }, { status: 502 });
  }

  const data = (await anthropicResponse.json()) as { content: AnthropicContentBlock[] };

  const reply = data.content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n\n")
    .trim();

  if (!reply) {
    return NextResponse.json({ error: "Elim IA no generó una respuesta" }, { status: 502 });
  }

  await supabase.from("elim_ia_messages").insert([
    { user_id: user.id, mode, role: "user", content: message },
    { user_id: user.id, mode, role: "assistant", content: reply },
  ]);

  return NextResponse.json({ reply });
}
