import { createClient, createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Puzzle } from "lucide-react";
import type { AhorcadoCategoria, AhorcadoPalabra } from "@/types";
import { AhorcadoActivoToggle } from "@/components/admin/AhorcadoActivoToggle";

export const metadata = { title: "Ahorcado del Nuevo Testamento — Admin" };

interface Props {
  searchParams: Promise<{ edit?: string }>;
}

const CATEGORIAS: { value: AhorcadoCategoria; label: string }[] = [
  { value: "personaje", label: "Personaje" },
  { value: "lugar", label: "Lugar" },
  { value: "concepto", label: "Concepto" },
  { value: "libro", label: "Libro" },
];

async function addPalabra(formData: FormData) {
  "use server";
  const supabase = await createServiceClient();
  await supabase.from("ahorcado_palabras").insert({
    palabra: (formData.get("palabra") as string).trim().toUpperCase(),
    categoria: formData.get("categoria") as string,
    pista: (formData.get("pista") as string).trim(),
    referencia_biblica: ((formData.get("referencia_biblica") as string) || "").trim() || null,
  });
  revalidatePath("/admin/ahorcado");
}

async function updatePalabra(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const supabase = await createServiceClient();
  await supabase
    .from("ahorcado_palabras")
    .update({
      palabra: (formData.get("palabra") as string).trim().toUpperCase(),
      categoria: formData.get("categoria") as string,
      pista: (formData.get("pista") as string).trim(),
      referencia_biblica: ((formData.get("referencia_biblica") as string) || "").trim() || null,
    })
    .eq("id", id);
  revalidatePath("/admin/ahorcado");
}

async function toggleActivo(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const activo = formData.get("activo") === "true";
  const supabase = await createServiceClient();
  await supabase.from("ahorcado_palabras").update({ activo }).eq("id", id);
  revalidatePath("/admin/ahorcado");
}

export default async function AhorcadoAdminPage({ searchParams }: Props) {
  const { edit: editId } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("ahorcado_palabras")
    .select("id, palabra, categoria, pista, referencia_biblica, activo, created_at")
    .order("categoria", { ascending: true })
    .order("palabra", { ascending: true });

  const palabras = (data ?? []) as AhorcadoPalabra[];
  const editando = editId ? palabras.find((p) => p.id === editId) : undefined;

  const inputStyle = {
    background: "var(--color-surface-elevated)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
  } as const;

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Puzzle size={22} style={{ color: "var(--color-primary)" }} />
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          Ahorcado del Nuevo Testamento
        </h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            Banco de palabras ({palabras.length})
          </h2>

          {palabras.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: "var(--color-surface)",
                border: `1px solid ${editId === p.id ? "rgba(212,160,23,0.4)" : "var(--color-border)"}`,
                opacity: p.activo ? 1 : 0.55,
              }}
            >
              <form action={toggleActivo}>
                <input type="hidden" name="id" value={p.id} />
                <AhorcadoActivoToggle defaultChecked={p.activo} />
              </form>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
                  {p.palabra}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                  {CATEGORIAS.find((c) => c.value === p.categoria)?.label} · {p.pista}
                </p>
              </div>

              <a
                href={`/admin/ahorcado?edit=${p.id}`}
                className="w-7 h-7 rounded-lg text-xs flex items-center justify-center shrink-0"
                style={{ background: "rgba(212,160,23,0.1)", color: "var(--color-primary)" }}
              >
                ✎
              </a>
            </div>
          ))}
        </div>

        <div className="lg:sticky lg:top-8">
          <form
            action={editando ? updatePalabra : addPalabra}
            className="flex flex-col gap-4 p-5 rounded-2xl"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <h2
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              {editando ? "Editar palabra" : "Agregar palabra"}
            </h2>

            {editando && <input type="hidden" name="id" value={editando.id} />}

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Palabra
              </label>
              <input
                type="text"
                name="palabra"
                required
                pattern="[A-Za-zÑñ ]+"
                title="Solo letras y espacios, sin acentos"
                defaultValue={editando?.palabra ?? ""}
                placeholder="Ej: GALILEA"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none uppercase"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Categoría
              </label>
              <select
                name="categoria"
                required
                defaultValue={editando?.categoria ?? "personaje"}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Pista
              </label>
              <textarea
                name="pista"
                required
                rows={2}
                maxLength={200}
                defaultValue={editando?.pista ?? ""}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Referencia bíblica
              </label>
              <input
                type="text"
                name="referencia_biblica"
                maxLength={60}
                defaultValue={editando?.referencia_biblica ?? ""}
                placeholder="Ej: Juan 3:16"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </div>

            <div className="flex gap-2 pt-1">
              {editando && (
                <a
                  href="/admin/ahorcado"
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center"
                  style={{
                    background: "var(--color-surface-elevated)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Cancelar
                </a>
              )}
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--color-primary)", color: "#000" }}
              >
                {editando ? "Guardar cambios" : "Agregar palabra"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
