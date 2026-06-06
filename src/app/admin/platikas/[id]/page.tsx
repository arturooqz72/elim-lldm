import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { DeleteForm } from "./DeleteForm";

interface Props {
  params: Promise<{ id: string }>;
}

async function updatePlatika(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const supabase = await createServiceClient();
  await supabase
    .from("platikas")
    .update({
      title: (formData.get("title") as string).trim(),
      description: (formData.get("description") as string).trim() || null,
      scheduled_at: formData.get("scheduled_at")
        ? new Date(formData.get("scheduled_at") as string).toISOString()
        : null,
    })
    .eq("id", id);
  revalidatePath(`/admin/platikas/${id}`);
}

async function deletePlatika(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const supabase = await createServiceClient();
  await supabase.from("platikas").delete().eq("id", id);
  redirect("/admin/platikas");
}

export default async function EditPlatikaPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: platica } = await supabase
    .from("platikas")
    .select("*, profiles(display_name)")
    .eq("id", id)
    .single();

  if (!platica) notFound();

  const p = platica as unknown as {
    id: string;
    title: string;
    description: string | null;
    status: string;
    scheduled_at: string | null;
    started_at: string | null;
    ended_at: string | null;
    radio_output_active: boolean;
    livekit_room_name: string | null;
    profiles: { display_name: string } | null;
  };

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/admin/platikas"
          className="flex items-center gap-1.5 text-sm"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ArrowLeft size={15} />
          Pláticas
        </Link>
        <Link
          href={`/platikas/${id}`}
          target="_blank"
          className="flex items-center gap-1.5 text-sm"
          style={{ color: "var(--color-primary)" }}
        >
          Ver pública
          <ExternalLink size={13} />
        </Link>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          Editar plática
        </h1>
        <span
          className="px-2 py-0.5 rounded-full text-xs font-bold"
          style={{
            background:
              p.status === "live"
                ? "rgba(255,68,68,0.15)"
                : p.status === "scheduled"
                ? "rgba(212,160,23,0.1)"
                : "var(--color-surface-elevated)",
            color:
              p.status === "live"
                ? "var(--color-live)"
                : p.status === "scheduled"
                ? "var(--color-primary)"
                : "var(--color-text-muted)",
          }}
        >
          {p.status === "live" ? "EN VIVO" : p.status === "scheduled" ? "PROGRAMADA" : "TERMINADA"}
        </span>
      </div>

      {/* Meta */}
      <div
        className="rounded-xl px-4 py-3 mb-6 text-sm flex flex-col gap-1"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <p style={{ color: "var(--color-text-muted)" }}>
          Anfitrión:{" "}
          <span style={{ color: "var(--color-text)" }}>
            {p.profiles?.display_name ?? "—"}
          </span>
        </p>
        {p.started_at && (
          <p style={{ color: "var(--color-text-muted)" }}>
            Iniciada: <span style={{ color: "var(--color-text)" }}>{formatDate(p.started_at)}</span>
          </p>
        )}
        {p.ended_at && (
          <p style={{ color: "var(--color-text-muted)" }}>
            Terminada: <span style={{ color: "var(--color-text)" }}>{formatDate(p.ended_at)}</span>
          </p>
        )}
      </div>

      {/* Edit form */}
      <form action={updatePlatika} className="flex flex-col gap-5">
        <input type="hidden" name="id" value={id} />

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            Título
          </label>
          <input
            type="text"
            name="title"
            defaultValue={p.title}
            required
            maxLength={120}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            Descripción
          </label>
          <textarea
            name="description"
            defaultValue={p.description ?? ""}
            rows={3}
            maxLength={500}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>

        {p.status === "scheduled" && (
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
              Fecha programada
            </label>
            <input
              type="datetime-local"
              name="scheduled_at"
              defaultValue={
                p.scheduled_at
                  ? new Date(p.scheduled_at).toISOString().slice(0, 16)
                  : ""
              }
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
          </div>
        )}

        <button
          type="submit"
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: "var(--color-primary)", color: "#000" }}
        >
          Guardar cambios
        </button>
      </form>

      {/* Danger zone */}
      {p.status !== "live" && (
        <div
          className="mt-8 rounded-2xl p-5"
          style={{
            border: "1px solid rgba(248,113,113,0.2)",
            background: "rgba(248,113,113,0.04)",
          }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-destructive)" }}>
            Zona de peligro
          </p>
          <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
            Eliminar esta plática es irreversible.
          </p>
          <DeleteForm action={deletePlatika} id={id} />
        </div>
      )}
    </div>
  );
}
