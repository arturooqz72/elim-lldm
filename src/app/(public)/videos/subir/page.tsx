import { createClient, getProfile } from "@/lib/supabase/server";
import { VideoUploadForm } from "@/components/videos/VideoUploadForm";
import { LogIn, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { VideoCategory, Profile } from "@/types";

export const metadata = { title: "Subir video — Elim LLDM" };

export default async function SubirVideoPage() {
  const profile = (await getProfile()) as Profile | null;

  if (!profile) {
    return (
      <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
        <div className="max-w-md mx-auto px-4 py-20 flex flex-col items-center text-center gap-4">
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
            Inicia sesión para subir un video
          </h1>
          <p style={{ color: "var(--color-text-muted)" }}>
            Necesitas una cuenta para compartir tus videos. Una vez subido, quedará pendiente de
            revisión por un administrador antes de publicarse.
          </p>
          <Link
            href="/login?returnUrl=/videos/subir"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
            style={{ background: "var(--color-primary)", color: "#000" }}
          >
            <LogIn size={15} />
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: cats } = await supabase
    .from("video_categories")
    .select("id, name")
    .order("order_index", { ascending: true });

  const categories = (cats ?? []) as Pick<VideoCategory, "id" | "name">[];

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link
          href="/videos"
          className="inline-flex items-center gap-2 text-sm mb-6 transition-opacity hover:opacity-80"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ArrowLeft size={14} />
          Volver a Videos
        </Link>

        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
          Subir video
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
          Tu video quedará pendiente de aprobación por un administrador antes de publicarse en{" "}
          <strong>Videos</strong>.
        </p>

        <VideoUploadForm categories={categories} />
      </div>
    </div>
  );
}
