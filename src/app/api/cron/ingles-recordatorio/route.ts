import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { enviarRecordatorios } from "@/lib/ingles/recordatorio.server";

export const maxDuration = 60;

/**
 * Cron diario (ver vercel.json, 01:00 UTC = 6 pm del Pacífico en horario de
 * verano; en invierno, 5 pm) — recordatorio de Elim English a quien lo
 * activó y todavía no ha practicado hoy. Máximo uno por persona al día.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await createServiceClient();
  const r = await enviarRecordatorios(admin);
  console.log(
    `[cron/ingles-recordatorio] ${r.dia}: ${r.personas} con recordatorio, ${r.yaPracticaron} ya practicaron, ${r.enviados} enviados (${r.entregados} entregados), ${r.yaEnviados} ya tenían el de hoy`,
  );
  return NextResponse.json({ ok: true, ...r });
}
