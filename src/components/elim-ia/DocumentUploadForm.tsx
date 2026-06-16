"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Upload, X, Loader2 } from "lucide-react";
import { createFreshClient } from "@/lib/supabase/client";
import {
  formatFileSize,
  isSupportedDocumentType,
  MAX_DOCUMENT_SIZE_BYTES,
  type UploadedDocument,
} from "@/lib/elim-ia/document-types";

const ACCEPTED_TYPES =
  ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

const inputStyle = {
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;

interface DocumentUploadFormProps {
  action: (docs: UploadedDocument[]) => Promise<{ error?: string }>;
}

export function DocumentUploadForm({ action }: DocumentUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;

    const incoming: File[] = [];
    const rejected: string[] = [];

    for (const file of Array.from(fileList)) {
      if (!isSupportedDocumentType(file.name, file.type)) {
        rejected.push(`${file.name}: tipo de archivo no soportado`);
        continue;
      }
      if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
        rejected.push(`${file.name}: supera el límite de ${formatFileSize(MAX_DOCUMENT_SIZE_BYTES)}`);
        continue;
      }
      incoming.push(file);
    }

    if (rejected.length > 0) {
      setError(rejected.join("\n"));
    } else {
      setError(null);
    }

    setFiles((prev) => [...prev, ...incoming]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (files.length === 0 || isPending) return;
    setError(null);

    startTransition(async () => {
      const supabase = createFreshClient();
      const uploaded: UploadedDocument[] = [];

      for (const [index, file] of files.entries()) {
        const filePath = `documents/${Date.now()}-${index}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("elim-ia-documents")
          .upload(filePath, file, { contentType: file.type || "application/octet-stream" });

        if (uploadError) {
          setError(`Error subiendo ${file.name}: ${uploadError.message}`);
          return;
        }

        uploaded.push({
          title: files.length === 1 && title.trim() ? title.trim() : file.name.replace(/\.[^./]+$/, ""),
          fileName: file.name,
          filePath,
          fileType: file.type || "unknown",
        });
      }

      try {
        const result = await action(uploaded);
        if (result?.error) {
          setError(result.error);
          return;
        }
      } catch (err) {
        setError(
          `Error al procesar los documentos: ${err instanceof Error ? err.message : "error desconocido"}`
        );
        return;
      }

      setFiles([]);
      setTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 mb-8 p-5 rounded-2xl"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={150}
        placeholder="Título (opcional — si subes varios archivos se usará el nombre de cada uno)"
        className="rounded-xl px-4 py-3 text-sm outline-none"
        style={inputStyle}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 rounded-xl px-4 py-8 text-center cursor-pointer transition-all duration-200"
        style={{
          background: "var(--color-surface-elevated)",
          border: `2px dashed ${isDragging ? "#f5c842" : "var(--color-border)"}`,
        }}
      >
        <Upload size={22} style={{ color: isDragging ? "#f5c842" : "var(--color-text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--color-text)" }}>
          Arrastra archivos aquí o haz clic para seleccionar
        </p>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          PDF, Word (.docx) o texto (.txt) — puedes seleccionar varios — máx.{" "}
          {formatFileSize(MAX_DOCUMENT_SIZE_BYTES)} por archivo
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          onChange={(e) => addFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between gap-3 px-4 py-2 rounded-xl text-sm"
              style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={14} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
                <span className="truncate" style={{ color: "var(--color-text)" }}>
                  {file.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="shrink-0 p-1 rounded-lg"
                style={{ color: "var(--color-text-muted)" }}
                title="Quitar"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={files.length === 0 || isPending}
        className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "#f5c842", color: "#000" }}
      >
        {isPending ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
        {isPending
          ? "Subiendo..."
          : files.length > 0
            ? `Subir ${files.length} archivo${files.length === 1 ? "" : "s"}`
            : "Subir"}
      </button>
    </form>
  );
}
