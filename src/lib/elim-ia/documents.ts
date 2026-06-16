import mammoth from "mammoth";

export { isSupportedDocumentType } from "./document-types";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function extractTextFromDocument(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (mimeType === "application/pdf" || ext === "pdf") {
    try {
      // Import the internal implementation directly — `pdf-parse`'s index.js runs
      // a debug-mode block at module evaluation when bundled (module.parent is
      // undefined under Turbopack/webpack), which throws ENOENT trying to read
      // a test fixture that isn't present in the deployed bundle.
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
      const result = await pdfParse(buffer);
      return result.text.trim();
    } catch (err) {
      throw new Error(
        `No se pudo leer el PDF "${fileName}": ${err instanceof Error ? err.message : "error desconocido"}`
      );
    }
  }

  if (mimeType === DOCX_MIME || ext === "docx") {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim();
    } catch (err) {
      throw new Error(
        `No se pudo leer el documento Word "${fileName}": ${err instanceof Error ? err.message : "error desconocido"}`
      );
    }
  }

  return buffer.toString("utf-8").trim();
}
