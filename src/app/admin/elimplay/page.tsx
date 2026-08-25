import { createClient, createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Plus, Music, Folder } from "lucide-react";
import Link from "next/link";
import { TrackList } from "./TrackList";

export const metadata = { title: "ElimPlay — Admin" };

async function toggleTrackActive(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const next = formData.get("next") === "true";
  const service = await createServiceClient();
  await service
    .from("audio_tracks")
    .update({ is_published: next, published_at: next ? new Date().toISOString() : null })
    .eq("id", id);
  revalidatePath("/admin/elimplay");
}

async function deleteTrack(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const service = await createServiceClient();
  await service.from("audio_tracks").delete().eq("id", id);
  revalidatePath("/admin/elimplay");
}

export default async function AdminElimPlayPage() {
  const supabase = await createClient();

  const [{ data: items }, { data: categoriesData }, { data: artistsData }] = await Promise.all([
    supabase
      .from("audio_tracks")
      .select("id, title, is_published, play_count, created_at, audio_categories(name), artists(name)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("audio_categories").select("id, name").order("order_index", { ascending: true }),
    supabase.from("artists").select("id, name").order("name", { ascending: true }),
  ]);

  const categories = (categoriesData ?? []) as Array<{ id: string; name: string }>;
  const artists = (artistsData ?? []) as Array<{ id: string; name: string }>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>
          ElimPlay
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/elimplay/categorias"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <Folder size={16} />
            Categorías
          </Link>
          <Link
            href="/admin/elimplay/nueva"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            <Plus size={16} />
            Subir audio
          </Link>
        </div>
      </div>

      {(!items || items.length === 0) ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Music size={36} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p style={{ color: "var(--color-text-muted)" }}>
            No hay audios. Sube el primero.
          </p>
        </div>
      ) : (
        <TrackList
          items={
            items as unknown as Array<{
              id: string;
              title: string;
              is_published: boolean;
              play_count: number;
              created_at: string;
              audio_categories: { name: string } | null;
              artists: { name: string } | null;
            }>
          }
          categories={categories}
          artists={artists}
          toggleAction={toggleTrackActive}
          deleteAction={deleteTrack}
        />
      )}
    </div>
  );
}
