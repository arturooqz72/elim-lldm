// src/app/api/admin/palabra/tiktok/foto/route.ts
//
// GET ?url=<avatar> — la foto de perfil en grande, servida desde nuestro
// dominio para que el lienzo del video de TikTok la pueda dibujar (y
// grabar) sin problemas de CORS. Solo admin, y solo si la URL es el avatar
// de algún perfil: la ruta no baja URLs cualquiera. Caché en B2
// (foto.server.ts) y 1 día en el navegador.
import { NextResponse } from "next/server";
import { createServiceClient, getProfile } from "@/lib/supabase/server";
import { fotoParaVideo, hostPermitido } from "@/lib/palabra/foto.server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_URL = 2048;

export async function GET(request: Request) {
  const profile = await getProfile();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url).searchParams.get("url") ?? "";
  if (url.length > MAX_URL || !hostPermitido(url)) {
    return NextResponse.json({ error: "Foto no permitida" }, { status: 400 });
  }

  try {
    const service = await createServiceClient();
    const { data, error } = await service.from("profiles").select("id").eq("avatar_url", url).limit(1);
    if (error) throw new Error(error.message);
    if (!data?.length) return NextResponse.json({ error: "No es la foto de ningún perfil" }, { status: 404 });

    const foto = await fotoParaVideo(url);
    if (!foto) return NextResponse.json({ error: "No se pudo bajar la foto" }, { status: 502 });
    return new Response(Buffer.from(foto.datos), {
      headers: {
        "Content-Type": foto.tipo,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[palabra/tiktok/foto]", e);
    return NextResponse.json({ error: "No se pudo bajar la foto." }, { status: 502 });
  }
}
