import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getYoutubeAuthUrl } from "@/lib/youtube/oauth";

const STATE_COOKIE = "yt_oauth_state";

function redirectWithError(message: string) {
  const url = new URL("/platikas/programas", "https://elimlldm.net");
  url.searchParams.set("youtubeError", message);
  return NextResponse.redirect(url);
}

// Conectar el canal es admin-only: es una credencial durable de todo
// el ministerio, más sensible que activar un destino puntual. Esto se
// navega directo en el navegador (no un fetch), así que los errores
// redirigen con un mensaje en vez de devolver JSON crudo.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectWithError("Inicia sesión para conectar YouTube");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return redirectWithError("Solo un administrador puede conectar el canal");
  }

  const state = crypto.randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(getYoutubeAuthUrl(state));
}
