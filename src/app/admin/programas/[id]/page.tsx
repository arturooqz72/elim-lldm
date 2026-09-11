import { createClient, createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { Programa, ProgramaAudio, ProgramaHost } from "@/types";
import { AudioUploadForm } from "./AudioUploadForm";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

async function deleteAudio(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const programaId = formData.get("programa_id") as string;
  const supabase = await createServiceClient();
  await supabase.from("programa_audios").delete().eq("id", id);
  revalidatePath(`/admin/programas/${programaId}`);
}

async function addHost(formData: FormData) {
  "use server";
  const programaId = formData.get("programa_id") as string;
  const nombre = (formData.get("nombre") as string).trim();
  const supabase = await createServiceClient();

  const { data: user } = await supabase
    .from("profiles")
    .select("id")
    .ilike("display_name", nombre)
    .maybeSingle();

  if (!user) redirect(`/admin/programas/${programaId}?error=host_not_found`);

  const { error: insertErr } = await supabase
    .from("programa_hosts")
    .insert({ programa_id: programaId, user_id: (user as { id: string }).id });
  if (insertErr) redirect(`/admin/programas/${programaId}?error=host_save`);

  revalidatePath(`/admin/programas/${programaId}`);
}

async function removeHost(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const programaId = formData.get("programa_id") as string;
  const supabase = await createServiceClient();
  await supabase.from("programa_hosts").delete().eq("id", id);
  revalidatePath(`/admin/programas/${programaId}`);
}

export default async function ProgramaAudiosPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: programaData } = await supabase.from("programas").select("*").eq("id", id).single();
  if (!programaData) notFound();
  const programa = programaData as Programa;

  const { data: audiosData } = await supabase
    .from("programa_audios")
    .select("*")
    .eq("programa_id", id)
    .order("orden", { ascending: true });
  const audios = (audiosData ?? []) as ProgramaAudio[];

  const { data: hostsData } = await supabase
    .from("programa_hosts")
    .select("*, profiles(display_name, avatar_url)")
    .eq("programa_id", id);
  const hosts = (hostsData ?? []) as ProgramaHost[];

  const inputStyle = {
    background: "var(--color-surface-elevated)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
  } as const;

  return (
    <div>
      <Link
        href="/admin/programas"
        className="inline-flex items-center gap-1.5 text-xs mb-4"
        style={{ color: "var(--color-text-muted)" }}
      >
        <ArrowLeft size={14} /> Programas
      </Link>

      <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text)" }}>
        {programa.nombre}
      </h1>
      {programa.horario_texto && (
        <p className="text-sm mb-8" style={{ color: "var(--color-primary)" }}>
          {programa.horario_texto}
        </p>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-6">
          <div>
            <h2
              className="text-sm font-semibold uppercase tracking-wider mb-3"
              style={{ color: "var(--color-text-muted)" }}
            >
              Banco de audios ({audios.length})
            </h2>
            <div className="flex flex-col gap-2">
              {audios.length === 0 && (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Aún no hay audios. Sube el primero a la derecha.
                </p>
              )}
              {audios.map((audio) => (
                <div
                  key={audio.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                >
                  <audio controls src={audio.audio_url} className="h-8 flex-1 min-w-0" />
                  <span className="text-sm font-medium shrink-0" style={{ color: "var(--color-text)" }}>
                    {audio.titulo}
                  </span>
                  <form action={deleteAudio}>
                    <input type="hidden" name="id" value={audio.id} />
                    <input type="hidden" name="programa_id" value={id} />
                    <button type="submit" style={{ color: "var(--color-destructive)" }} aria-label="Borrar">
                      <Trash2 size={16} />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2
              className="text-sm font-semibold uppercase tracking-wider mb-3"
              style={{ color: "var(--color-text-muted)" }}
            >
              Conductor(es) habitual(es)
            </h2>
            <div className="flex flex-col gap-2 mb-3">
              {hosts.map((host) => (
                <div
                  key={host.id}
                  className="flex items-center justify-between p-2.5 rounded-xl text-sm"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                >
                  <span style={{ color: "var(--color-text)" }}>{host.profiles?.display_name}</span>
                  <form action={removeHost}>
                    <input type="hidden" name="id" value={host.id} />
                    <input type="hidden" name="programa_id" value={id} />
                    <button type="submit" style={{ color: "var(--color-destructive)" }} aria-label="Quitar">
                      <Trash2 size={14} />
                    </button>
                  </form>
                </div>
              ))}
              {hosts.length === 0 && (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Sin conductor asignado todavía. Esto es solo informativo — cualquier Super Moderador puede
                  operar este programa.
                </p>
              )}
            </div>
            {error === "host_not_found" && (
              <p className="text-xs mb-2" style={{ color: "var(--color-destructive)" }}>
                No se encontró ningún usuario con ese nombre exacto. Revisa mayúsculas, espacios y que la
                persona ya se haya registrado en el sitio con ese nombre.
              </p>
            )}
            {error === "host_save" && (
              <p className="text-xs mb-2" style={{ color: "var(--color-destructive)" }}>
                Ese usuario ya es conductor de este programa, o hubo un error al guardar.
              </p>
            )}
            <form action={addHost} className="flex gap-2">
              <input type="hidden" name="programa_id" value={id} />
              <input
                type="text"
                name="nombre"
                required
                placeholder="Nombre exacto del usuario (display_name)"
                className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                style={inputStyle}
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "var(--color-primary)", color: "#000" }}
              >
                Agregar
              </button>
            </form>
          </div>
        </div>

        <div className="lg:sticky lg:top-8">
          <AudioUploadForm programaId={id} nextOrden={audios.length} />
        </div>
      </div>
    </div>
  );
}
