"use client";

/* Simpan sebagai src/app/admin/(panel)/tugas/[id]/page.tsx
   Butuh admin-ui.ts versi terbaru (MOTION_CSS, delay, heroBtn, heroChip,
   focusRingOnDark). */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import TaskForm from "@/features/admin/components/TaskForm";
import { getTask } from "@/features/admin/services/adminService";
import {
  MOTION_CSS,
  btnPrimary,
  btnSecondary,
  delay,
  errorMessage,
  focusRing,
  focusRingOnDark,
  heroBtn,
  heroChip,
  surface,
} from "@/features/admin/ui";
import type { Task } from "@/features/tasks/types/task";

/* Kerangka yang meniru bentuk form (kolom utama + kolom samping), supaya
   tata letak tidak melompat saat data selesai dimuat. */
function FormSkeleton() {
  const line = "rounded bg-slate-200 dark:bg-slate-700";
  const box = "rounded-xl bg-slate-100 dark:bg-slate-800";

  return (
    <div className="@container">
      <div
        aria-busy="true"
        className="flex animate-pulse flex-col gap-6 @4xl:grid @4xl:grid-cols-[minmax(0,1fr)_22rem] @4xl:items-start @4xl:gap-8"
      >
        <p role="status" className="sr-only">
          Memuat tugas...
        </p>

        <div
          className={`${surface} divide-y divide-slate-200 rounded-2xl shadow-sm dark:divide-slate-800`}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="p-5 sm:p-6">
              <div className="mb-5 flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800" />
                <div className="space-y-2">
                  <div className={`h-4 w-40 ${line}`} />
                  <div className="h-3 w-64 max-w-full rounded bg-slate-100 dark:bg-slate-800" />
                </div>
              </div>
              <div className="grid gap-4">
                <div className={`h-11 w-full ${box}`} />
                <div className={`h-11 w-full ${box}`} />
                {i === 0 && <div className={`h-28 w-full ${box}`} />}
              </div>
            </div>
          ))}
        </div>

        <div className={`${surface} rounded-2xl p-5 shadow-sm sm:p-6`}>
          <div className="mb-5 flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800" />
            <div className="space-y-2">
              <div className={`h-4 w-28 ${line}`} />
              <div className="h-3 w-52 max-w-full rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          </div>
          <div className="grid gap-3">
            <div className={`h-20 w-full ${box}`} />
            <div className={`h-20 w-full ${box}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditTaskPage() {
  const params = useParams<{ id: string }>();
  const id = String(params.id ?? "");

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getTask(id)
      .then((data) => active && setTask(data))
      .catch((err) => active && setError(errorMessage(err, "Gagal memuat tugas.")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  // Cahaya di banner bergeser halus mengikuti kursor (hanya mouse)
  function handleBannerMove(e: ReactPointerEvent<HTMLElement>) {
    if (e.pointerType !== "mouse") return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty(
      "--px",
      String(((e.clientX - rect.left) / rect.width - 0.5) * 2)
    );
    el.style.setProperty(
      "--py",
      String(((e.clientY - rect.top) / rect.height - 0.5) * 2)
    );
  }

  function handleBannerLeave(e: ReactPointerEvent<HTMLElement>) {
    e.currentTarget.style.setProperty("--px", "0");
    e.currentTarget.style.setProperty("--py", "0");
  }

  const published = task?.status === "published";

  return (
    // Lebar wadah dan padding samping diberikan oleh layout panel, sama
    // dengan halaman "Tugas baru", jadi form tampil dua kolom di layar lebar.
    <div className="w-full">
      <style>{MOTION_CSS}</style>

      {/* ───── BANNER JUDUL ─────
          Sama dengan halaman "Tugas baru". Tombol memakai outline putih,
          lencana (judul tugas, status) memakai pil datar. */}
      <header
        aria-labelledby="judul-halaman"
        onPointerMove={handleBannerMove}
        onPointerLeave={handleBannerLeave}
        className="relative isolate mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 p-5 text-white shadow-lg shadow-emerald-950/20 sm:mb-8 sm:rounded-3xl sm:p-8 dark:via-emerald-950 dark:to-emerald-900"
      >
        <div
          aria-hidden="true"
          className="parallax pointer-events-none absolute -right-16 -top-24 -z-10 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl"
          style={{
            transform:
              "translate3d(calc(var(--px, 0) * -28px), calc(var(--py, 0) * -28px), 0)",
          }}
        />

        <div
          className="anim-fade-up flex flex-wrap items-center justify-between gap-3"
          style={delay(0)}
        >
          <Link
            href="/admin"
            className={`group/back ${heroBtn} ${focusRingOnDark}`}
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

          {task && published && (
            <Link
              href={`/tugas/${task.id}`}
              target="_blank"
              rel="noopener"
              className={`panel-in group/view ${heroBtn} ${focusRingOnDark}`}
            >
              Lihat di situs
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 transition-transform duration-200 group-hover/view:-translate-y-0.5 group-hover/view:translate-x-0.5"
                aria-hidden="true"
              >
                <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </svg>
              <span className="sr-only"> (tab baru)</span>
            </Link>
          )}
        </div>

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
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 sm:h-6 sm:w-6"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </span>
          <h1
            id="judul-halaman"
            className="text-3xl font-extrabold tracking-tight sm:text-4xl"
          >
            Edit tugas
          </h1>
        </div>

        <p
          className="anim-fade-up mt-4 max-w-2xl text-sm leading-6 text-emerald-50/90 sm:text-base sm:leading-7"
          style={delay(170)}
        >
          Ubah informasi tugas, ganti berkasnya, atau atur ulang status
          publikasinya. Perubahan baru berlaku setelah disimpan.
        </p>

        {/* Muncul setelah data dimuat: tugas mana yang sedang diedit */}
        {task && (
          <div className="panel-in mt-4 flex flex-wrap items-center gap-2">
            <span className={`${heroChip} min-w-0 max-w-full`}>
              <span className="truncate" title={task.title}>
                {task.title}
              </span>
            </span>
            <span className={heroChip}>
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  published ? "bg-emerald-300" : "bg-white/50"
                }`}
              />
              {published ? "Dipublikasikan" : "Draft"}
            </span>
          </div>
        )}
      </header>

      {loading ? (
        <FormSkeleton />
      ) : error ? (
        <div
          role="alert"
          className="panel-in rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-900/50 dark:bg-red-950/20"
        >
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={`${btnSecondary} mt-5`}
          >
            Coba lagi
          </button>
        </div>
      ) : task ? (
        <TaskForm key={task.id} task={task} />
      ) : (
        <div className="panel-in rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Tugas tidak ditemukan. Mungkin sudah dihapus.
          </p>
          <Link href="/admin" className={`${btnPrimary} mt-5 ${focusRing}`}>
            Kembali ke daftar
          </Link>
        </div>
      )}
    </div>
  );
}