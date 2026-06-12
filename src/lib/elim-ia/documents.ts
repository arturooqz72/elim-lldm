import mammoth from "mammoth";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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

export async function extractTextFromDocument(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (mimeType === "application/pdf" || ext === "pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return result.text.trim();
  }

  if (mimeType === DOCX_MIME || ext === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  return buffer.toString("utf-8").trim();
}
