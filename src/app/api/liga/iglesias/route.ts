// src/app/api/liga/iglesias/route.ts
// Busca equipos aprobados del tipo elegido (LLDM, o una denominación) por ciudad.
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { COLUMNAS_IGLESIA, detalleIglesia, nombreIglesia, normalizar, type IglesiaBase } from "@/lib/liga/nombre";
import { esDenominacion } from "@/lib/liga/config";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = normalizar(params.get("q"));
  const comunidad = params.get("comunidad");
  const denominacion = params.get("denominacion");
  if (q.length < 2 || (comunidad !== "lldm" && comunidad !== "otra")) return NextResponse.json({ iglesias: [] });
  if (comunidad === "otra" && !esDenominacion(denominacion)) return NextResponse.json({ iglesias: [] });

  const service = await createServiceClient();
  const { data, error } = await service.from("iglesias").select(COLUMNAS_IGLESIA).eq("aprobada", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const todas = (data ?? []) as IglesiaBase[];

  const coinciden = todas
    .filter((i) => i.comunidad === comunidad && (comunidad === "lldm" || i.denominacion === denominacion))
    .filter((i) => normalizar(i.ciudad).includes(q) || normalizar(`${i.ciudad} ${i.estado} ${i.pais}`).includes(q))
    .sort((a, b) => Number(!normalizar(a.ciudad).startsWith(q)) - Number(!normalizar(b.ciudad).startsWith(q)) || (a.ciudad ?? "").localeCompare(b.ciudad ?? ""))
    .slice(0, 10)
    .map((i) => ({ id: i.id, nombre: nombreIglesia(i, todas), detalle: detalleIglesia(i) }));

  return NextResponse.json({ iglesias: coinciden });
}
