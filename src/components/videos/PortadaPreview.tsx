"use client";

import { useEffect, useState } from "react";

interface PortadaPreviewProps {
  file: File | null;
  label: string;
}

export function PortadaPreview({ file, label }: PortadaPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return null;

  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Portada elegida"
        className="w-28 aspect-video object-cover rounded-lg"
        style={{ border: "1px solid var(--color-border)" }}
      />
      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        Portada: {label}
      </span>
    </div>
  );
}
