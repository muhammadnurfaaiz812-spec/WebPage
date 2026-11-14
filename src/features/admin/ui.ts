/* Token style dan helper bersama untuk halaman admin.
   Nilainya sengaja sama dengan beranda supaya tampilannya serasi.

   Palet (sama dengan beranda dan halaman detail):
   - Brand  : emerald. Solid 700 (hover 800). Tint 50 dengan teks 800.
   - Netral : slate. Kolom isian 50 / 800, batas 200 / 700.
   - Hover  : semua kontrol interaktif berubah ke batas emerald-300.
   - Merah  : hanya untuk hapus dan pesan error. */

import type { CSSProperties } from "react";

export const GUTTER = "px-4 sm:px-6 lg:px-10";

export const focusRing =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30";

export const surface =
  "border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";

// "dark:[color-scheme:dark]" membuat bagian bawaan browser (kalender tanggal,
// daftar pilihan, scrollbar) ikut tema gelap.
const fieldCore =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-emerald-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-emerald-500/40 dark:focus:border-emerald-500 dark:focus:bg-slate-800 dark:disabled:text-slate-500 dark:[color-scheme:dark]";

export const field = `h-11 ${fieldCore}`;
export const fieldMultiline = `py-3 leading-6 ${fieldCore}`;

export const fieldLabel =
  "mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200";

export const fieldHint = "mt-1.5 text-xs text-slate-600 dark:text-slate-400";

export const btnPrimary = `inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

export const btnSecondary = `inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 text-sm font-semibold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300 ${focusRing}`;

/** Tanggal ISO (YYYY-MM-DD) ke format Indonesia, mis. "20 Nov 2026". */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

/* ────────────────────────────────────────────────────────────
   ANIMASI (dipakai halaman dan form)
   - Judul dan bagian form masuk berurutan saat halaman dibuka
   - Selebihnya merespons aksi: kolom salah bergetar, pesan error dan
     kartu berkas turun halus, ikon status memantul saat dipilih
   - Otomatis mati kalau perangkat memakai "reduce motion"
   "backwards" (bukan "both") supaya setelah selesai tidak ada sisa
   efek animasi yang menahan lapisan tumpuk di elemen induk.
   Render lewat <style>{MOTION_CSS}</style>.
   ──────────────────────────────────────────────────────────── */

export const MOTION_CSS = `
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes popIn{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
@keyframes panelIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@keyframes shake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-4px)}40%,60%{transform:translateX(4px)}}
.anim-fade-up{animation:fadeUp .7s cubic-bezier(.22,1,.36,1) backwards}
.anim-pop{animation:popIn .25s cubic-bezier(.34,1.56,.64,1) backwards}
.panel-in{animation:panelIn .25s cubic-bezier(.22,1,.36,1) backwards}
:is(input,select,textarea)[aria-invalid="true"]{animation:shake .4s cubic-bezier(.36,.07,.19,.97)}
.parallax{transition:transform .35s ease-out;will-change:transform}
@media (prefers-reduced-motion:reduce){
  .anim-fade-up,.anim-pop,.panel-in,:is(input,select,textarea)[aria-invalid="true"]{animation:none!important}
  .parallax{transform:none!important;transition:none}
}
`;

/** Jeda awal animasi masuk, dalam milidetik. */
export const delay = (ms: number): CSSProperties => ({
  animationDelay: `${ms}ms`,
});

/* ────────────────────────────────────────────────────────────
   BANNER (sama dengan beranda dan halaman detail)
   Tombol di banner: outline putih yang terisi putih saat hover.
   Lencana di banner: pil datar, tidak bisa diklik.
   ──────────────────────────────────────────────────────────── */

export const focusRingOnDark =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50";

export const heroBtn =
  "inline-flex h-10 items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:border-white hover:bg-white hover:text-emerald-900 active:scale-[0.97]";

export const heroChip =
  "inline-flex items-center gap-1.5 rounded-full bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-50";

// Tombol utama di banner: putih penuh, supaya menonjol di atas hijau tua
export const heroBtnSolid =
  "inline-flex h-11 items-center gap-2 rounded-xl border border-white bg-white px-5 text-sm font-semibold text-emerald-900 shadow-sm transition duration-200 hover:bg-emerald-50 active:scale-[0.97]";