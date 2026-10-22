// src/lib/palabra/voz.server.ts
//
// Voz del video de TikTok de la Palabra del Día: el guion se manda a
// ElevenLabs (con los tiempos de cada carácter, para sincronizar las
// escenas) y el MP3 y sus datos se guardan en Backblaze B2, uno por día,
// para no pagar dos veces la misma voz. La clave de ElevenLabs solo se usa
// aquí, en el servidor.
import "server-only";
import { bajarArchivoB2, subirArchivoB2 } from "@/lib/b2/archivos";
import type { PalabraVozAlineacion, PalabraVozTikTok } from "@/types";

const MODELO = "eleven_multilingual_v2";
const AJUSTES = { stability: 0.45, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true };

/** Carpeta de B2 de cada video: uno por día (Palabra) o por semana (Campeones, con la fecha del lunes). */
export type CarpetaVoz = "palabra-tiktok" | "campeones-tiktok";

const archivo = (carpeta: CarpetaVoz, fecha: string, extension: "mp3" | "json") => `${carpeta}/${fecha}/voz.${extension}`;

interface RespuestaElevenLabs {
  audio_base64?: string;
  alignment?: PalabraVozAlineacion | null;
  detail?: { message?: string; status?: string } | { msg?: string }[] | string;
}

function mensajeDeError(datos: RespuestaElevenLabs, status: number): string {
  const d = datos.detail;
  const texto =
    typeof d === "string"
      ? d
      : Array.isArray(d)
        ? d.map((x) => x.msg).filter(Boolean).join("; ")
        : (d?.message ?? d?.status);
  return `ElevenLabs respondió ${status}${texto ? `: ${texto}` : "."}`;
}

/** Datos de la voz guardada del día; null si todavía no se ha generado. */
export async function leerVoz(fecha: string, carpeta: CarpetaVoz = "palabra-tiktok"): Promise<PalabraVozTikTok | null> {
  const respuesta = await bajarArchivoB2(archivo(carpeta, fecha, "json"));
  return respuesta ? ((await respuesta.json()) as PalabraVozTikTok) : null;
}

/** El MP3 guardado del día; null si no existe. */
export function audioDeVoz(fecha: string, carpeta: CarpetaVoz = "palabra-tiktok"): Promise<Response | null> {
  return bajarArchivoB2(archivo(carpeta, fecha, "mp3"));
}

/** Genera la voz con ElevenLabs y la guarda en B2 (reemplaza la anterior del día). */
export async function generarVoz(
  fecha: string,
  guion: string,
  carpeta: CarpetaVoz = "palabra-tiktok"
): Promise<PalabraVozTikTok> {
  const clave = process.env.ELEVENLABS_API_KEY;
  const voz = process.env.ELEVENLABS_VOICE_ID;
  if (!clave || !voz) throw new Error("Faltan ELEVENLABS_API_KEY o ELEVENLABS_VOICE_ID en Vercel.");

  const respuesta = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voz)}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": clave, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        text: guion,
        model_id: MODELO,
        voice_settings: AJUSTES,
        // multilingual_v2 rechaza language_code; los demás modelos lo usan para no leer con acento de otro idioma.
        ...(MODELO.startsWith("eleven_multilingual_v2") ? {} : { language_code: "es" }),
      }),
      cache: "no-store",
    }
  );
  const datos = (await respuesta.json().catch(() => ({}))) as RespuestaElevenLabs;
  if (!respuesta.ok) throw new Error(mensajeDeError(datos, respuesta.status));
  if (!datos.audio_base64 || !datos.alignment) throw new Error("ElevenLabs no devolvió el audio completo.");

  // ElevenLabs reporta lo que cobró en un encabezado (el nombre cambió con
  // el tiempo); si no viene, cobra un crédito por carácter del guion.
  const cobrados = Number(respuesta.headers.get("character-cost") ?? respuesta.headers.get("x-character-count"));
  const guardada: PalabraVozTikTok = {
    fecha,
    guion,
    caracteres: Number.isFinite(cobrados) && cobrados > 0 ? cobrados : guion.length,
    creada: new Date().toISOString(),
    alineacion: datos.alignment,
  };

  // Primero el MP3 y al final los datos: si existe el JSON, el MP3 ya está.
  await subirArchivoB2(archivo(carpeta, fecha, "mp3"), Buffer.from(datos.audio_base64, "base64"), "audio/mpeg");
  await subirArchivoB2(archivo(carpeta, fecha, "json"), Buffer.from(JSON.stringify(guardada)), "application/json");
  return guardada;
}
