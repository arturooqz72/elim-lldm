"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export function DownloadSaludoButton({ url, filename }: { url: string; filename: string }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0"
      style={{ background: "var(--color-primary)", color: "#000" }}
    >
      {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
      {downloading ? "Descargando…" : "Descargar"}
    </button>
  );
}
