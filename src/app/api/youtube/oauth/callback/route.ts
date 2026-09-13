import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { exchangeYoutubeCode, fetchYoutubeChannel } from "@/lib/youtube/oauth";
import { createPersistentLiveStream } from "@/lib/youtube/live";
import { encryptSecret } from "@/lib/crypto/destinos";

const STATE_COOKIE = "yt_oauth_state";

function redirectWithError(message: string) {
  const url = new URL("/platikas/programas", "https://elimlldm.net");
  url.searchParams.set("youtubeError", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) return redirectWithError("Conexión cancelada");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithError("Solicitud inválida o expirada, intenta de nuevo");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectWithError("Sesión expirada, inicia sesión de nuevo");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return redirectWithError("Solo un administrador puede conectar el canal");
  }

  try {
    const tokens = await exchangeYoutubeCode(code);
    if (!tokens.refresh_token) {
      return redirectWithError(
        "Google no devolvió un refresh token — desconecta la app en myaccount.google.com/permissions y vuelve a intentar"
      );
    }

    const channel = await fetchYoutubeChannel(tokens.access_token);
    const stream = await createPersistentLiveStream(
      tokens.access_token,
      `Elim LLDM — ${channel.title}`
    );

    const service = await createServiceClient();

    // Un solo canal conectado a la vez — reconectar reemplaza al
    // anterior.
    await service.from("youtube_connections").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await service.from("destinos").delete().not("youtube_connection_id", "is", null);

    const { data: connection, error: insertError } = await service
      .from("youtube_connections")
      .insert({
        channel_id: channel.id,
        channel_title: channel.title,
        access_token_cifrado: encryptSecret(tokens.access_token),
        refresh_token_cifrado: encryptSecret(tokens.refresh_token),
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        stream_id: stream.streamId,
        rtmp_url: stream.rtmpUrl,
        stream_key_cifrado: encryptSecret(stream.streamKey),
        connected_by: user.id,
      })
      .select("id")
      .single();

    if (insertError || !connection) {
      return redirectWithError(insertError?.message ?? "No se pudo guardar la conexión");
    }

    await service.from("destinos").insert({
      nombre: `YouTube — ${channel.title}`,
      plataforma: "youtube",
      rtmp_url: stream.rtmpUrl,
      stream_key_cifrado: encryptSecret(stream.streamKey),
      youtube_connection_id: connection.id,
      created_by: user.id,
    });

    const url = new URL("/platikas/programas", "https://elimlldm.net");
    url.searchParams.set("youtubeConnected", channel.title);
    return NextResponse.redirect(url);
  } catch (err) {
    return redirectWithError(err instanceof Error ? err.message : "Error al conectar YouTube");
  }
}
