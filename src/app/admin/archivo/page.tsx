import { createClient } from "@/lib/supabase/server";
import { Plus, Archive, Eye, EyeOff, Pencil } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Archivo — Admin" };

export default async function AdminArchivoPage() {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("archive")
    .select("id, title, is_published, view_count, created_at, categories(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>
          Archivo
        </h1>
        <Link
          href="/admin/archivo/nueva"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "var(--color-primary)", color: "#000" }}
        >
          <Plus size={16} />
          Subir grabación
        </Link>
      </div>

      {(!items || items.length === 0) ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Archive size={36} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p style={{ color: "var(--color-text-muted)" }}>
            No hay grabaciones. Sube la primera.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {(items as unknown as Array<{
            id: string;
            title: string;
            is_published: boolean;
            view_count: number;
            created_at: string;
            categories: { name: string } | null;
          }>).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-5 py-4 rounded-2xl"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                {item.is_published ? (
                  <Eye size={15} style={{ color: "var(--color-success)" }} />
                ) : (
                  <EyeOff size={15} style={{ color: "var(--color-text-muted)" }} />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                    {item.title}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {(item.categories as { name: string } | null)?.name ?? "Sin categoría"} ·{" "}
                    {item.view_count} vistas · {formatDate(item.created_at).split(",")[0]}
                  </p>
                </div>
              </div>
              <div className="ml-3 flex items-center gap-2 shrink-0">
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    background: item.is_published ? "rgba(74,222,128,0.1)" : "var(--color-surface-elevated)",
                    color: item.is_published ? "var(--color-success)" : "var(--color-text-muted)",
                  }}
                >
                  {item.is_published ? "Publicado" : "Borrador"}
                </span>
                <Link
                  href={`/admin/archivo/${item.id}`}
                  className="p-1.5 rounded-lg"
                  style={{ color: "var(--color-text-muted)" }}
                  title="Editar"
                >
                  <Pencil size={13} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
