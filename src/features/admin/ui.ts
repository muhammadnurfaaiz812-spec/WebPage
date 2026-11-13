/* Token style dan helper bersama untuk halaman admin.
   Nilainya sengaja sama dengan beranda supaya tampilannya serasi. */

export const GUTTER = "px-4 sm:px-6 lg:px-10";

export const focusRing =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30";

export const surface =
  "border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";

const fieldCore =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:bg-slate-800";

export const field = `h-11 ${fieldCore}`;
export const fieldMultiline = `py-3 leading-6 ${fieldCore}`;

export const fieldLabel =
  "mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200";

export const fieldHint = "mt-1.5 text-xs text-slate-500 dark:text-slate-400";

export const btnPrimary = `inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

export const btnSecondary = `inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 text-sm font-semibold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300 ${focusRing}`;

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
