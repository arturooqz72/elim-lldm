import { createClient, createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Plus, Layers, Music, Eye, EyeOff, Pencil, Folder } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { TrackRowActions } from "./TrackRowActions";

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

  const { data: items } = await supabase
    .from("audio_tracks")
    .select("id, title, artist, is_published, play_count, created_at, audio_categories(name)")
    .order("created_at", { ascending: false })
    .limit(50);

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
            href="/admin/elimplay/nueva/masiva"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <Layers size={16} />
            Subida masiva
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
        <div className="flex flex-col gap-2">
          {(items as unknown as Array<{
            id: string;
            title: string;
            artist: string | null;
            is_published: boolean;
            play_count: number;
            created_at: string;
            audio_categories: { name: string } | null;
          }>).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-5 py-4 rounded-2xl"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                {item.is_published ? (
                  <Eye size={15} style={{ color: "var(--color-success)" }} />
                ) : (
                  <EyeOff size={15} style={{ color: "var(--color-text-muted)" }} />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                    {item.title}
                    {item.artist && (
                      <span className="font-normal" style={{ color: "var(--color-text-muted)" }}>
                        {" "}— {item.artist}
                      </span>
                    )}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {(item.audio_categories as { name: string } | null)?.name ?? "Sin categoría"} ·{" "}
                    {item.play_count} reproducciones · {formatDate(item.created_at).split(",")[0]}
                  </p>
                </div>
              </div>
              <div className="ml-3 flex items-center gap-2 shrink-0">
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    background: item.is_published ? "rgba(74,222,128,0.1)" : "var(--color-surface-elevated)",
                    color: item.is_published ? "var(--color-success)" : "var(--color-text-muted)",
                  }}
                >
                  {item.is_published ? "Activo" : "Inactivo"}
                </span>
                <TrackRowActions
                  id={item.id}
                  title={item.title}
                  isActive={item.is_published}
                  toggleAction={toggleTrackActive}
                  deleteAction={deleteTrack}
                />
                <Link
                  href={`/admin/elimplay/${item.id}`}
                  className="p-1.5 rounded-lg"
                  style={{ color: "var(--color-text-muted)" }}
                  title="Editar"
                >
                  <Pencil size={13} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
