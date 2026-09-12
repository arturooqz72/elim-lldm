import "server-only";
import { EgressClient, EncodedFileOutput, EncodedFileType, S3Upload, EgressStatus } from "livekit-server-sdk";
import { createServiceClient } from "@/lib/supabase/server";

// Grabación automática de sesiones de Programas — ver 0040_programa_grabaciones.sql.
// Sube directo a Backblaze B2 vía su API S3-compatible (las llaves B2_KEY_ID/
// B2_APPLICATION_KEY sirven igual para la API nativa que ya usan los uploads
// de audios, y para esta API S3 — solo cambia el endpoint).

function getB2S3Config() {
  const accessKey = process.env.B2_KEY_ID;
  const secret = process.env.B2_APPLICATION_KEY;
  const bucket = process.env.B2_BUCKET_NAME;
  const rawEndpoint = process.env.B2_S3_ENDPOINT;

  if (!accessKey || !secret || !bucket || !rawEndpoint) return null;

  const endpoint = rawEndpoint.startsWith("http") ? rawEndpoint : `https://${rawEndpoint}`;
  // s3.<region>.backblazeb2.com
  const region = rawEndpoint.replace(/^https?:\/\//, "").split(".")[1] ?? "us-west-000";

  return { accessKey, secret, bucket, region, endpoint };
}

function buildPublicUrl(fileName: string): string | null {
  const publicBaseUrl = process.env.B2_PUBLIC_BASE_URL;
  const endpoint = process.env.B2_ENDPOINT;
  const bucketName = process.env.B2_BUCKET_NAME;

  if (publicBaseUrl) return `${publicBaseUrl.replace(/\/+$/, "")}/${fileName}`;
  if (endpoint && bucketName) return `${endpoint.replace(/\/+$/, "")}/file/${bucketName}/${fileName}`;
  return null;
}

function getLiveKitConfig() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
}

/**
 * Inicia la grabación (solo audio) de la sala. No falla la transmisión si
 * Backblaze/LiveKit no están configurados para esto — solo la omite.
 */
export async function startProgramRecording(
  roomName: string,
  programaId: string,
  platikaId: string
): Promise<string | null> {
  const s3 = getB2S3Config();
  const livekit = getLiveKitConfig();
  if (!s3 || !livekit) {
    console.warn("[recording] B2 S3 o LiveKit no configurados — se omite la grabación", { roomName });
    return null;
  }

  const filepath = `programa-grabaciones/${programaId}/${platikaId}.mp3`;

  try {
    const egressClient = new EgressClient(livekit.url, livekit.apiKey, livekit.apiSecret);
    const output = new EncodedFileOutput({
      fileType: EncodedFileType.MP3,
      filepath,
      output: {
        case: "s3",
        value: new S3Upload({ ...s3, forcePathStyle: true }),
      },
    });
    const info = await egressClient.startRoomCompositeEgress(roomName, { file: output }, { audioOnly: true });
    return info.egressId;
  } catch (err) {
    console.error("[recording] no se pudo iniciar el egress de grabación:", err);
    return null;
  }
}

/**
 * Detiene la grabación y, en segundo plano (llamar dentro de un `after()`
 * para no bloquear la respuesta al host), espera a que LiveKit termine de
 * subir el archivo a B2 y guarda la fila en programa_grabaciones.
 */
export async function finalizeProgramRecording(params: {
  egressId: string;
  programaId: string;
  platikaId: string;
  titulo: string;
  startedAt: string;
}) {
  const livekit = getLiveKitConfig();
  if (!livekit) return;

  const egressClient = new EgressClient(livekit.url, livekit.apiKey, livekit.apiSecret);

  try {
    await egressClient.stopEgress(params.egressId);
  } catch (err) {
    console.error("[recording] stopEgress falló (puede que ya hubiera terminado):", err);
  }

  // Un audio de hasta 2 horas tarda pocos segundos en terminar de subirse
  // una vez detenido — se sondea en vez de depender de un webhook.
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const list = await egressClient.listEgress({ egressId: params.egressId }).catch(() => []);
    const info = list[0];
    if (!info) continue;

    if (info.status === EgressStatus.EGRESS_COMPLETE) {
      const file = info.fileResults?.[0];
      if (!file) {
        console.error("[recording] egress completó sin fileResults", { egressId: params.egressId });
        return;
      }

      const publicUrl = buildPublicUrl(file.filename);
      if (!publicUrl) {
        console.error("[recording] no se pudo construir la URL pública del archivo", file.filename);
        return;
      }

      const endedAt = new Date();
      const expiresAt = new Date(endedAt.getTime() + 15 * 24 * 60 * 60 * 1000);

      const supabase = await createServiceClient();
      const { error } = await supabase.from("programa_grabaciones").insert({
        programa_id: params.programaId,
        platika_id: params.platikaId,
        titulo: params.titulo,
        audio_url: publicUrl,
        b2_file_name: file.filename,
        duration_seconds: Math.round(Number(file.duration) / 1_000_000_000),
        started_at: params.startedAt,
        ended_at: endedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
      if (error) console.error("[recording] error guardando programa_grabaciones:", error);
      return;
    }

    if (info.status === EgressStatus.EGRESS_FAILED || info.status === EgressStatus.EGRESS_ABORTED) {
      console.error("[recording] egress terminó en error:", info.error);
      return;
    }
  }

  console.error("[recording] tiempo de espera agotado esperando a que el egress termine", params.egressId);
}
