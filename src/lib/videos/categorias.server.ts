// src/lib/videos/categorias.server.ts
// Ayudas de servidor para las categorías de videos (solo admin): verificar
// el rol en cada acción y crear una categoría con un slug que no choque.
import "server-only";
import { createServiceClient, getProfile } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

/** Id del admin que hace la acción, o null si no es admin. */
export async function adminId(): Promise<string | null> {
  const profile = (await getProfile()) as { id: string; role: string } | null;
  return profile?.role === "admin" ? profile.id : null;
}

type Servicio = Awaited<ReturnType<typeof createServiceClient>>;

/** Slug a partir del nombre; si ya existe, le agrega -2, -3… */
async function slugLibre(service: Servicio, nombre: string): Promise<string> {
  const base = slugify(nombre) || "categoria";
  const { data } = await service.from("video_categories").select("slug").like("slug", `${base}%`);
  const usados = new Set((data ?? []).map((c: { slug: string }) => c.slug));
  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export interface NuevaCategoria {
  name: string;
  description?: string | null;
  icon?: string | null;
  order_index?: number;
}

/** Crea la categoría (al final de la lista si no trae orden) y devuelve su id. */
export async function crearCategoria(service: Servicio, nueva: NuevaCategoria): Promise<string> {
  let orden = nueva.order_index;
  if (orden === undefined) {
    const { count } = await service.from("video_categories").select("id", { count: "exact", head: true });
    orden = count ?? 0;
  }
  const { data, error } = await service
    .from("video_categories")
    .insert({
      name: nueva.name,
      slug: await slugLibre(service, nueva.name),
      description: nueva.description ?? null,
      icon: nueva.icon ?? null,
      order_index: orden,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo crear la categoría");
  return (data as { id: string }).id;
}

/**
 * La categoría que eligió el admin en un video: la del menú, o una nueva si
 * escogió "+ Nueva categoría…" y escribió el nombre. null = sin categoría.
 */
export async function categoriaElegida(service: Servicio, formData: FormData): Promise<string | null> {
  const nueva = ((formData.get("new_category_name") as string | null) ?? "").trim().slice(0, 60);
  if (formData.get("category_id") === "__nueva__") {
    return nueva ? crearCategoria(service, { name: nueva }) : null;
  }
  return (formData.get("category_id") as string) || null;
}
