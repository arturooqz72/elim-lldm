import { createClient, getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ArrowLeft, Layers } from "lucide-react";
import Link from "next/link";
import { AudioUploadForm } from "./AudioUploadForm";
import type { AudioCategory } from "@/types";

export const metadata = { title: "Subir audio — Admin" };

export default async function NuevoAudioPage() {
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
          Subir audio
        </span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          Subir audio
        </h1>
        <Link
          href="/admin/elimplay/nueva/masiva"
          className="flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color: "var(--color-primary)" }}
        >
          <Layers size={14} />
          Subida masiva
        </Link>
      </div>

      <AudioUploadForm categories={categories} />
    </div>
  );
}
