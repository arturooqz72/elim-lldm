// src/lib/b2/archivos.ts
//
// Subir y bajar archivos de Backblaze B2 desde el servidor, con la API
// nativa (mismo patrón que delete.ts y las rutas api/*/b2-upload). Lo usa
// la voz del video de TikTok de la Palabra del Día: el navegador nunca ve
// las claves, pide el archivo a una ruta nuestra que lo baja de aquí.
import "server-only";
import { createHash } from "node:crypto";

interface B2AuthResponse {
  apiUrl: string;
  downloadUrl: string;
  authorizationToken: string;
  accountId: string;
  message?: string;
  code?: string;
}

interface B2ListBucketsResponse {
  buckets?: { bucketId: string; bucketName: string }[];
  message?: string;
  code?: string;
}

interface B2UploadUrlResponse {
  uploadUrl: string;
  authorizationToken: string;
  message?: string;
  code?: string;
}

interface Sesion {
  apiUrl: string;
  downloadUrl: string;
  token: string;
  bucketId: string;
  bucketName: string;
  vence: number;
}

// El token de B2 dura 24 h; se reusa unas horas mientras viva la función.
const DURA_SESION_MS = 6 * 60 * 60 * 1000;
let cache: Sesion | null = null;

function error(datos: { message?: string; code?: string }, porDefecto: string): Error {
  return new Error(datos?.message || datos?.code || porDefecto);
}

async function sesion(): Promise<Sesion> {
  if (cache && cache.vence > Date.now()) return cache;

  const keyId = process.env.B2_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;
  const bucketName = process.env.B2_BUCKET_NAME;
  if (!keyId || !applicationKey || !bucketName) {
    throw new Error("Faltan variables de entorno de Backblaze en Vercel.");
  }

  const authResponse = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${applicationKey}`).toString("base64")}` },
  });
  const auth = (await authResponse.json()) as B2AuthResponse;
  if (!authResponse.ok) throw error(auth, "No se pudo autorizar con Backblaze.");

  const bucketsResponse = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_buckets`, {
    method: "POST",
    headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: auth.accountId, bucketName }),
  });
  const buckets = (await bucketsResponse.json()) as B2ListBucketsResponse;
  if (!bucketsResponse.ok) throw error(buckets, "No se pudo obtener el bucket.");
  const bucket = buckets.buckets?.find((b) => b.bucketName === bucketName);
  if (!bucket) throw new Error(`No se encontró el bucket ${bucketName}.`);

  cache = {
    apiUrl: auth.apiUrl,
    downloadUrl: auth.downloadUrl,
    token: auth.authorizationToken,
    bucketId: bucket.bucketId,
    bucketName,
    vence: Date.now() + DURA_SESION_MS,
  };
  return cache;
}

/** B2 pide el nombre codificado, pero las "/" pueden ir tal cual. */
const codificar = (nombre: string) => nombre.split("/").map(encodeURIComponent).join("/");

/** Sube (o reemplaza: B2 guarda la versión nueva encima) un archivo. */
export async function subirArchivoB2(nombre: string, datos: Uint8Array, tipo: string): Promise<void> {
  const s = await sesion();
  const urlResponse = await fetch(`${s.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: "POST",
    headers: { Authorization: s.token, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId: s.bucketId }),
  });
  const destino = (await urlResponse.json()) as B2UploadUrlResponse;
  if (!urlResponse.ok) throw error(destino, "No se pudo obtener la URL de subida.");

  const subida = await fetch(destino.uploadUrl, {
    method: "POST",
    headers: {
      Authorization: destino.authorizationToken,
      "X-Bz-File-Name": codificar(nombre),
      "Content-Type": tipo,
      "Content-Length": String(datos.byteLength),
      "X-Bz-Content-Sha1": createHash("sha1").update(datos).digest("hex"),
    },
    body: Buffer.from(datos),
  });
  if (!subida.ok) {
    throw error((await subida.json().catch(() => ({}))) as { message?: string }, "No se pudo subir el archivo a Backblaze.");
  }
}

/** La versión más reciente del archivo; null si no existe. */
export async function bajarArchivoB2(nombre: string): Promise<Response | null> {
  const s = await sesion();
  const respuesta = await fetch(`${s.downloadUrl}/file/${s.bucketName}/${codificar(nombre)}`, {
    headers: { Authorization: s.token },
    cache: "no-store",
  });
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) {
    throw error((await respuesta.json().catch(() => ({}))) as { message?: string }, "No se pudo bajar el archivo de Backblaze.");
  }
  return respuesta;
}
