import { createClient, getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { BulkAudioUploadForm } from "@/components/elimplay/BulkAudioUploadForm";
import type { AudioCategory } from "@/types";

export const metadata = { title: "Subida masiva — Admin" };

export default async function SubidaMasivaPage() {
  const profile = await getProfile();
  if (!profile || (profile as { role: string }).role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data: cats } = await supabase
    .from("audio_categories")
    .select("id, name")
    .order("order_index", { ascending: true });

  const categories = (cats ?? []) as Pick<AudioCategory, "id" | "name">[];

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/admin/elimplay"
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ArrowLeft size={14} />
          ElimPlay
        </Link>
        <span style={{ color: "var(--color-border)" }}>/</span>
        <span className="text-sm" style={{ color: "var(--color-text)" }}>
          Subida masiva
        </span>
      </div>

      <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text)" }}>
        Subida masiva
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        Selecciona varios archivos de audio. El título de cada uno se genera a partir del nombre del archivo, pero puedes editarlo antes de subir. La categoría, artista y etiquetas se aplican a todos.
      </p>

      <BulkAudioUploadForm categories={categories} />
    </div>
  );
}
