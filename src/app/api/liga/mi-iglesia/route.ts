// src/app/api/liga/mi-iglesia/route.ts
//
// { iglesia_id } elige un equipo aprobado; { amigos: true } va a "Amigos
// de Elim"; { nueva: { comunidad, denominacion?, ciudad, estado, pais },
// confirmar? } agrega uno (queda pendiente). Cambiar: una vez cada 30
// días; la primera elección no cuenta, y salir de Amigos de Elim siempre
// se permite.
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { aceptoReglas, faltaAceptarReglas } from "@/lib/reglas.server";
import { COLUMNAS_IGLESIA, claveIglesia, detalleIglesia, limpiar, nombreIglesia, normalizar, type Comunidad, type IglesiaBase } from "@/lib/liga/nombre";
import { LIGA_DIAS_CAMBIO, esDenominacion } from "@/lib/liga/config";

const DIA_MS = 86_400_000;

function texto(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const t = limpiar(valor);
  return t.length >= 1 && t.length <= 60 ? t : null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para elegir tu equipo" }, { status: 401 });
  if (!(await aceptoReglas(user.id))) return faltaAceptarReglas();

  let body: {
    iglesia_id?: unknown;
    amigos?: unknown;
    nueva?: { comunidad?: unknown; denominacion?: unknown; ciudad?: unknown; estado?: unknown; pais?: unknown };
    confirmar?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: perfil } = await service.from("profiles").select("iglesia_id, iglesia_cambiada_en").eq("id", user.id).maybeSingle();
  if (!perfil) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
  const anteriorId = (perfil.iglesia_id as string | null) ?? null;

  const { data: aprobData } = await service.from("iglesias").select(COLUMNAS_IGLESIA).eq("aprobada", true);
  const aprobadas = (aprobData ?? []) as IglesiaBase[];
  const anterior = anteriorId ? (aprobadas.find((i) => i.id === anteriorId) ?? null) : null;

  let destino: (IglesiaBase & { aprobada: boolean }) | null = null;

  if (body.amigos === true) {
    const amigos = aprobadas.find((i) => i.comunidad === "amigos");
    if (!amigos) return NextResponse.json({ error: "Amigos de Elim no está disponible" }, { status: 500 });
    destino = { ...amigos, aprobada: true };
  } else if (typeof body.iglesia_id === "string") {
    const elegida = aprobadas.find((i) => i.id === body.iglesia_id);
    if (!elegida) return NextResponse.json({ error: "Ese equipo no está disponible" }, { status: 404 });
    destino = { ...elegida, aprobada: true };
  } else if (body.nueva) {
    const comunidad = body.nueva.comunidad;
    if (comunidad !== "lldm" && comunidad !== "otra") return NextResponse.json({ error: "Elige si eres LLDM o de otra iglesia" }, { status: 400 });
    const denominacion = comunidad === "otra" ? body.nueva.denominacion : null;
    if (comunidad === "otra" && !esDenominacion(denominacion)) return NextResponse.json({ error: "Elige tu denominación de la lista" }, { status: 400 });
    const ciudad = texto(body.nueva.ciudad);
    const estado = texto(body.nueva.estado);
    const pais = texto(body.nueva.pais);
    if (!ciudad || !estado || !pais) return NextResponse.json({ error: "Escribe ciudad, estado y país (máximo 60 letras cada uno)" }, { status: 400 });
    const den = (denominacion as string | null) ?? null;
    const clave = claveIglesia(comunidad, den, ciudad, estado, pais);

    const { data: existente } = await service.from("iglesias").select(`${COLUMNAS_IGLESIA}, aprobada`).eq("clave", clave).maybeSingle();
    if (existente) {
      destino = existente as IglesiaBase & { aprobada: boolean };
    } else {
      const similares = aprobadas.filter(
        (i) => i.comunidad === comunidad && (i.denominacion ?? null) === den && normalizar(i.ciudad) === normalizar(ciudad)
      );
      if (similares.length > 0 && body.confirmar !== true) {
        return NextResponse.json({ similares: similares.map((i) => ({ id: i.id, nombre: nombreIglesia(i, aprobadas), detalle: detalleIglesia(i) })) });
      }
      const { data: creada, error } = await service
        .from("iglesias")
        .insert({ comunidad, denominacion: den, ciudad, estado, pais, clave, aprobada: false, creada_por: user.id })
        .select(`${COLUMNAS_IGLESIA}, aprobada`)
        .single();
      if (error || !creada) return NextResponse.json({ error: error?.message ?? "No se pudo agregar" }, { status: 500 });
      destino = creada as IglesiaBase & { aprobada: boolean };
    }
  } else {
    return NextResponse.json({ error: "Elige o agrega tu iglesia" }, { status: 400 });
  }

  const respuesta = () =>
    NextResponse.json({
      iglesia: { id: destino!.id, nombre: nombreIglesia(destino!, aprobadas), comunidad: destino!.comunidad as Comunidad, aprobada: destino!.aprobada },
    });

  if (anteriorId === destino.id) return respuesta();

  const salirDeAmigos = anterior?.comunidad === "amigos";
  if (anteriorId && !salirDeAmigos) {
    const ultima = perfil.iglesia_cambiada_en ? Date.parse(perfil.iglesia_cambiada_en as string) : 0;
    const libre = ultima + LIGA_DIAS_CAMBIO * DIA_MS;
    if (ultima && Date.now() < libre) {
      const fecha = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "America/Los_Angeles" }).format(new Date(libre));
      return NextResponse.json({ error: `Solo puedes cambiar de equipo una vez cada ${LIGA_DIAS_CAMBIO} días. Podrás cambiarlo el ${fecha}.` }, { status: 409 });
    }
  }

  const { error: errPerfil } = await service
    .from("profiles")
    .update({ iglesia_id: destino.id, iglesia_preguntada: true, ...(anteriorId ? { iglesia_cambiada_en: new Date().toISOString() } : {}) })
    .eq("id", user.id);
  if (errPerfil) return NextResponse.json({ error: errPerfil.message }, { status: 500 });

  if (!anteriorId) await service.rpc("liga_asignar_sin_iglesia", { p_jugador: user.id, p_iglesia: destino.id });

  return respuesta();
}
