"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import TaskForm from "@/features/admin/components/TaskForm";
import { getTask } from "@/features/admin/services/adminService";
import { errorMessage, focusRing } from "@/features/admin/ui";
import type { Task } from "@/features/tasks/types/task";

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

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin"
        className={`rounded text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300 ${focusRing}`}
      >
        Kembali ke daftar
      </Link>
      <h1 className="mb-6 mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
        Edit tugas
      </h1>

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
      ) : task ? (
        <TaskForm key={task.id} task={task} />
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Tugas tidak ditemukan. Mungkin sudah dihapus.
        </p>
      )}
    </div>
  );
}
