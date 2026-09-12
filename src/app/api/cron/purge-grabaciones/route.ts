import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { deleteB2File } from "@/lib/b2/delete";

// Puede tardar si hay muchas grabaciones vencidas el mismo día.
export const maxDuration = 60;

/**
 * Cron diario (ver vercel.json) — borra grabaciones de Programas vencidas
 * (programa_grabaciones.expires_at <= ahora), tanto el archivo en Backblaze
 * como la fila en la base de datos.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const { data: expired, error: selectError } = await supabase
    .from("programa_grabaciones")
    .select("id, b2_file_name")
    .lte("expires_at", new Date().toISOString());

  if (selectError) {
    console.error("[cron/purge-grabaciones] error consultando vencidas:", selectError);
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  let deleted = 0;
  let failed = 0;

  for (const row of (expired ?? []) as Array<{ id: string; b2_file_name: string }>) {
    try {
      await deleteB2File(row.b2_file_name);
      await supabase.from("programa_grabaciones").delete().eq("id", row.id);
      deleted++;
    } catch (err) {
      console.error(`[cron/purge-grabaciones] falló para ${row.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ deleted, failed });
}
