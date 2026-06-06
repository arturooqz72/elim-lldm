import { createClient, createServiceClient, getProfile } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Editar grabación — Admin" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditArchivePage({ params }: Props) {
  const { id } = await params;

  const profile = await getProfile();
  if (!profile || (profile as { role: string }).role !== "admin") redirect("/");

  const supabase = await createClient();

  const [{ data: item }, { data: cats }] = await Promise.all([
    supabase
      .from("archive")
      .select("id, title, description, recording_url, thumbnail_url, category_id, tags, is_published, published_at")
      .eq("id", id)
      .single(),
    supabase.from("categories").select("id, name").order("order_index", { ascending: true }),
  ]);

  if (!item) notFound();

  const a = item as unknown as {
    id: string;
    title: string;
    description: string | null;
    recording_url: string;
    thumbnail_url: string | null;
    category_id: string | null;
    tags: string[];
    is_published: boolean;
    published_at: string | null;
  };

  const categories = (cats ?? []) as Array<{ id: string; name: string }>;

  async function handleUpdate(formData: FormData) {
    "use server";
    const service = await createServiceClient();
    const isPublished = formData.get("is_published") === "on";
    const tags = ((formData.get("tags") as string) ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    await service
      .from("archive")
      .update({
        title: (formData.get("title") as string).trim(),
        description: ((formData.get("description") as string).trim()) || null,
        category_id: (formData.get("category_id") as string) || null,
        tags,
        is_published: isPublished,
        published_at: isPublished ? new Date().toISOString() : null,
      })
      .eq("id", id);

    revalidatePath("/admin/archivo");
    redirect("/admin/archivo");
  }

  async function handleDelete() {
    "use server";
    const service = await createServiceClient();
    await service.from("archive").delete().eq("id", id);
    redirect("/admin/archivo");
  }

  const inputStyle = {
    background: "var(--color-surface-elevated)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
  } as const;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/admin/archivo"
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ArrowLeft size={14} />
          Archivo
        </Link>
        <span style={{ color: "var(--color-border)" }}>/</span>
        <span className="text-sm truncate" style={{ color: "var(--color-text)" }}>
          {a.title}
        </span>
      </div>

      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--color-text)" }}>
        Editar grabación
      </h1>

      {/* Thumbnail preview */}
      {a.thumbnail_url && (
        <div className="mb-6">
          <img
            src={a.thumbnail_url}
            alt={a.title}
            className="w-full rounded-xl object-cover"
            style={{ maxHeight: "180px" }}
          />
        </div>
      )}

      {/* Edit form */}
      <form action={handleUpdate} className="flex flex-col gap-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            Título <span style={{ color: "var(--color-live)" }}>*</span>
          </label>
          <input
            type="text"
            name="title"
            required
            maxLength={120}
            defaultValue={a.title}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={inputStyle}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            Descripción
          </label>
          <textarea
            name="description"
            rows={4}
            maxLength={1000}
            defaultValue={a.description ?? ""}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
            style={inputStyle}
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            Categoría
          </label>
          <select
            name="category_id"
            defaultValue={a.category_id ?? ""}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={inputStyle}
          >
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            Etiquetas
          </label>
          <input
            type="text"
            name="tags"
            defaultValue={a.tags.join(", ")}
            placeholder="doctrina, 2026, culto (separadas por coma)"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={inputStyle}
          />
        </div>

        {/* Published toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              name="is_published"
              defaultChecked={a.is_published}
              className="peer sr-only"
            />
            <div
              className="w-10 h-5 rounded-full transition-colors peer-checked:bg-[#D4A017]"
              style={{ background: "var(--color-border)" }}
            />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
          </div>
          <span className="text-sm" style={{ color: "var(--color-text)" }}>
            Publicado
          </span>
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            Guardar cambios
          </button>
          <Link
            href="/admin/archivo"
            className="px-5 py-3 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            Cancelar
          </Link>
        </div>
      </form>

      {/* Danger zone */}
      <div
        className="mt-10 p-5 rounded-2xl"
        style={{ border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.04)" }}
      >
        <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--color-destructive)" }}>
          Zona de peligro
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          Eliminar la grabación es irreversible. El archivo de video en Storage no se elimina automáticamente.
        </p>
        <form action={handleDelete}>
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              background: "rgba(248,113,113,0.12)",
              border: "1px solid rgba(248,113,113,0.3)",
              color: "var(--color-destructive)",
            }}
          >
            <Trash2 size={14} />
            Eliminar grabación
          </button>
        </form>
      </div>
    </div>
  );
}
