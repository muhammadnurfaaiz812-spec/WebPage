import { supabase } from "@/lib/supabase/client";

// Bucket Supabase Storage untuk berkas tugas. Harus sama dengan bucket di SQL.
// Dipakai bersama oleh beranda, halaman detail, dan panel admin.
export const DOCUMENT_BUCKET = "task-documents";

/* ────────────────────────────────────────────────────────────
   JENIS PRATINJAU
   Pratinjau kartu dibuat di browser admin saat berkas diunggah:
   - "pdf"   : halaman 1 dirender memakai pdf.js
   - "image" : gambar diperkecil dan dipotong 16:9
   Jenis lain (Word, PowerPoint, Excel, ZIP, TXT) tidak bisa dirender di
   browser, jadi kartunya memakai sampul pengganti dengan ikon.
   ──────────────────────────────────────────────────────────── */

export const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
] as const;

export type PreviewKind = "pdf" | "image";

/** Jenis pratinjau untuk sebuah nama berkas, atau null kalau tidak didukung. */
export function getPreviewKind(
  name: string | null | undefined
): PreviewKind | null {
  if (!name) return null;
  const dot = name.lastIndexOf(".");
  if (dot < 0) return null;

  const ext = name.slice(dot).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) return "image";
  return null;
}

/**
 * Tautan lihat dan unduh untuk berkas tugas. Mengembalikan null kalau tugas
 * belum punya berkas, jadi pemanggil cukup memeriksa hasilnya.
 * document_path berisi path di dalam bucket (tanpa nama bucket), atau URL
 * lengkap kalau berkasnya di luar Storage.
 */
export function getDocumentUrls(
  path: string | null | undefined,
  name?: string | null
) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return { view: path, download: path };

  const storage = supabase.storage.from(DOCUMENT_BUCKET);
  return {
    view: storage.getPublicUrl(path).data.publicUrl,
    download: storage.getPublicUrl(path, { download: name ?? true }).data
      .publicUrl,
  };
}

/** URL gambar pratinjau, atau undefined kalau tugas belum punya pratinjau. */
export function getThumbnailUrl(path: string | null | undefined) {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from(DOCUMENT_BUCKET).getPublicUrl(path).data
    .publicUrl;
}

/** Ekstensi berkas huruf besar ("laporan.pdf" menjadi "PDF"), atau undefined. */
export function getFileExtension(name: string | null | undefined) {
  if (!name || !name.includes(".")) return undefined;
  return name.split(".").pop()?.toUpperCase() || undefined;
}