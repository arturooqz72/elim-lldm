// src/app/api/cron/liga-cierre/route.ts
//
// Cron del lunes (vercel.json): 07:05 y 08:05 UTC = 00:05 del Pacífico con
// y sin horario de verano. Guarda el campeón de la semana pasada; si ya
// estaba guardado, no hace nada.
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { semanaActual } from "@/lib/liga/consultas.server";
import { sumarDias } from "@/lib/palabra/logica";

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "Falta CRON_SECRET" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const semana = sumarDias(semanaActual(), -7);
  const service = await createServiceClient();
  const { data, error } = await service.rpc("liga_cerrar_semana", { p_semana: semana });
  if (error) {
    console.error("[cron/liga-cierre]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log("[cron/liga-cierre]", semana, data ? "campeón guardado" : "sin cambios");
  return NextResponse.json({ semana, guardada: data === true });
}
