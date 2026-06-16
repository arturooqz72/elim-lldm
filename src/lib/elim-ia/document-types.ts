export interface UploadedDocument {
  title: string;
  fileName: string;
  filePath: string;
  fileType: string;
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isSupportedDocumentType(fileName: string, mimeType: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return (
    mimeType === "application/pdf" ||
    mimeType === DOCX_MIME ||
    mimeType === "text/plain" ||
    ext === "pdf" ||
    ext === "docx" ||
    ext === "txt"
  );
}
