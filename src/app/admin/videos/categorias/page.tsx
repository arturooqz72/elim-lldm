import { createClient, createServiceClient, getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, Plus, Folder } from "lucide-react";
import Link from "next/link";
import { adminId, crearCategoria } from "@/lib/videos/categorias.server";
import { CategoriaFila, type CategoriaVideo } from "./CategoriaFila";

export const metadata = { title: "Categorías de video — Admin" };

function camposCategoria(formData: FormData) {
  return {
    name: ((formData.get("name") as string) ?? "").trim().slice(0, 60),
    description: ((formData.get("description") as string) ?? "").trim() || null,
    icon: ((formData.get("icon") as string) ?? "").trim() || null,
    order_index: parseInt((formData.get("order_index") as string) || "0") || 0,
  };
}

function refrescar() {
  revalidatePath("/admin/videos/categorias");
  revalidatePath("/admin/videos");
  revalidatePath("/videos");
}

async function createCategory(formData: FormData) {
  "use server";
  if (!(await adminId())) return;
  const campos = camposCategoria(formData);
  if (!campos.name) return;

  const service = await createServiceClient();
  await crearCategoria(service, campos);
  refrescar();
}

async function updateCategory(formData: FormData) {
  "use server";
  if (!(await adminId())) return;
  const id = formData.get("id") as string;
  const campos = camposCategoria(formData);
  if (!id || !campos.name) return;

  // El slug no se toca: es el enlace /videos?categoria=… ya compartido.
  const service = await createServiceClient();
  const { error } = await service.from("video_categories").update(campos).eq("id", id);
  if (error) throw new Error(error.message);
  refrescar();
}

async function deleteCategory(formData: FormData) {
  "use server";
  if (!(await adminId())) return;
  const id = formData.get("id") as string;
  if (!id) return;

  // Los videos no se borran: quedan "Sin categoría" (si no, la llave
  // foránea impide borrar la categoría).
  const service = await createServiceClient();
  const { error: videosError } = await service.from("videos").update({ category_id: null }).eq("category_id", id);
  if (videosError) throw new Error(videosError.message);
  const { error } = await service.from("video_categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refrescar();
}

export default async function AdminVideoCategoriasPage() {
  const profile = await getProfile();
  if (!profile || (profile as { role: string }).role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data: cats } = await supabase
    .from("video_categories")
    .select("id, name, slug, description, icon, order_index")
    .order("order_index", { ascending: true });

  const categories = (cats ?? []) as CategoriaVideo[];

  // Con service: el conteo incluye pendientes y rechazados (la página ya es solo admin).
  const service = await createServiceClient();
  const { data: usados } = await service.from("videos").select("category_id").not("category_id", "is", null);
  const videosPorCategoria = new Map<string, number>();
  for (const v of (usados ?? []) as Array<{ category_id: string }>) {
    videosPorCategoria.set(v.category_id, (videosPorCategoria.get(v.category_id) ?? 0) + 1);
  }

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
                <CategoriaFila
                  key={cat.id}
                  categoria={cat}
                  videos={videosPorCategoria.get(cat.id) ?? 0}
                  updateAction={updateCategory}
                  deleteAction={deleteCategory}
                />
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
