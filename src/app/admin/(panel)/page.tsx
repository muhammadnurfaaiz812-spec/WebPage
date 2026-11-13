"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Task, TaskStatus } from "@/features/tasks/types/task";
import {
  deleteTask,
  listAllTasks,
  setTaskStatus,
} from "@/features/admin/services/adminService";
import {
  btnPrimary,
  errorMessage,
  focusRing,
  formatDate,
  surface,
} from "@/features/admin/ui";

type Filter = "all" | TaskStatus;

const rowBtn = `inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
const rowBtnNeutral = `${rowBtn} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`;
const rowBtnGreen = `${rowBtn} text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10`;
const rowBtnRed = `${rowBtn} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10`;

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listAllTasks()
      .then((data) => active && setTasks(data))
      .catch((err) => active && setError(errorMessage(err, "Gagal memuat tugas.")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(
    () => ({
      all: tasks.length,
      published: tasks.filter((t) => t.status === "published").length,
      draft: tasks.filter((t) => t.status === "draft").length,
    }),
    [tasks]
  );

  const visible = useMemo(
    () => (filter === "all" ? tasks : tasks.filter((t) => t.status === filter)),
    [tasks, filter]
  );

  async function handleToggle(task: Task) {
    const next: TaskStatus = task.status === "published" ? "draft" : "published";
    setBusyId(task.id);
    setActionError(null);
    try {
      await setTaskStatus(task.id, next);
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: next } : t))
      );
    } catch (err) {
      setActionError(errorMessage(err, "Gagal mengubah status."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(task: Task) {
    setBusyId(task.id);
    setActionError(null);
    try {
      await deleteTask(task);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setConfirmId(null);
    } catch (err) {
      setActionError(errorMessage(err, "Gagal menghapus tugas."));
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "Semua", count: counts.all },
    { value: "published", label: "Dipublikasikan", count: counts.published },
    { value: "draft", label: "Draft", count: counts.draft },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
          Kelola tugas
        </h1>
        <Link href="/admin/tugas/baru" className={btnPrimary}>
          Tugas baru
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            aria-pressed={filter === tab.value}
            className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition active:scale-95 ${focusRing} ${
              filter === tab.value
                ? "bg-emerald-700 text-white"
                : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:ring-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
            }`}
          >
            {tab.label}
            <span className="tabular-nums opacity-80">{tab.count}</span>
          </button>
        ))}
      </div>

      {actionError && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
        >
          {actionError}
        </p>
      )}

      <div className="mt-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Memuat tugas...
          </p>
        ) : error ? (
          <p
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
          >
            {error}
          </p>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {tasks.length === 0
                ? "Belum ada tugas. Tambahkan tugas pertamamu."
                : "Tidak ada tugas dengan status ini."}
            </p>
            {tasks.length === 0 && (
              <Link href="/admin/tugas/baru" className={`${btnPrimary} mt-5`}>
                Tugas baru
              </Link>
            )}
          </div>
        ) : (
          <ul
            className={`${surface} divide-y divide-slate-200 overflow-hidden rounded-2xl shadow-sm dark:divide-slate-800`}
          >
            {visible.map((task) => {
              const published = task.status === "published";
              const busy = busyId === task.id;

              return (
                <li
                  key={task.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/tugas/${task.id}`}
                      className={`block truncate rounded text-sm font-semibold text-slate-900 hover:text-emerald-700 dark:text-slate-50 dark:hover:text-emerald-300 ${focusRing}`}
                    >
                      {task.title}
                    </Link>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <span>{task.courses?.name ?? "Tanpa mata kuliah"}</span>
                      <span>Semester {task.semester}</span>
                      <span>
                        {task.deadline
                          ? `Batas ${formatDate(task.deadline)}`
                          : "Tanpa batas waktu"}
                      </span>
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <span
                      className={`mr-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        published
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                      }`}
                    >
                      {published ? "Dipublikasikan" : "Draft"}
                    </span>

                    {confirmId === task.id ? (
                      <>
                        <span className="text-xs text-red-600 dark:text-red-400">
                          Hapus tugas ini?
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDelete(task)}
                          className={rowBtnRed}
                        >
                          {busy ? "Menghapus..." : "Ya, hapus"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmId(null)}
                          className={rowBtnNeutral}
                        >
                          Batal
                        </button>
                      </>
                    ) : (
                      <>
                        <Link href={`/admin/tugas/${task.id}`} className={rowBtnNeutral}>
                          Edit
                        </Link>
                        {published && (
                          <Link
                            href={`/tugas/${task.id}`}
                            target="_blank"
                            className={rowBtnNeutral}
                          >
                            Lihat
                          </Link>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleToggle(task)}
                          className={rowBtnGreen}
                        >
                          {published ? "Jadikan draft" : "Terbitkan"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setActionError(null);
                            setConfirmId(task.id);
                          }}
                          className={rowBtnRed}
                        >
                          Hapus
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
