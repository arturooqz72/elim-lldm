import { createClient, createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Radio } from "lucide-react";
import type { Programa } from "@/types";
import { DeleteProgramaForm } from "./DeleteProgramaForm";

export const metadata = { title: "Programas — Admin" };

interface Props {
  searchParams: Promise<{ edit?: string }>;
}

async function addPrograma(formData: FormData) {
  "use server";
  const supabase = await createServiceClient();
  await supabase.from("programas").insert({
    nombre: (formData.get("nombre") as string).trim(),
    descripcion: ((formData.get("descripcion") as string) || "").trim() || null,
    horario_texto: ((formData.get("horario_texto") as string) || "").trim() || null,
  });
  revalidatePath("/admin/programas");
}

async function updatePrograma(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const supabase = await createServiceClient();
  await supabase
    .from("programas")
    .update({
      nombre: (formData.get("nombre") as string).trim(),
      descripcion: ((formData.get("descripcion") as string) || "").trim() || null,
      horario_texto: ((formData.get("horario_texto") as string) || "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/admin/programas");
}

async function toggleActivo(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const activo = formData.get("activo") === "true";
  const supabase = await createServiceClient();
  await supabase.from("programas").update({ activo }).eq("id", id);
  revalidatePath("/admin/programas");
}

async function deletePrograma(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const supabase = await createServiceClient();
  // Si el programa tiene transmisiones (platikas) vinculadas, la FK en
  // modo RESTRICT rechaza el borrado — se ignora el error para no tumbar
  // la página; el programa simplemente sigue en la lista.
  await supabase.from("programas").delete().eq("id", id);
  revalidatePath("/admin/programas");
}

export default async function ProgramasAdminPage({ searchParams }: Props) {
  const { edit: editId } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase.from("programas").select("*").order("nombre", { ascending: true });

  const programas = (data ?? []) as Programa[];
  const editando = editId ? programas.find((p) => p.id === editId) : undefined;

  const inputStyle = {
    background: "var(--color-surface-elevated)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
  } as const;

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Radio size={22} style={{ color: "var(--color-primary)" }} />
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          Programas
        </h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          {programas.length === 0 && (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Aún no hay programas.
            </p>
          )}
          {programas.map((programa) => (
            <div
              key={programa.id}
              className="flex items-center gap-3 p-4 rounded-2xl"
              style={{
                background: "var(--color-surface)",
                border: `1px solid ${editando?.id === programa.id ? "var(--color-primary)" : "var(--color-border)"}`,
                opacity: programa.activo ? 1 : 0.6,
              }}
            >
              <form action={toggleActivo}>
                <input type="hidden" name="id" value={programa.id} />
                <input type="hidden" name="activo" value={(!programa.activo).toString()} />
                <button
                  type="submit"
                  className="w-5 h-5 rounded shrink-0"
                  style={{
                    background: programa.activo ? "var(--color-primary)" : "var(--color-surface-elevated)",
                    border: "1px solid var(--color-border)",
                  }}
                  aria-label={programa.activo ? "Desactivar" : "Activar"}
                />
              </form>

              <div className="flex-1 min-w-0">
                <p className="font-semibold" style={{ color: "var(--color-text)" }}>
                  {programa.nombre}
                </p>
                {programa.horario_texto && (
                  <p className="text-xs" style={{ color: "var(--color-primary)" }}>
                    {programa.horario_texto}
                  </p>
                )}
              </div>

              <Link
                href={`/admin/programas?edit=${programa.id}`}
                className="w-7 h-7 rounded-lg text-xs flex items-center justify-center shrink-0"
                style={{ background: "rgba(212,160,23,0.1)", color: "var(--color-primary)" }}
              >
                ✎
              </Link>
              <Link
                href={`/admin/programas/${programa.id}`}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
                style={{ background: "var(--color-primary)", color: "#000" }}
              >
                Audios
              </Link>
              <DeleteProgramaForm action={deletePrograma} id={programa.id} />
            </div>
          ))}
        </div>

        <div className="lg:sticky lg:top-8">
          <form
            action={editando ? updatePrograma : addPrograma}
            className="flex flex-col gap-4 p-5 rounded-2xl"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <h2
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              {editando ? "Editar programa" : "Nuevo programa"}
            </h2>

            {editando && <input type="hidden" name="id" value={editando.id} />}

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Nombre
              </label>
              <input
                type="text"
                name="nombre"
                required
                defaultValue={editando?.nombre ?? ""}
                placeholder="Ej: Conversando con Fernando"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Descripción
              </label>
              <textarea
                name="descripcion"
                rows={2}
                defaultValue={editando?.descripcion ?? ""}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Horario (solo informativo)
              </label>
              <input
                type="text"
                name="horario_texto"
                defaultValue={editando?.horario_texto ?? ""}
                placeholder="Ej: Martes y jueves 6:00 PM"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </div>

            <div className="flex gap-2 pt-1">
              {editando && (
                <Link
                  href="/admin/programas"
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center"
                  style={{
                    background: "var(--color-surface-elevated)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Cancelar
                </Link>
              )}
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--color-primary)", color: "#000" }}
              >
                {editando ? "Guardar cambios" : "Crear programa"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
