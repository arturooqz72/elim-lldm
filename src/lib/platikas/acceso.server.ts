import "server-only";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Misma regla que platika_es_del_equipo() en
// supabase/migrations/0070_platikas_visibilidad_rls.sql — si cambia una,
// cambiar la otra.
const ROLES_EQUIPO = ["admin", "super_moderador", "moderador"];

export type Visibilidad = "publico" | "oculto" | "privado";

/**
 * Carga una transmisión por id para quien abre su enlace directo.
 *
 * Por la API (RLS) las ocultas y privadas solo las ve el equipo. Aquí se
 * leen con service role y se decide en el servidor:
 *   • 'publico' y 'oculto' → cualquiera con el enlace.
 *   • 'privado' → solo el equipo, quien la creó y los conductores del
 *     programa. Para los demás devuelve null, igual que si no existiera.
 *
 * `columnas` debe incluir host_id, programa_id y visibilidad.
 */
export async function cargarPlatikaConEnlace<T extends PlatikaAcceso>(
  id: string,
  columnas: string,
  userId?: string | null
): Promise<T | null> {
  const service = await createServiceClient();
  const { data } = await service.from("platikas").select(columnas).eq("id", id).maybeSingle();
  const platika = data as unknown as T | null;
  if (!platika) return null;
  if (platika.visibilidad !== "privado") return platika;

  const uid = userId === undefined ? await usuarioActual() : userId;
  if (!uid) return null;
  return (await esDelEquipo(uid, platika)) ? platika : null;
}

export interface PlatikaAcceso {
  host_id: string;
  programa_id: string | null;
  visibilidad: Visibilidad;
}

async function usuarioActual(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function esDelEquipo(uid: string, platika: PlatikaAcceso): Promise<boolean> {
  if (uid === platika.host_id) return true;

  const service = await createServiceClient();
  const { data: perfil } = await service.from("profiles").select("role").eq("id", uid).maybeSingle();
  if (perfil && ROLES_EQUIPO.includes((perfil as { role: string }).role)) return true;

  if (!platika.programa_id) return false;
  const { data: conductor } = await service
    .from("programa_hosts")
    .select("id")
    .eq("programa_id", platika.programa_id)
    .eq("user_id", uid)
    .maybeSingle();
  return !!conductor;
}
