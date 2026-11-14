import type { PreviewKind } from "@/features/tasks/lib/documents";
import { renderImagePreview } from "@/features/admin/lib/imagePreview";
import { renderPdfPreview } from "@/features/admin/lib/pdfPreview";

/**
 * Satu pintu masuk untuk membuat gambar pratinjau kartu, apa pun jenis
 * berkasnya. Hasilnya selalu JPEG 16:9. pdf.js hanya dimuat kalau berkasnya PDF.
 */
export function renderFilePreview(
  source: Blob,
  kind: PreviewKind
): Promise<Blob> {
  return kind === "pdf" ? renderPdfPreview(source) : renderImagePreview(source);
}