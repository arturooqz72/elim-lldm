import { createClient, createServiceClient, getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, Plus, Folder, Trash2 } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Categorías de video — Admin" };

async function createCategory(formData: FormData) {
  "use server";
  const name = (formData.get("name") as string).trim();
  const slug = (formData.get("slug") as string).trim();
  if (!name || !slug) return;

  const service = await createServiceClient();
  const description = (formData.get("description") as string).trim() || null;
  const icon = (formData.get("icon") as string).trim() || null;
  const order_index = parseInt((formData.get("order_index") as string) || "0") || 0;

  await service.from("video_categories").insert({ name, slug, description, icon, order_index });
  revalidatePath("/admin/videos/categorias");
}

async function deleteCategory(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  if (!id) return;
  const service = await createServiceClient();
  await service.from("video_categories").delete().eq("id", id);
  revalidatePath("/admin/videos/categorias");
}

export default async function AdminVideoCategoriasPage() {
  const profile = await getProfile();
  if (!profile || (profile as { role: string }).role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data: cats } = await supabase
    .from("video_categories")
    .select("id, name, slug, description, icon, order_index")
    .order("order_index", { ascending: true });

  const categories = (cats ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    order_index: number;
  }>;

  const inputStyle = {
    background: "var(--color-surface-elevated)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
  } as const;

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Link
          href="/admin/videos"
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ArrowLeft size={14} />
          Videos
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>
          Categorías de Videos
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Organiza los videos por categoría: predicaciones, pláticas, cantos, testimonios, etc.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Existing categories */}
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
            Categorías existentes
          </h2>

          {categories.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-10 rounded-2xl"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <Folder size={28} className="mb-2" style={{ color: "var(--color-text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                No hay categorías aún
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {cat.icon && (
                        <span className="text-sm" style={{ color: "var(--color-primary)" }}>
                          {cat.icon}
                        </span>
                      )}
                      <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                        {cat.name}
                      </p>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                      /{cat.slug}
                      {cat.description ? ` · ${cat.description}` : ""}
                    </p>
                  </div>

                  <form action={deleteCategory}>
                    <input type="hidden" name="id" value={cat.id} />
                    <button
                      type="submit"
                      className="ml-3 p-1.5 rounded-lg transition-colors shrink-0"
                      style={{ color: "var(--color-text-muted)" }}
                      title="Eliminar categoría"
                    >
                      <Trash2 size={14} />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create form */}
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
            Nueva categoría
          </h2>

          <form
            action={createCategory}
            className="flex flex-col gap-4 p-5 rounded-2xl"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Nombre <span style={{ color: "var(--color-live)" }}>*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                maxLength={60}
                placeholder="Predicaciones"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Slug <span style={{ color: "var(--color-live)" }}>*</span>
              </label>
              <input
                type="text"
                name="slug"
                required
                maxLength={60}
                placeholder="predicaciones"
                pattern="[a-z0-9\-]+"
                title="Solo letras minúsculas, números y guiones"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Descripción
              </label>
              <input
                type="text"
                name="description"
                maxLength={120}
                placeholder="Descripción breve (opcional)"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                  Ícono (emoji)
                </label>
                <input
                  type="text"
                  name="icon"
                  maxLength={4}
                  placeholder="🎙️"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                  Orden
                </label>
                <input
                  type="number"
                  name="order_index"
                  min={0}
                  defaultValue={categories.length}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={inputStyle}
                />
              </div>
            </div>

            <button
              type="submit"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold mt-1"
              style={{ background: "var(--color-primary)", color: "#000" }}
            >
              <Plus size={15} />
              Crear categoría
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
