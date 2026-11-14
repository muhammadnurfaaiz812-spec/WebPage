import type { Metadata } from "next";
import Link from "next/link";
import TaskForm from "@/features/admin/components/TaskForm";
import {
  MOTION_CSS,
  delay,
  focusRingOnDark,
  heroBtn,
  heroChip,
} from "@/features/admin/ui";

// Halaman ini tidak memakai hook, jadi tidak perlu "use client".
// TaskForm sendiri sudah komponen klien.
export const metadata: Metadata = {
  title: "Tugas baru | Panel Admin",
};

export default function NewTaskPage() {
  return (
    // Lebar wadah dan padding samping diberikan oleh layout panel
    // (max-w-7xl), jadi tepi kiri-kanan sejajar dengan logo dan tombol header.
    <div className="w-full">
      <style>{MOTION_CSS}</style>

      {/* Banner judul: gradasi hijau yang sama dengan beranda dan halaman
          detail. Tombol kembali memakai outline putih (tombol); catatan
          kolom wajib memakai pil datar (lencana). */}
      <header
        aria-labelledby="judul-halaman"
        className="relative isolate mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 p-5 text-white shadow-lg shadow-emerald-950/20 sm:mb-8 sm:rounded-3xl sm:p-8 dark:via-emerald-950 dark:to-emerald-900"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 -z-10 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl"
        />

        <Link
          href="/admin"
          style={delay(0)}
          className={`anim-fade-up group/back ${heroBtn} ${focusRingOnDark}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 transition-transform duration-200 group-hover/back:-translate-x-1"
            aria-hidden="true"
          >
            <path d="m12 19-7-7 7-7M19 12H5" />
          </svg>
          Kembali ke daftar
        </Link>

        <div
          className="anim-fade-up mt-5 flex items-center gap-3 sm:mt-6 sm:gap-4"
          style={delay(90)}
        >
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/20 sm:h-12 sm:w-12"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 sm:h-6 sm:w-6"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <h1
            id="judul-halaman"
            className="text-3xl font-extrabold tracking-tight sm:text-4xl"
          >
            Tugas baru
          </h1>
        </div>

        <p
          className="anim-fade-up mt-4 max-w-2xl text-sm leading-6 text-emerald-50/90 sm:text-base sm:leading-7"
          style={delay(170)}
        >
          Isi informasi tugas, unggah berkas bila ada, lalu pilih apakah
          langsung dipublikasikan.
        </p>

        <p className="anim-fade-up mt-4" style={delay(250)}>
          <span className={heroChip}>
            Kolom bertanda{" "}
            <span aria-hidden="true" className="text-sm font-bold text-white">
              *
            </span>
            <span className="sr-only">bintang</span> wajib diisi
          </span>
        </p>
      </header>

      <TaskForm />
    </div>
  );
}