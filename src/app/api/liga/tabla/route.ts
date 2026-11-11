// src/app/api/liga/tabla/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTablaLiga } from "@/lib/liga/consultas.server";
import { aceptoReglas } from "@/lib/reglas.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const acepto = user ? await aceptoReglas(user.id) : false;
  const tabla = await getTablaLiga(user?.id ?? null, acepto);
  return NextResponse.json(tabla, { headers: { "Cache-Control": "no-store" } });
}
