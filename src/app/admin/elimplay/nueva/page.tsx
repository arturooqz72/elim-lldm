import { createClient, getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AudioUploadForm } from "./AudioUploadForm";
import type { Artist, AudioCategory } from "@/types";

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

  const { data: artistsData } = await supabase
    .from("artists")
    .select("id, name, photo_url")
    .order("name", { ascending: true });

  const artists = (artistsData ?? []) as Pick<Artist, "id" | "name" | "photo_url">[];

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

      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--color-text)" }}>
        Subir audio
      </h1>

      <AudioUploadForm categories={categories} artists={artists} />
    </div>
  );
}
