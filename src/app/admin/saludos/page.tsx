import { createServiceClient, getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Mic, Download } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Profile, Saludo } from "@/types";

export const metadata = { title: "Saludos — Admin" };

const SIGNED_URL_TTL_SECONDS = 3600;

export default async function AdminSaludosPage() {
  const profile = (await getProfile()) as Profile | null;
  if (!profile || profile.role !== "admin") redirect("/");

  const service = await createServiceClient();
  const { data: saludos } = await service
    .from("saludos")
    .select("id, nombre, audio_path, duration_seconds, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const items = (saludos ?? []) as Saludo[];

  const withUrls = await Promise.all(
    items.map(async (item) => {
      const { data } = await service.storage
        .from("saludos")
        .createSignedUrl(item.audio_path, SIGNED_URL_TTL_SECONDS);
      return { ...item, signedUrl: data?.signedUrl ?? null };
    })
  );

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8" style={{ color: "var(--color-text)" }}>
        Saludos
      </h1>

      {withUrls.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Mic size={36} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p style={{ color: "var(--color-text-muted)" }}>Todavía no hay saludos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {withUrls.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 rounded-2xl"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div className="min-w-0 sm:w-48 shrink-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                  {item.nombre}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {formatDate(item.created_at).split(",")[0]} · {item.duration_seconds}s
                </p>
              </div>

              {item.signedUrl ? (
                <>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={item.signedUrl} className="flex-1 min-w-0 h-9" />
                  <a
                    href={item.signedUrl}
                    download={`saludo-${item.nombre}.${item.audio_path.split(".").pop()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0"
                    style={{ background: "var(--color-primary)", color: "#000" }}
                  >
                    <Download size={13} />
                    Descargar
                  </a>
                </>
              ) : (
                <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
                  No se pudo generar el link de audio.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
