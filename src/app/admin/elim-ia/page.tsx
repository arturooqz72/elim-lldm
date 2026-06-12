import { createClient, createServiceClient, getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Bot, FileText, Trash2, Upload } from "lucide-react";
import { extractTextFromDocument, isSupportedDocumentType } from "@/lib/elim-ia/documents";
import { formatDate } from "@/lib/utils";
import type { ElimIADocument, Profile } from "@/types";

export const metadata = { title: "Elim IA — Admin" };

async function handleUpload(formData: FormData) {
  "use server";
  const profile = (await getProfile()) as Profile | null;
  if (!profile || profile.role !== "admin") redirect("/");

  const file = formData.get("file") as File | null;
  const title = ((formData.get("title") as string) ?? "").trim();

  if (!file || file.size === 0 || !title) return;
  if (!isSupportedDocumentType(file.name, file.type)) return;

  const buffer = Buffer.from(await file.arrayBuffer());
  const content = await extractTextFromDocument(buffer, file.name, file.type);

  const service = await createServiceClient();
  const filePath = `documents/${Date.now()}-${file.name}`;

  await service.storage
    .from("elim-ia-documents")
    .upload(filePath, buffer, { contentType: file.type || "application/octet-stream" });

  await service.from("elim_ia_documents").insert({
    title,
    file_name: file.name,
    file_url: filePath,
    file_type: file.type || "unknown",
    content,
    created_by: profile.id,
  });

  revalidatePath("/admin/elim-ia");
}

async function handleDelete(formData: FormData) {
  "use server";
  const profile = (await getProfile()) as Profile | null;
  if (!profile || profile.role !== "admin") redirect("/");

  const id = formData.get("id") as string;
  const filePath = formData.get("file_url") as string;

  const service = await createServiceClient();
  await service.storage.from("elim-ia-documents").remove([filePath]);
  await service.from("elim_ia_documents").delete().eq("id", id);

  revalidatePath("/admin/elim-ia");
}

export default async function AdminElimIaPage() {
  const profile = (await getProfile()) as Profile | null;
  if (!profile || profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data } = await supabase
    .from("elim_ia_documents")
    .select("id, title, file_name, file_url, file_type, content, created_by, created_at")
    .order("created_at", { ascending: false });

  const documents = (data ?? []) as ElimIADocument[];

  const inputStyle = {
    background: "var(--color-surface-elevated)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
  } as const;

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "rgba(245,200,66,0.1)", border: "1px solid rgba(245,200,66,0.35)" }}
        >
          <Bot size={18} style={{ color: "#f5c842" }} />
        </div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          Elim IA — Documentos (Modo LLDM)
        </h1>
      </div>

      <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        Sube documentos (PDF, Word o texto). Su contenido se usará como base de conocimiento
        cuando los usuarios chateen con Elim IA en Modo LLDM.
      </p>

      {/* Upload form */}
      <form
        action={handleUpload}
        className="flex flex-col sm:flex-row gap-3 mb-8 p-5 rounded-2xl"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <input
          type="text"
          name="title"
          required
          maxLength={150}
          placeholder="Título del documento"
          className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
          style={inputStyle}
        />
        <input
          type="file"
          name="file"
          required
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="flex-1 rounded-xl px-4 py-3 text-sm outline-none file:mr-2 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-semibold"
          style={inputStyle}
        />
        <button
          type="submit"
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold shrink-0"
          style={{ background: "#f5c842", color: "#000" }}
        >
          <Upload size={15} />
          Subir
        </button>
      </form>

      {/* Document list */}
      {documents.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <FileText size={36} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p style={{ color: "var(--color-text-muted)" }}>No hay documentos cargados.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between px-5 py-4 rounded-2xl"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={18} style={{ color: "var(--color-text-muted)" }} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                    {doc.title}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {doc.file_name} · {doc.content.length.toLocaleString("es-MX")} caracteres ·{" "}
                    {formatDate(doc.created_at).split(",")[0]}
                  </p>
                </div>
              </div>
              <form action={handleDelete}>
                <input type="hidden" name="id" value={doc.id} />
                <input type="hidden" name="file_url" value={doc.file_url} />
                <button
                  type="submit"
                  className="p-2 rounded-lg shrink-0"
                  style={{ color: "var(--color-destructive)" }}
                  title="Eliminar"
                >
                  <Trash2 size={15} />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
