"use server";

import { createServiceClient, getProfile } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type FieldChoice =
  | { mode: "skip" }
  | { mode: "clear" }
  | { mode: "existing"; id: string }
  | { mode: "new"; name: string };

interface BulkUpdateInput {
  ids: string[];
  category: FieldChoice;
  artist: FieldChoice;
}

interface BulkUpdateResult {
  error?: string;
  createdCategory?: { id: string; name: string };
  createdArtist?: { id: string; name: string };
}

export async function bulkUpdateTracks(input: BulkUpdateInput): Promise<BulkUpdateResult> {
  const profile = await getProfile();
  if (!profile || (profile as { role: string }).role !== "admin") {
    return { error: "No autorizado" };
  }

  if (!input.ids || input.ids.length === 0) {
    return { error: "No hay audios seleccionados." };
  }

  const service = await createServiceClient();
  const update: Record<string, string | null> = {};
  let createdCategory: { id: string; name: string } | undefined;
  let createdArtist: { id: string; name: string } | undefined;

  if (input.category.mode === "clear") {
    update.category_id = null;
  } else if (input.category.mode === "existing") {
    update.category_id = input.category.id;
  } else if (input.category.mode === "new") {
    const name = input.category.name.trim();
    if (!name) return { error: "Falta el nombre de la nueva categoría." };

    const { data: existing } = await service
      .from("audio_categories")
      .select("id, name")
      .ilike("name", name)
      .maybeSingle();

    if (existing) {
      update.category_id = existing.id;
    } else {
      const { count } = await service.from("audio_categories").select("id", { count: "exact", head: true });
      const baseSlug = slugify(name) || "categoria";
      let slug = baseSlug;
      let suffix = 1;
      for (;;) {
        const { data: slugMatch } = await service.from("audio_categories").select("id").eq("slug", slug).maybeSingle();
        if (!slugMatch) break;
        suffix++;
        slug = `${baseSlug}-${suffix}`;
      }
      const { data: created, error } = await service
        .from("audio_categories")
        .insert({ name, slug, order_index: count ?? 0 })
        .select("id, name")
        .single();
      if (error) return { error: error.message };
      update.category_id = created.id;
      createdCategory = created;
    }
  }

  if (input.artist.mode === "clear") {
    update.artist_id = null;
  } else if (input.artist.mode === "existing") {
    update.artist_id = input.artist.id;
  } else if (input.artist.mode === "new") {
    const name = input.artist.name.trim();
    if (!name) return { error: "Falta el nombre del nuevo artista." };

    const { data: existing } = await service
      .from("artists")
      .select("id, name")
      .ilike("name", name)
      .maybeSingle();

    if (existing) {
      update.artist_id = existing.id;
    } else {
      const { data: created, error } = await service.from("artists").insert({ name }).select("id, name").single();
      if (error) return { error: error.message };
      update.artist_id = created.id;
      createdArtist = created;
    }
  }

  if (Object.keys(update).length === 0) {
    return { error: "No seleccionaste ningún cambio para aplicar." };
  }

  const { error: updateErr } = await service.from("audio_tracks").update(update).in("id", input.ids);
  if (updateErr) return { error: updateErr.message };

  revalidatePath("/admin/elimplay");
  return { createdCategory, createdArtist };
}
