// src/lib/radio/estadisticas.server.ts
// Estadísticas de la app instalable Radio Elim (/admin/radio). Solo
// servidor (service role). Días en hora del Pacífico, como el resto del
// panel; no cuenta cuentas admin.

import type { SupabaseClient } from "@supabase/supabase-js";

const TZ = "America/Los_Angeles";
const PAGINA = 1000;

type Plataforma = "ios" | "android" | "otro";

export interface DiaRadioApp {
  dia: string;
  aperturas: number;
  ios: number;
  android: number;
  otro: number;
  /** Personas distintas que la abrieron ese día. */
  personas: number;
}

export interface EstadisticasRadioApp {
  dias: DiaRadioApp[];
  totales: { aperturas: number; ios: number; android: number; otro: number; personas: number };
}

function diaPacifico(fecha: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(fecha),
  );
}

export async function leerEstadisticasRadioApp(
  supabase: SupabaseClient,
  numDias: number,
): Promise<EstadisticasRadioApp> {
  const hoy = diaPacifico(new Date().toISOString());
  const claves: string[] = [];
  for (let i = numDias - 1; i >= 0; i--) {
    // Mediodía UTC evita saltos de día por el horario de verano.
    const d = new Date(`${hoy}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    claves.push(d.toISOString().slice(0, 10));
  }
  // Un día de margen hacia atrás; luego se filtra por día del Pacífico.
  const desdeIso = new Date(new Date(`${claves[0]}T00:00:00Z`).getTime() - 86_400_000).toISOString();

  const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin");
  const excluir = new Set(((admins ?? []) as { id: string }[]).map((a) => a.id));

  // Supabase devuelve máximo 1000 filas por consulta: se pide por páginas.
  type Fila = { created_at: string; user_id: string | null; visitante_id: string | null; plataforma: Plataforma };
  const filas: Fila[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data } = await supabase
      .from("radio_app_aperturas")
      .select("created_at, user_id, visitante_id, plataforma")
      .gte("created_at", desdeIso)
      .order("created_at")
      .range(desde, desde + PAGINA - 1);
    const pagina = (data ?? []) as Fila[];
    filas.push(...pagina);
    if (pagina.length < PAGINA) break;
  }

  const porDia = new Map<string, DiaRadioApp & { quienes: Set<string> }>(
    claves.map((dia) => [dia, { dia, aperturas: 0, ios: 0, android: 0, otro: 0, personas: 0, quienes: new Set() }]),
  );
  const totales = { aperturas: 0, ios: 0, android: 0, otro: 0, personas: 0 };
  const todas = new Set<string>();

  for (const f of filas) {
    const d = porDia.get(diaPacifico(f.created_at));
    const quien = f.user_id ?? f.visitante_id;
    if (!d || !quien || (f.user_id && excluir.has(f.user_id))) continue;
    d.aperturas++;
    d[f.plataforma]++;
    d.quienes.add(quien);
    totales.aperturas++;
    totales[f.plataforma]++;
    todas.add(quien);
  }
  totales.personas = todas.size;

  const dias = claves.map((dia) => {
    const { quienes, ...d } = porDia.get(dia)!;
    return { ...d, personas: quienes.size };
  });
  return { dias, totales };
}
