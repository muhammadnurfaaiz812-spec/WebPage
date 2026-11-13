"use client";

import Link from "next/link";
import TaskForm from "@/features/admin/components/TaskForm";
import { focusRing } from "@/features/admin/ui";

export default function NewTaskPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin"
        className={`rounded text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300 ${focusRing}`}
      >
        Kembali ke daftar
      </Link>
      <h1 className="mb-6 mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
        Tugas baru
      </h1>
      <TaskForm />
    </div>
  );
}
