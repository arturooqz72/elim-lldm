import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Nueva plática — Admin" };

async function createPlatika(formData: FormData) {
  "use server";
  const supabase = await createServiceClient();

  const title = (formData.get("title") as string).trim();
  const description = (formData.get("description") as string).trim() || null;
  const host_id = formData.get("host_id") as string;
  const scheduled_at = formData.get("scheduled_at") as string;

  const { data, error } = await supabase
    .from("platikas")
    .insert({
      title,
      description,
      host_id,
      status: "scheduled",
      scheduled_at: scheduled_at ? new Date(scheduled_at).toISOString() : null,
    })
    .select("id")
    .single();

  if (error || !data) return;
  redirect(`/admin/platikas/${(data as { id: string }).id}`);
}

export default async function NuevaPlatikaPage() {
  const supabase = await createClient();

  // Get potential hosts (anfitrion + admin, verified LLDM)
  const { data: hosts } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("role", ["admin", "anfitrion"])
    .order("display_name");

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/admin/platikas"
          className="flex items-center gap-1.5 text-sm"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ArrowLeft size={15} />
          Pláticas
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--color-text)" }}>
        Nueva plática
      </h1>

      <form action={createPlatika} className="flex flex-col gap-5">
        <Field label="Título" required>
          <input
            type="text"
            name="title"
            required
            maxLength={120}
            placeholder="Ej: Plática de doctrina — Libro de Apocalipsis"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </Field>

        <Field label="Descripción">
          <textarea
            name="description"
            rows={3}
            maxLength={500}
            placeholder="Descripción breve (opcional)"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </Field>

        <Field label="Anfitrión" required>
          <select
            name="host_id"
            required
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <option value="">Seleccionar anfitrión...</option>
            {(hosts ?? []).map((h: { id: string; display_name: string }) => (
              <option key={h.id} value={h.id}>
                {h.display_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Fecha y hora programada">
          <input
            type="datetime-local"
            name="scheduled_at"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </Field>

        <div className="flex gap-3 pt-2">
          <Link
            href="/admin/platikas"
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-center"
            style={{
              background: "var(--color-surface-elevated)",
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
            }}
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            Crear plática
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
        {label}
        {required && <span style={{ color: "var(--color-live)" }}> *</span>}
      </label>
      {children}
    </div>
  );
}
