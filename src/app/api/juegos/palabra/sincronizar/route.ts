// src/app/api/juegos/palabra/sincronizar/route.ts
//
// Al iniciar sesión, sube a la cuenta las partidas jugadas sin sesión
// (guardadas en localStorage). Nunca confía en los colores ni en el
// resultado que mande el navegador: solo recibe las palabras intentadas,
// las vuelve a validar y evaluar contra la palabra de esa fecha, y guarda
// con origen 'local' (suman a racha y estadísticas, NO a puntos del
// ranking). Si la cuenta ya tiene partida en esa fecha, gana la del
// servidor y la local se ignora.
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PALABRA_DIAS_SINCRONIZABLES, PALABRA_MAX_INTENTOS } from "@/lib/palabra/config";
import {
  diasEntre,
  esFechaIso,
  evaluarIntento,
  normalizarPalabra,
  tieneFormatoValido,
} from "@/lib/palabra/logica";
import {
  fechaDeHoy,
  getEstadoJugador,
  getPalabrasPorFechas,
  recalcularRacha,
} from "@/lib/palabra/servidor";
import { PALABRAS_VALIDAS } from "@/lib/palabra/validas";
import type { PalabraIntento } from "@/types";

const MAX_PARTIDAS = PALABRA_DIAS_SINCRONIZABLES + 1;

export async function POST(request: Request) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });

  let body: { partidas?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const hoy = fechaDeHoy();
  const entrada = (Array.isArray(body.partidas) ? body.partidas : []).slice(0, MAX_PARTIDAS) as Array<{
    fecha?: unknown;
    intentos?: unknown;
  }>;

  const candidatas = entrada.filter((p): p is { fecha: string; intentos: unknown[] } => {
    if (!esFechaIso(p.fecha) || !Array.isArray(p.intentos)) return false;
    const antiguedad = diasEntre(p.fecha, hoy);
    return antiguedad >= 0 && antiguedad <= PALABRA_DIAS_SINCRONIZABLES;
  });

  const service = await createServiceClient();
  const palabras = await getPalabrasPorFechas(
    [...new Set(candidatas.map((p) => p.fecha))],
    service
  );

  const filas: Array<Record<string, unknown>> = [];
  const fechasVistas = new Set<string>();

  for (const p of candidatas) {
    if (fechasVistas.has(p.fecha)) continue;
    const palabra = palabras.get(p.fecha);
    if (!palabra) continue;
    const respuesta = normalizarPalabra(palabra.palabra);

    const intentos: PalabraIntento[] = [];
    let resuelta = false;
    let valida = p.intentos.length >= 1 && p.intentos.length <= PALABRA_MAX_INTENTOS;
    for (const bruto of p.intentos) {
      if (!valida || resuelta) {
        // Intentos después de haberla resuelto = historial manipulado.
        valida = false;
        break;
      }
      const n = typeof bruto === "string" ? normalizarPalabra(bruto) : "";
      if (!tieneFormatoValido(n) || (n !== respuesta && !PALABRAS_VALIDAS.has(n))) {
        valida = false;
        break;
      }
      intentos.push({ palabra: n, colores: evaluarIntento(n, respuesta) });
      resuelta = n === respuesta;
    }
    if (!valida) continue;

    const terminada = resuelta || intentos.length >= PALABRA_MAX_INTENTOS;
    // Una partida a medias de un día que ya pasó no se puede terminar: se ignora.
    if (!terminada && p.fecha !== hoy) continue;

    fechasVistas.add(p.fecha);
    filas.push({
      user_id: user.id,
      fecha: p.fecha,
      intentos,
      num_intentos: intentos.length,
      resuelta,
      terminada,
      origen: "local",
    });
  }

  let importadas = 0;
  if (filas.length > 0) {
    const { data, error } = await service
      .from("palabra_partidas")
      .upsert(filas, { onConflict: "user_id,fecha", ignoreDuplicates: true })
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    importadas = data?.length ?? 0;
    if (importadas > 0) await recalcularRacha(user.id, service);
  }

  const estado = await getEstadoJugador(user.id, hoy, service);
  return NextResponse.json({ importadas, estado });
}
