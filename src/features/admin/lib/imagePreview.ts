/**
 * Membuat gambar pratinjau dari berkas gambar (JPG, PNG, WebP, GIF), seluruhnya
 * di browser admin. Hasilnya JPEG dengan ukuran dan rasio yang sama seperti
 * pratinjau PDF (lebar maksimal 800 px, rasio 16:9), jadi semua kartu tugas
 * memakai satu format gambar yang seragam.
 *
 * - Gambar yang lebih lebar dari 800 px diperkecil; yang lebih kecil tidak
 *   diperbesar.
 * - Gambar yang lebih tinggi dari 16:9 dipotong. Posisi potongan diatur oleh
 *   CROP_ANCHOR_Y.
 * - Gambar yang lebih pendek dari 16:9 ditampilkan utuh.
 * - Latar putih diberikan dulu supaya PNG/WebP transparan tidak menjadi hitam
 *   saat disimpan sebagai JPEG.
 * - GIF beranimasi diambil bingkai pertamanya.
 */

import {
  PREVIEW_ASPECT,
  PREVIEW_WIDTH,
} from "@/features/admin/lib/pdfPreview";

const PREVIEW_QUALITY = 0.82;

// Posisi potongan untuk gambar yang lebih tinggi dari 16:9.
// 0 = ambil bagian atas (sama seperti pratinjau PDF), 0.5 = ambil bagian tengah.
// Ganti ke 0.5 kalau kamu lebih sering mengunggah foto daripada dokumen.
const CROP_ANCHOR_Y = 0;

function loadImage(
  source: Blob
): Promise<{ img: HTMLImageElement; release: () => void }> {
  const url = URL.createObjectURL(source);
  const img = new Image();

  return new Promise((resolve, reject) => {
    img.onload = () =>
      resolve({ img, release: () => URL.revokeObjectURL(url) });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("gambar tidak bisa dibaca"));
    };
    img.src = url;
  });
}

/** Perkecil dan potong gambar menjadi JPEG 16:9. Melempar error kalau gambar rusak. */
export async function renderImagePreview(source: Blob): Promise<Blob> {
  const { img, release } = await loadImage(source);

  try {
    const srcWidth = img.naturalWidth;
    const srcHeight = img.naturalHeight;
    if (!srcWidth || !srcHeight) throw new Error("ukuran gambar tidak valid");

    const scale = Math.min(1, PREVIEW_WIDTH / srcWidth);
    const outWidth = Math.max(1, Math.round(srcWidth * scale));
    const fullHeight = Math.max(1, Math.round(srcHeight * scale));
    const outHeight = Math.min(
      fullHeight,
      Math.max(1, Math.round(outWidth / PREVIEW_ASPECT))
    );

    // Bagian gambar asli yang dipakai (dalam piksel gambar asli)
    const srcCropHeight = Math.min(srcHeight, Math.round(outHeight / scale));
    const srcY = Math.round((srcHeight - srcCropHeight) * CROP_ANCHOR_Y);

    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("browser tidak mendukung canvas");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outWidth, outHeight);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      img,
      0,
      srcY,
      srcWidth,
      srcCropHeight,
      0,
      0,
      outWidth,
      outHeight
    );

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("gambar tidak bisa dibuat")),
        "image/jpeg",
        PREVIEW_QUALITY
      )
    );
  } finally {
    release();
  }
}