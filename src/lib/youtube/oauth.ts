import { encryptSecret, decryptSecret } from "@/lib/crypto/destinos";
import { createServiceClient } from "@/lib/supabase/server";

const SCOPE = "https://www.googleapis.com/auth/youtube";

function getRedirectUri(): string {
  return process.env.YOUTUBE_OAUTH_REDIRECT_URI ?? "https://elimlldm.net/api/youtube/oauth/callback";
}

export function getYoutubeAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.YOUTUBE_OAUTH_CLIENT_ID!,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export async function exchangeYoutubeCode(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.YOUTUBE_OAUTH_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_OAUTH_CLIENT_SECRET!,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error(`No se pudo canjear el código de YouTube (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

async function refreshYoutubeAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.YOUTUBE_OAUTH_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_OAUTH_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error(`No se pudo refrescar el token de YouTube (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function fetchYoutubeChannel(
  accessToken: string
): Promise<{ id: string; title: string }> {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    throw new Error(`No se pudo obtener el canal de YouTube (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const channel = data.items?.[0];
  if (!channel) throw new Error("La cuenta de Google conectada no tiene un canal de YouTube");
  return { id: channel.id as string, title: channel.snippet?.title as string };
}

// Devuelve un access_token vigente para la conexión guardada,
// refrescándolo (y actualizando la fila) si ya venció o está por
// vencer — YouTube Data API rechaza tokens expirados sin aviso previo.
export async function getValidYoutubeAccessToken(): Promise<string> {
  const supabase = await createServiceClient();
  const { data: connection } = await supabase
    .from("youtube_connections")
    .select("*")
    .single();

  if (!connection) throw new Error("No hay un canal de YouTube conectado");

  const expiresAt = new Date(connection.token_expires_at as string).getTime();
  const stillValid = expiresAt - Date.now() > 2 * 60 * 1000; // 2 min de margen

  if (stillValid) {
    return decryptSecret(connection.access_token_cifrado as string);
  }

  const refreshToken = decryptSecret(connection.refresh_token_cifrado as string);
  const tokens = await refreshYoutubeAccessToken(refreshToken);

  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabase
    .from("youtube_connections")
    .update({
      access_token_cifrado: encryptSecret(tokens.access_token),
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id as string);

  return tokens.access_token;
}
