import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ArchiveUploadForm } from "./ArchiveUploadForm";

export const metadata = { title: "Subir grabación — Admin" };

export default async function NuevaGrabacionPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: platikas }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name")
      .order("order_index"),
    supabase
      .from("platikas")
      .select("id, title")
      .eq("status", "ended")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/admin/archivo"
          className="flex items-center gap-1.5 text-sm"
          style={{ color: "var(--color-text-muted)" }}
        >
          <ArrowLeft size={15} />
          Archivo
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--color-text)" }}>
        Subir grabación
      </h1>

      <ArchiveUploadForm
        categories={(categories ?? []) as Array<{ id: string; name: string }>}
        platikas={(platikas ?? []) as Array<{ id: string; title: string }>}
      />
    </div>
  );
}
