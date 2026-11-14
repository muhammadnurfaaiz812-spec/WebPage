/**
 * Membuat gambar pratinjau dari halaman pertama PDF, seluruhnya di browser
 * admin. Hasilnya JPEG kecil (lebar 800 px) yang memotong bagian atas halaman
 * dengan rasio 16:9, jadi kartu hanya menampilkan "cuplikan" berkas.
 *
 * pdf.js dimuat saat dibutuhkan dari CDN dengan versi dipatok, sehingga tidak
 * ada paket npm atau konfigurasi bundler tambahan. Konsekuensinya, admin perlu
 * koneksi internet saat membuat pratinjau. Halaman publik tidak memuat pdf.js
 * sama sekali; pengunjung hanya mengunduh gambar JPEG-nya.
 */

const PDFJS_VERSION = "4.10.38";
const PDFJS_ROOT = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`;

export const PREVIEW_WIDTH = 800;
export const PREVIEW_ASPECT = 16 / 9;
const PREVIEW_QUALITY = 0.82;

// Tipe minimal untuk bagian pdf.js yang dipakai di sini
type PdfViewport = { width: number; height: number };
type PdfPage = {
  getViewport(params: { scale: number }): PdfViewport;
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
    canvas?: HTMLCanvasElement;
  }): { promise: Promise<void> };
};
type PdfDocument = {
  getPage(pageNumber: number): Promise<PdfPage>;
  destroy(): Promise<void>;
};
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(source: {
    data: ArrayBuffer;
    cMapUrl?: string;
    cMapPacked?: boolean;
    standardFontDataUrl?: string;
  }): { promise: Promise<PdfDocument> };
};

let loader: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  if (!loader) {
    const url = `${PDFJS_ROOT}/build/pdf.min.mjs`;
    loader = (
      import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url) as Promise<PdfJs>
    )
      .then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = `${PDFJS_ROOT}/build/pdf.worker.min.mjs`;
        return lib;
      })
      .catch(() => {
        loader = null; // izinkan coba lagi
        throw new Error("pustaka PDF tidak bisa dimuat, periksa koneksi internet");
      });
  }
  return loader;
}

/** Render bagian atas halaman 1 sebagai JPEG. Melempar error kalau PDF tidak bisa dibaca. */
export async function renderPdfPreview(source: Blob): Promise<Blob> {
  const pdfjs = await loadPdfJs();
  const data = await source.arrayBuffer();

  const pdf = await pdfjs.getDocument({
    data,
    cMapUrl: `${PDFJS_ROOT}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDFJS_ROOT}/standard_fonts/`,
  }).promise;

  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: PREVIEW_WIDTH / base.width });

    const full = document.createElement("canvas");
    full.width = Math.round(viewport.width);
    full.height = Math.round(viewport.height);
    const fullCtx = full.getContext("2d");
    if (!fullCtx) throw new Error("browser tidak mendukung canvas");

    // PDF tanpa latar tampil transparan; beri dasar putih seperti kertas
    fullCtx.fillStyle = "#ffffff";
    fullCtx.fillRect(0, 0, full.width, full.height);
    await page.render({ canvasContext: fullCtx, viewport, canvas: full }).promise;

    // Potong bagian atas. Halaman lanskap (mis. slide) yang lebih pendek
    // dari potongan ditampilkan utuh.
    const cropHeight = Math.min(
      full.height,
      Math.round(full.width / PREVIEW_ASPECT)
    );
    const crop = document.createElement("canvas");
    crop.width = full.width;
    crop.height = cropHeight;
    const cropCtx = crop.getContext("2d");
    if (!cropCtx) throw new Error("browser tidak mendukung canvas");
    cropCtx.drawImage(full, 0, 0, full.width, cropHeight, 0, 0, full.width, cropHeight);

    return await new Promise<Blob>((resolve, reject) =>
      crop.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("gambar tidak bisa dibuat")),
        "image/jpeg",
        PREVIEW_QUALITY
      )
    );
  } finally {
    await pdf.destroy();
  }
}
