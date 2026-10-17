// src/lib/palabra/foto.server.ts
//
// Fotos de perfil para el video de TikTok. El lienzo no puede dibujar
// fotos de otro dominio sin CORS (Google y Facebook no siempre lo dan), así
// que el servidor las baja y las sirve desde nuestro dominio. Se pide la
// versión grande (FOTO_LADO px) y se guarda en Backblaze B2: la segunda vez
// sale de ahí, sin volver a Google ni a Facebook.
//
// Solo se bajan fotos de hosts conocidos y que sean el avatar de algún
// perfil (lo revisa la ruta), así la ruta no sirve para pedir cualquier URL.
import "server-only";
import { createHash } from "node:crypto";
import { bajarArchivoB2, subirArchivoB2 } from "@/lib/b2/archivos";

/** Lado en px que se le pide a Google/Facebook (el círculo del ganador mide 490). */
export const FOTO_LADO = 512;
const MAX_BYTES = 4 * 1024 * 1024;
const PLAZO_MS = 8000;

const HOSTS = [
  /^lh\d+\.googleusercontent\.com$/,
  /^graph\.facebook\.com$/,
  /^platform-lookaside\.fbsbx\.com$/,
  /(^|\.)fbcdn\.net$/,
  /\.supabase\.co$/,
  /\.backblazeb2\.com$/,
];

export function hostPermitido(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && HOSTS.some((h) => h.test(u.hostname));
  } catch {
    return false;
  }
}

/** La misma foto en tamaño grande, si el servicio deja pedirlo; la original al final por si falla. */
function versiones(url: string): string[] {
  const u = new URL(url);
  const grandes: string[] = [];
  if (u.hostname.endsWith("googleusercontent.com")) {
    // ".../a/ABC=s96-c" → ".../a/ABC=s512-c"
    const ruta = /=[^/]*$/.test(u.pathname) ? u.pathname.replace(/=[^/]*$/, `=s${FOTO_LADO}-c`) : `${u.pathname}=s${FOTO_LADO}-c`;
    grandes.push(`${u.origin}${ruta}${u.search}`);
  } else if (u.hostname === "graph.facebook.com" || u.hostname === "platform-lookaside.fbsbx.com") {
    const g = new URL(url);
    g.searchParams.delete("type");
    g.searchParams.set("width", String(FOTO_LADO));
    g.searchParams.set("height", String(FOTO_LADO));
    grandes.push(g.toString());
  }
  return [...new Set([...grandes, url])];
}

interface Foto {
  datos: Uint8Array;
  tipo: string;
}

async function bajar(url: string): Promise<Foto | null> {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(PLAZO_MS), cache: "no-store" });
  // Facebook redirige a su CDN: el destino final también tiene que ser conocido.
  if (!res.ok || !hostPermitido(res.url || url)) return null;
  const tipo = res.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!tipo.startsWith("image/")) return null;
  const datos = new Uint8Array(await res.arrayBuffer());
  if (datos.byteLength === 0 || datos.byteLength > MAX_BYTES) return null;
  return { datos, tipo };
}

const nombreEnB2 = (url: string) =>
  `palabra-tiktok/fotos/${createHash("sha256").update(url).digest("hex").slice(0, 40)}-${FOTO_LADO}`;

/** La foto grande del avatar `url` (de B2 si ya se bajó antes); null si no se pudo. */
export async function fotoParaVideo(url: string): Promise<Foto | null> {
  const nombre = nombreEnB2(url);
  try {
    const guardada = await bajarArchivoB2(nombre);
    if (guardada?.ok) {
      return { datos: new Uint8Array(await guardada.arrayBuffer()), tipo: guardada.headers.get("content-type") ?? "image/jpeg" };
    }
  } catch (e) {
    console.error("[palabra/foto] B2 al leer", e);
  }

  for (const v of versiones(url)) {
    const foto = await bajar(v).catch(() => null);
    if (!foto) continue;
    // Si B2 falla, la foto igual se sirve; solo no queda guardada.
    await subirArchivoB2(nombre, foto.datos, foto.tipo).catch((e) => console.error("[palabra/foto] B2 al guardar", e));
    return foto;
  }
  return null;
}
