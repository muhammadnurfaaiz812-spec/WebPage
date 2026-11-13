"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { Task, TaskStatus } from "@/features/tasks/types/task";
import {
  FILE_EXTENSIONS,
  MAX_FILE_BYTES,
  createCourse,
  listCourses,
  saveTask,
  type Course,
} from "@/features/admin/services/adminService";
import {
  btnPrimary,
  btnSecondary,
  errorMessage,
  field,
  fieldHint,
  fieldLabel,
  fieldMultiline,
  surface,
} from "@/features/admin/ui";

// Tahun ajaran baru dimulai sekitar Agustus
function defaultAcademicYear() {
  const now = new Date();
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}/${start + 1}`;
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string; hint: string }[] = [
  {
    value: "draft",
    label: "Draft",
    hint: "Hanya terlihat olehmu. Tidak tampil di situs.",
  },
  {
    value: "published",
    label: "Dipublikasikan",
    hint: "Tampil di beranda dan bisa dibuka siapa saja.",
  },
];

export default function TaskForm({ task }: { task?: Task }) {
  const router = useRouter();

  // Id dibuat di sisi klien agar berkas bisa diunggah ke "<id>/..." sebelum baris disimpan
  const [id] = useState(() => task?.id ?? crypto.randomUUID());
  const [title, setTitle] = useState(task?.title ?? "");
  const [courseId, setCourseId] = useState(task?.course_id ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [semester, setSemester] = useState(task ? String(task.semester) : "");
  const [academicYear, setAcademicYear] = useState(
    task?.academic_year ?? defaultAcademicYear()
  );
  const [deadline, setDeadline] = useState(task?.deadline ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "draft");

  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [removeFile, setRemoveFile] = useState(false);

  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [addingCourse, setAddingCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseCode, setNewCourseCode] = useState("");
  const [courseBusy, setCourseBusy] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentFile = task?.document_name ?? null;

  useEffect(() => {
    let active = true;
    listCourses()
      .then((data) => active && setCourses(data))
      .catch((err) => active && setError(errorMessage(err, "Gagal memuat mata kuliah.")))
      .finally(() => active && setCoursesLoading(false));
    return () => {
      active = false;
    };
  }, []);

  function clearPickedFile() {
    setFile(null);
    setFileInputKey((key) => key + 1);
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;

    const dot = picked.name.lastIndexOf(".");
    const ext = dot >= 0 ? picked.name.slice(dot).toLowerCase() : "";

    if (!FILE_EXTENSIONS.includes(ext)) {
      setError(`Jenis berkas tidak didukung. Gunakan ${FILE_EXTENSIONS.join(", ")}.`);
      clearPickedFile();
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      setError(`Berkas terlalu besar (${formatSize(picked.size)}). Maksimal ${formatSize(MAX_FILE_BYTES)}.`);
      clearPickedFile();
      return;
    }
    setError(null);
    setFile(picked);
    setRemoveFile(false);
  }

  async function handleAddCourse() {
    const name = newCourseName.trim();
    if (!name) {
      setError("Nama mata kuliah wajib diisi.");
      return;
    }
    setCourseBusy(true);
    setError(null);
    try {
      const course = await createCourse(name, newCourseCode.trim());
      setCourses((prev) =>
        [...prev, course].sort((a, b) => a.name.localeCompare(b.name, "id"))
      );
      setCourseId(course.id);
      setAddingCourse(false);
      setNewCourseName("");
      setNewCourseCode("");
    } catch (err) {
      setError(errorMessage(err, "Gagal menambah mata kuliah."));
    } finally {
      setCourseBusy(false);
    }
  }

  // Enter di kolom mata kuliah baru tidak boleh mengirim seluruh form
  function handleCourseKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleAddCourse();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmedTitle = title.trim();
    const year = academicYear.trim();
    const semesterNumber = Number(semester);
    const [startYear, endYear] = year.split("/").map(Number);

    if (!trimmedTitle) {
      setError("Judul tugas wajib diisi.");
      return;
    }
    if (!courseId) {
      setError("Pilih mata kuliah.");
      return;
    }
    if (!Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 14) {
      setError("Pilih semester antara 1 dan 14.");
      return;
    }
    if (!/^\d{4}\/\d{4}$/.test(year) || endYear !== startYear + 1) {
      setError("Tahun ajaran harus berformat 2026/2027.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveTask({
        input: {
          id,
          course_id: courseId,
          title: trimmedTitle,
          description: description.trim() || null,
          semester: semesterNumber,
          academic_year: year,
          deadline: deadline || null,
          status,
        },
        previous: task ?? null,
        newFile: file,
        removeFile,
      });
      router.push("/admin");
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan tugas."));
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`${surface} divide-y divide-slate-200 rounded-2xl shadow-sm dark:divide-slate-800`}
    >
      {/* Informasi tugas */}
      <div className="grid gap-5 p-5 sm:p-6">
        <div>
          <label htmlFor="judul" className={fieldLabel}>
            Judul tugas
          </label>
          <input
            id="judul"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Contoh: Laporan Praktikum Penjadwalan Proses CPU"
            className={field}
          />
        </div>

        <div>
          <label htmlFor="mata-kuliah" className={fieldLabel}>
            Mata kuliah
          </label>
          <div className="flex gap-2.5">
            <select
              id="mata-kuliah"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={coursesLoading}
              className={`${field} min-w-0 flex-1 cursor-pointer`}
            >
              <option value="">
                {coursesLoading ? "Memuat..." : "Pilih mata kuliah"}
              </option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code ? `${course.name} (${course.code})` : course.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setAddingCourse((open) => !open)}
              aria-expanded={addingCourse}
              className={`${btnSecondary} shrink-0`}
            >
              {addingCourse ? "Batal" : "Mata kuliah baru"}
            </button>
          </div>

          {addingCourse && (
            <div className="mt-3 grid gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_9rem_auto] dark:border-slate-700 dark:bg-slate-800/50">
              <input
                type="text"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                onKeyDown={handleCourseKey}
                aria-label="Nama mata kuliah baru"
                placeholder="Nama mata kuliah"
                className={field}
              />
              <input
                type="text"
                value={newCourseCode}
                onChange={(e) => setNewCourseCode(e.target.value)}
                onKeyDown={handleCourseKey}
                aria-label="Kode mata kuliah (opsional)"
                placeholder="Kode (opsional)"
                className={field}
              />
              <button
                type="button"
                onClick={handleAddCourse}
                disabled={courseBusy}
                className={btnPrimary}
              >
                {courseBusy ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="deskripsi" className={fieldLabel}>
            Deskripsi
          </label>
          <textarea
            id="deskripsi"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="Jelaskan isi dan ketentuan tugas. Baris kosong akan menjadi paragraf baru."
            className={fieldMultiline}
          />
        </div>
      </div>

      {/* Jadwal */}
      <div className="grid gap-5 p-5 sm:grid-cols-3 sm:p-6">
        <div>
          <label htmlFor="semester" className={fieldLabel}>
            Semester
          </label>
          <select
            id="semester"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className={`${field} cursor-pointer`}
          >
            <option value="">Pilih</option>
            {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Semester {n}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="tahun-ajaran" className={fieldLabel}>
            Tahun ajaran
          </label>
          <input
            id="tahun-ajaran"
            type="text"
            inputMode="numeric"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="2026/2027"
            className={field}
          />
        </div>

        <div>
          <label htmlFor="deadline" className={fieldLabel}>
            Batas pengumpulan
          </label>
          <input
            id="deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className={field}
          />
          <p className={fieldHint}>Boleh dikosongkan.</p>
        </div>
      </div>

      {/* Berkas */}
      <fieldset className="min-w-0 p-5 sm:p-6">
        <legend className={fieldLabel}>Berkas tugas (opsional)</legend>

        {currentFile && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800">
            <span
              className={`min-w-0 break-words font-medium ${
                removeFile
                  ? "text-slate-400 line-through dark:text-slate-500"
                  : "text-slate-800 dark:text-slate-100"
              }`}
            >
              {currentFile}
            </span>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-red-600 dark:text-red-400">
              <input
                type="checkbox"
                checked={removeFile}
                onChange={(e) => {
                  setRemoveFile(e.target.checked);
                  if (e.target.checked) clearPickedFile();
                }}
                className="h-4 w-4 accent-red-600"
              />
              Hapus berkas ini
            </label>
          </div>
        )}

        <input
          key={fileInputKey}
          type="file"
          accept={FILE_EXTENSIONS.join(",")}
          onChange={handleFile}
          className="block w-full text-sm text-slate-600 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100 dark:text-slate-300 dark:file:bg-emerald-500/10 dark:file:text-emerald-300"
        />
        <p className={fieldHint}>
          {file
            ? `Dipilih: ${file.name} (${formatSize(file.size)}).${
                currentFile ? " Berkas ini akan menggantikan berkas saat ini." : ""
              }`
            : "PDF, Word, PowerPoint, Excel, ZIP, atau TXT. Maksimal 20 MB."}
        </p>
      </fieldset>

      {/* Status */}
      <fieldset className="min-w-0 p-5 sm:p-6">
        <legend className={fieldLabel}>Status</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {STATUS_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 dark:border-slate-700 dark:hover:border-slate-600 dark:has-[:checked]:bg-emerald-500/10"
            >
              <input
                type="radio"
                name="status"
                value={option.value}
                checked={status === option.value}
                onChange={() => setStatus(option.value)}
                className="mt-1 h-4 w-4 accent-emerald-700"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  {option.hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Aksi */}
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
          >
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? "Menyimpan..." : "Simpan tugas"}
          </button>
          <Link href="/admin" className={btnSecondary}>
            Batal
          </Link>
        </div>
      </div>
    </form>
  );
}
