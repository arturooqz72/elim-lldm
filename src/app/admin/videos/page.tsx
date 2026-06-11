import { createClient, createServiceClient, getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Video as VideoIcon, Folder } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { VideoRowActions } from "./VideoRowActions";
import type { VideoStatus } from "@/types";

export const metadata = { title: "Videos — Admin" };

async function approveVideo(formData: FormData) {
  "use server";
  const profile = await getProfile();
  if (!profile || (profile as { role: string }).role !== "admin") return;

  const id = formData.get("id") as string;
  const category_id = (formData.get("category_id") as string) || null;

  const service = await createServiceClient();
  const { error } = await service
    .from("videos")
    .update({
      category_id,
      status: "approved",
      published_at: new Date().toISOString(),
      reviewed_by: (profile as { id: string }).id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/videos");
}

async function rejectVideo(formData: FormData) {
  "use server";
  const profile = await getProfile();
  if (!profile || (profile as { role: string }).role !== "admin") return;

  const id = formData.get("id") as string;
  const rejection_reason = (formData.get("rejection_reason") as string)?.trim() || null;

  const service = await createServiceClient();
  const { error } = await service
    .from("videos")
    .update({
      status: "rejected",
      rejection_reason,
      published_at: null,
      reviewed_by: (profile as { id: string }).id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/videos");
}

async function deleteVideo(formData: FormData) {
  "use server";
  const profile = await getProfile();
  if (!profile || (profile as { role: string }).role !== "admin") return;

  const id = formData.get("id") as string;
  const service = await createServiceClient();
  const { error } = await service.from("videos").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/videos");
}

const TABS: Array<{ key: VideoStatus | "all"; label: string }> = [
  { key: "pending", label: "Pendientes" },
  { key: "approved", label: "Aprobados" },
  { key: "rejected", label: "Rechazados" },
  { key: "all", label: "Todos" },
];

const STATUS_LABEL: Record<VideoStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "Pendiente", color: "var(--color-primary)", bg: "rgba(212,160,23,0.1)" },
  approved: { label: "Aprobado", color: "var(--color-success)", bg: "rgba(74,222,128,0.1)" },
  rejected: { label: "Rechazado", color: "var(--color-destructive)", bg: "rgba(248,113,113,0.1)" },
};

export default async function AdminVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const profile = await getProfile();
  if (!profile || (profile as { role: string }).role !== "admin") redirect("/");

  const { status } = await searchParams;
  const filter: VideoStatus | "all" =
    status === "approved" || status === "rejected" || status === "all" ? status : "pending";

  const supabase = await createClient();

  const { data: cats } = await supabase
    .from("video_categories")
    .select("id, name")
    .order("order_index", { ascending: true });
  const categories = (cats ?? []) as Array<{ id: string; name: string }>;

  let query = supabase
    .from("videos")
    .select(
      "id, title, status, category_id, rejection_reason, created_at, video_categories(name), profiles!videos_created_by_fkey(display_name)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (filter !== "all") query = query.eq("status", filter);

  const { data: items } = await query;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>
          Videos
        </h1>
        <Link
          href="/admin/videos/categorias"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        >
          <Folder size={16} />
          Categorías
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/videos?status=${tab.key}`}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: filter === tab.key ? "var(--color-primary)" : "var(--color-surface)",
              color: filter === tab.key ? "#000" : "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
            }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {!items || items.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <VideoIcon size={36} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p style={{ color: "var(--color-text-muted)" }}>No hay videos en esta categoría.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {(
            items as unknown as Array<{
              id: string;
              title: string;
              status: VideoStatus;
              category_id: string | null;
              rejection_reason: string | null;
              created_at: string;
              video_categories: { name: string } | null;
              profiles: { display_name: string } | null;
            }>
          ).map((item) => {
            const statusInfo = STATUS_LABEL[item.status];
            return (
              <div
                key={item.id}
                className="flex flex-col gap-3 px-5 py-4 rounded-2xl"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/videos/${item.id}`}
                        target="_blank"
                        className="text-sm font-semibold truncate hover:underline"
                        style={{ color: "var(--color-text)" }}
                      >
                        {item.title}
                      </Link>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
                        style={{ background: statusInfo.bg, color: statusInfo.color }}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                      {item.profiles?.display_name ?? "Usuario"} ·{" "}
                      {item.video_categories?.name ?? "Sin categoría"} ·{" "}
                      {formatDate(item.created_at).split(",")[0]}
                    </p>
                    {item.status === "rejected" && item.rejection_reason && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-destructive)" }}>
                        Motivo: {item.rejection_reason}
                      </p>
                    )}
                  </div>
                </div>

                <VideoRowActions
                  id={item.id}
                  title={item.title}
                  status={item.status}
                  categoryId={item.category_id}
                  categories={categories}
                  approveAction={approveVideo}
                  rejectAction={rejectVideo}
                  deleteAction={deleteVideo}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
