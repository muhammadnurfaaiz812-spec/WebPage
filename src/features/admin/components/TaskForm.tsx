"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  WORK_TYPE_LABEL,
  type Task,
  type TaskStatus,
  type WorkType,
} from "@/features/tasks/types/task";
import {
  FILE_EXTENSIONS,
  MAX_FILE_BYTES,
  createCourse,
  listCourses,
  saveTask,
  type Course,
} from "@/features/admin/services/adminService";
import { renderFilePreview } from "@/features/admin/lib/filePreview";
import PostContent from "@/features/tasks/components/PostContent";
import {
  getDocumentUrls,
  getFileExtension,
  getPreviewKind,
  getThumbnailUrl,
  type PreviewKind,
} from "@/features/tasks/lib/documents";
import {
  MOTION_CSS,
  btnPrimary,
  btnSecondary,
  delay,
  errorMessage,
  field,
  fieldHint,
  fieldLabel,
  fieldMultiline,
  focusRing,
  surface,
} from "@/features/admin/ui";

/* ────────────────────────────────────────────────────────────
   KONSTANTA & HELPER
   ──────────────────────────────────────────────────────────── */

// Tahun ajaran baru dimulai sekitar Agustus
function defaultAcademicYear() {
  const now = new Date();
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}/${start + 1}`;
}

// Pilihan tahun ajaran: 3 tahun ke belakang sampai 1 tahun ke depan, ditambah
// nilai tugas yang sedang diedit kalau berada di luar rentang itu.
function buildYearOptions(selected: string) {
  const base = Number(defaultAcademicYear().slice(0, 4));
  const years = [base - 3, base - 2, base - 1, base, base + 1].map(
    (year) => `${year}/${year + 1}`
  );
  if (selected && !years.includes(selected)) years.push(selected);
  return years.sort();
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Tanggal ISO (YYYY-MM-DD) ke teks panjang, mis. "Sabtu, 14 November 2026". */
function formatLongDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Keterangan jarak hari dari hari ini ke tanggal ISO. */
function relativeDay(iso: string) {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((new Date(iso).getTime() - today) / 86_400_000);
  if (diff > 1) return `${diff} hari lagi`;
  if (diff === 1) return "besok";
  if (diff === 0) return "hari ini";
  return `${-diff} hari yang lalu`;
}

const MAX_MB = Math.round(MAX_FILE_BYTES / 1024 / 1024);
const TITLE_MAX = 200;

const FILE_TYPES_HELP =
  "PDF, gambar (JPG, PNG, WebP, GIF), Word, PowerPoint, Excel, ZIP, atau TXT.";

// Pratinjau otomatis hanya untuk PDF dan gambar; jenis lain tidak bisa
// dirender di browser, jadi kartunya memakai sampul pengganti.
const NO_PREVIEW_NOTE =
  "Pratinjau otomatis tersedia untuk PDF dan gambar (JPG, PNG, WebP, GIF). Kartu akan tampil tanpa gambar.";

const STATUS_OPTIONS: {
  value: TaskStatus;
  label: string;
  hint: string;
  icon: IconName;
}[] = [
    {
      value: "draft",
      label: "Draft",
      hint: "Hanya terlihat olehmu. Tidak tampil di situs.",
      icon: "eyeOff",
    },
    {
      value: "published",
      label: "Dipublikasikan",
      hint: "Tampil di beranda dan bisa dibuka siapa saja.",
      icon: "globe",
    },
  ];

// Kolom wajib: id elemen, nama untuk pesan, dan urutan fokus saat validasi gagal
type FieldKey = "title" | "course" | "semester" | "year";
type FieldErrors = Partial<Record<FieldKey, string>>;

const FIELD_IDS: Record<FieldKey, string> = {
  title: "judul",
  course: "mata-kuliah",
  semester: "semester",
  year: "tahun-ajaran",
};
const FIELD_LABELS: Record<FieldKey, string> = {
  title: "Judul tugas",
  course: "Mata kuliah",
  semester: "Semester",
  year: "Tahun ajaran",
};
const FIELD_ORDER: FieldKey[] = ["title", "course", "semester", "year"];

function focusField(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  el.focus({ preventScroll: true });
}

/** id pesan (error lebih dulu, lalu petunjuk) yang dirujuk aria-describedby. */
function descId(id: string, error?: string, hint?: ReactNode) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

/* ────────────────────────────────────────────────────────────
   STYLE TOKENS (khusus form ini)
   Palet sama dengan beranda: brand emerald, netral slate, hover emerald-300,
   merah hanya untuk error dan hapus. Kontrol di dalam panel putih memakai
   slate-50; kontrol di atas panel slate-50 memakai putih.
   ──────────────────────────────────────────────────────────── */

// Tampilan kolom yang salah. Memakai varian aria-invalid supaya menang atas
// warna batas bawaan `field` (termasuk saat disorot) tanpa bergantung pada
// urutan class.
const invalidField =
  "aria-invalid:border-red-500 aria-invalid:hover:border-red-500 aria-invalid:focus:border-red-500 aria-invalid:focus:ring-red-500/15 dark:aria-invalid:border-red-400 dark:aria-invalid:hover:border-red-400 dark:aria-invalid:focus:border-red-400";

const btnSmall = `inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition duration-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 active:scale-[0.97] disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300 dark:disabled:text-slate-500 ${focusRing}`;

const btnSmallDanger = `inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition duration-200 hover:border-red-300 hover:bg-red-50 hover:text-red-700 active:scale-[0.97] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-red-500/40 dark:hover:bg-red-500/10 dark:hover:text-red-300 ${focusRing}`;

const brandTint =
  "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20";

const textMuted = "text-slate-600 dark:text-slate-400";

/* ────────────────────────────────────────────────────────────
   ANIMASI
   Keyframe ada di features/admin/ui.ts (MOTION_CSS), dipakai juga oleh
   halaman. Bagian form masuk berurutan; sisanya merespons aksi: pesan
   error, kolom salah, kartu berkas, dan pilihan status.
   Mati otomatis kalau perangkat memakai "reduce motion".
   ──────────────────────────────────────────────────────────── */

const FORM_CSS = MOTION_CSS;

/* ────────────────────────────────────────────────────────────
   IKON (inline SVG)
   Ukuran dipisah dari className ("size"), supaya className tambahan
   tidak pernah menghapus ukuran bawaan.
   ──────────────────────────────────────────────────────────── */

const ICONS = {
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m17 8-5-5-5 5M12 3v12" />
    </>
  ),
  file: (
    <>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <path d="M14 2v6h6M16 13H8M16 17H8" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </>
  ),
  x: <path d="M18 6 6 18M6 6l12 12" />,
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="m2 2 20 20" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  undo: (
    <>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </>
  ),
  trash: (
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  ),
} as const;

type IconName = keyof typeof ICONS;

function Icon({
  name,
  size = "h-4 w-4",
  className = "",
}: {
  name: IconName;
  size?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${size} ${className}`}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity=".25"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────
   KOMPONEN KECIL
   ──────────────────────────────────────────────────────────── */

/** Satu bagian form: nomor langkah, judul, penjelasan singkat. */
function Section({
  step,
  title,
  description,
  badgeClassName = "",
  children,
}: {
  step: number;
  title: string;
  description: string;
  badgeClassName?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  const order = step === 4 ? 2 : step;
  return (
    <section
      aria-labelledby={headingId}
      style={delay(120 + order * 90)}
      className="anim-fade-up p-5 sm:p-6"
    >
      <div className="mb-5 flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${brandTint} ${badgeClassName}`}
        >
          {step}
        </span>
        <div>
          <h2
            id={headingId}
            className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-50"
          >
            {title}
          </h2>
          <p className={`mt-0.5 text-sm ${textMuted}`}>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p
      id={id}
      role="alert"
      className="panel-in mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-700 dark:text-red-300"
    >
      <Icon name="alert" size="h-3.5 w-3.5" className="mt-px" />
      {message}
    </p>
  );
}

/** Label (+ penghitung opsional) + kontrol + petunjuk atau pesan error. */
function Field({
  id,
  label,
  required,
  hint,
  error,
  counter,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  counter?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={fieldLabel}>
          {label}
          {required && (
            <>
              <span
                aria-hidden="true"
                className="ml-0.5 text-red-600 dark:text-red-400"
              >
                *
              </span>
              <span className="sr-only"> (wajib diisi)</span>
            </>
          )}
        </label>
        {counter && (
          <span
            aria-hidden="true"
            className="mb-1.5 text-xs tabular-nums text-slate-500 dark:text-slate-400"
          >
            {counter}
          </span>
        )}
      </div>
      {children}
      {error ? (
        <FieldError id={`${id}-error`} message={error} />
      ) : hint ? (
        <p id={`${id}-hint`} className={fieldHint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Pilihan dengan panah buatan sendiri, sama dengan filter di beranda.
 * Panah bawaan browser berbeda-beda antar sistem dan terlalu rapat ke tepi.
 */
function SelectInput({
  className = "",
  wrapperClassName = "",
  children,
  ...props
}: ComponentPropsWithoutRef<"select"> & { wrapperClassName?: string }) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <select
        {...props}
        className={`${field} ${invalidField} peer cursor-pointer appearance-none pr-10 disabled:cursor-not-allowed ${className}`}
      >
        {children}
      </select>
      <Icon
        name="chevron"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition duration-300 peer-focus:rotate-180 peer-focus:text-emerald-600 dark:text-slate-500 dark:peer-focus:text-emerald-400"
      />
    </div>
  );
}

/** Kartu berkas: gambar pratinjau di kiri, nama dan aksi di kanan. */
function FileCard({
  thumb,
  name,
  meta,
  badge,
  actions,
  children,
}: {
  thumb: ReactNode;
  name: string;
  meta: string;
  badge?: string;
  actions: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="panel-in flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-start sm:p-4 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white sm:w-52 dark:border-slate-700 dark:bg-slate-900">
        {thumb}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 break-words text-sm font-semibold text-slate-900 dark:text-slate-50">
            {name}
          </p>
          {badge && (
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${brandTint}`}
            >
              {badge}
            </span>
          )}
        </div>
        <p className={`mt-1 text-xs ${textMuted}`}>{meta}</p>
        {children}
        <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   FORM
   ──────────────────────────────────────────────────────────── */

// Kerangka siap pakai untuk soal Disk Scheduling; admin tinggal mengganti angkanya
const DISK_TEMPLATE =
  "## Soal\n\nTulis soal di sini.\n\n## Jawaban\n\n```disk\nhead: 50\ntrack: 200\nantrean: 52, 170, 83, 170, 24, 16, 190, 6, 67, 83, 152, 24, 71, 111, 83, 123\narah: naik\nlompatan: hitung\nscan: ujung\n```\n";

export default function TaskForm({ task }: { task?: Task }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const courseNameRef = useRef<HTMLInputElement>(null);

  // Id dibuat di sisi klien agar berkas bisa diunggah ke "<id>/..." sebelum baris disimpan
  const [id] = useState(() => task?.id ?? crypto.randomUUID());
  const [title, setTitle] = useState(task?.title ?? "");
  const [courseId, setCourseId] = useState(task?.course_id ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [content, setContent] = useState(task?.content ?? "");
  const [contentPreview, setContentPreview] = useState(false);
  const [semester, setSemester] = useState(task ? String(task.semester) : "");
  const [academicYear, setAcademicYear] = useState(
    task?.academic_year ?? defaultAcademicYear()
  );
  const [yearOptions] = useState(() => buildYearOptions(academicYear));
  const [deadline, setDeadline] = useState(task?.deadline ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "draft");
  const [workType, setWorkType] = useState<WorkType>(
    task?.work_type ?? "individual"
  );

  // Nilai awal, untuk mendeteksi perubahan yang belum disimpan
  const [initial] = useState(() => ({
    title: task?.title ?? "",
    courseId: task?.course_id ?? "",
    description: task?.description ?? "",
    content: task?.content ?? "",
    semester: task ? String(task.semester) : "",
    academicYear: task?.academic_year ?? defaultAcademicYear(),
    deadline: task?.deadline ?? "",
    status: task?.status ?? "draft",
    workType: task?.work_type ?? "individual",
  }));

  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [removeFile, setRemoveFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Pratinjau baru yang akan diunggah (JPEG dari halaman 1 PDF atau dari gambar)
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(
    null
  );
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewNote, setPreviewNote] = useState<string | null>(null);
  const previewRun = useRef(0); // mengabaikan hasil render yang sudah usang

  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [addingCourse, setAddingCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseCode, setNewCourseCode] = useState("");
  const [courseBusy, setCourseBusy] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentFile = task?.document_name ?? null;
  const currentThumbUrl = getThumbnailUrl(task?.thumbnail_path);
  // "pdf", "image", atau null kalau berkas saat ini tidak bisa dibuatkan pratinjau
  const currentKind = getPreviewKind(currentFile);

  // Gambar yang akan tampil di kartu setelah disimpan
  const shownPreview =
    preview?.url ?? (file || removeFile ? undefined : currentThumbUrl);
  const canRegenerate =
    Boolean(task) &&
    currentKind !== null &&
    !file &&
    !removeFile &&
    !shownPreview &&
    !previewBusy;

  const showNew = Boolean(file);
  const showCurrent = Boolean(currentFile) && !file && !removeFile;
  const showRemoved = Boolean(currentFile) && removeFile && !file;

  const missingFields = FIELD_ORDER.filter((key) => errors[key]).map(
    (key) => FIELD_LABELS[key]
  );
  const barMessage =
    error ??
    (missingFields.length > 0
      ? `Lengkapi dulu: ${missingFields.join(", ")}.`
      : null);

  const semesterNumber = Number(semester);
  const semesterHint = semester
    ? `Semester ${semester} termasuk semester ${semesterNumber % 2 === 1 ? "Ganjil" : "Genap"}.`
    : undefined;
  const statusInfo = STATUS_OPTIONS.find((option) => option.value === status);

  const courseHint =
    !coursesLoading && !courseError && courses.length === 0
      ? "Belum ada mata kuliah. Tambahkan lewat tombol di samping."
      : undefined;

  const deadlineHint = deadline ? (
    <>
      {formatLongDate(deadline)} · {relativeDay(deadline)}.{" "}
      <button
        type="button"
        onClick={() => setDeadline("")}
        className={`rounded font-semibold text-emerald-700 hover:underline dark:text-emerald-300 ${focusRing}`}
      >
        Kosongkan
      </button>
    </>
  ) : (
    "Boleh dikosongkan."
  );

  // Ada perubahan yang belum disimpan?
  const dirty =
    title !== initial.title ||
    courseId !== initial.courseId ||
    description !== initial.description ||
    content !== initial.content ||
    semester !== initial.semester ||
    academicYear !== initial.academicYear ||
    deadline !== initial.deadline ||
    status !== initial.status ||
    workType !== initial.workType ||
    Boolean(file) ||
    removeFile;

  const submitLabel = task
    ? "Simpan perubahan"
    : status === "published"
      ? "Simpan & terbitkan"
      : "Simpan draft";

  // Lepas URL sementara saat pratinjau diganti atau form ditutup
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  useEffect(() => {
    let active = true;
    listCourses()
      .then((data) => active && setCourses(data))
      .catch(
        (err) =>
          active &&
          setCourseError(errorMessage(err, "Gagal memuat mata kuliah."))
      )
      .finally(() => active && setCoursesLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Fokus ke kolom nama saat panel "Mata kuliah baru" dibuka
  useEffect(() => {
    if (addingCourse) courseNameRef.current?.focus();
  }, [addingCourse]);

  // Peringatan browser kalau halaman ditutup atau dimuat ulang saat masih
  // ada perubahan. Mati selama proses simpan.
  useEffect(() => {
    if (!dirty || saving) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, saving]);

  // Pintasan: Ctrl/Cmd + S menyimpan tugas
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function clearError(key: FieldKey) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function clearPickedFile() {
    setFile(null);
    setFileInputKey((key) => key + 1);
    previewRun.current++;
    setPreview(null);
    setPreviewBusy(false);
    setPreviewNote(null);
  }

  async function buildPreview(source: Blob, kind: PreviewKind) {
    const run = ++previewRun.current;
    setPreviewBusy(true);
    setPreview(null);
    setPreviewNote(null);
    try {
      const blob = await renderFilePreview(source, kind);
      if (run === previewRun.current) {
        setPreview({ blob, url: URL.createObjectURL(blob) });
      }
    } catch (err) {
      if (run === previewRun.current) {
        setPreviewNote(
          `Pratinjau gagal dibuat: ${errorMessage(err, "kesalahan tidak dikenal")}. Tugas tetap bisa disimpan tanpa gambar.`
        );
      }
    } finally {
      if (run === previewRun.current) setPreviewBusy(false);
    }
  }

  // Untuk berkas yang sudah diunggah sebelum fitur pratinjau ada
  async function handleRegenerate() {
    const urls = getDocumentUrls(task?.document_path, task?.document_name);
    const kind = getPreviewKind(task?.document_name);
    if (!urls || !kind) return;

    setPreviewBusy(true);
    setPreviewNote(null);
    try {
      const res = await fetch(urls.view);
      if (!res.ok) throw new Error(`berkas tidak bisa diambil (HTTP ${res.status})`);
      await buildPreview(await res.blob(), kind);
    } catch (err) {
      setPreviewBusy(false);
      setPreviewNote(
        `Pratinjau gagal dibuat: ${errorMessage(err, "kesalahan tidak dikenal")}.`
      );
    }
  }

  // Dipakai bersama oleh pilih-berkas dan seret-lepas
  function processFile(picked: File) {
    const dot = picked.name.lastIndexOf(".");
    const ext = dot >= 0 ? picked.name.slice(dot).toLowerCase() : "";

    if (!FILE_EXTENSIONS.includes(ext)) {
      setFileError(
        `Jenis berkas tidak didukung. Gunakan ${FILE_EXTENSIONS.join(", ")}.`
      );
      clearPickedFile();
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      setFileError(
        `Berkas terlalu besar (${formatSize(picked.size)}). Maksimal ${MAX_MB} MB.`
      );
      clearPickedFile();
      return;
    }
    setFileError(null);
    setFile(picked);
    setRemoveFile(false);

    const kind = getPreviewKind(picked.name);
    if (kind) {
      void buildPreview(picked, kind);
    } else {
      previewRun.current++;
      setPreview(null);
      setPreviewBusy(false);
      setPreviewNote(NO_PREVIEW_NOTE);
    }
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) processFile(picked);
  }

  function handleDragOver(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLLabelElement>) {
    // Abaikan perpindahan antar elemen anak di dalam area yang sama
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDragging(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) processFile(dropped);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleAddCourse() {
    const name = newCourseName.trim();
    if (!name) {
      setCourseError("Nama mata kuliah wajib diisi.");
      courseNameRef.current?.focus();
      return;
    }
    setCourseBusy(true);
    setCourseError(null);
    try {
      const course = await createCourse(name, newCourseCode.trim());
      setCourses((prev) =>
        [...prev, course].sort((a, b) => a.name.localeCompare(b.name, "id"))
      );
      setCourseId(course.id);
      clearError("course");
      setAddingCourse(false);
      setNewCourseName("");
      setNewCourseCode("");
    } catch (err) {
      setCourseError(errorMessage(err, "Gagal menambah mata kuliah."));
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
    // Pintasan Ctrl+S tidak boleh menyimpan dua kali atau sebelum pratinjau siap
    if (saving || previewBusy) return;

    const trimmedTitle = title.trim();
    const year = academicYear.trim();
    const [startYear, endYear] = year.split("/").map(Number);

    const found: FieldErrors = {};
    if (!trimmedTitle) found.title = "Judul tugas wajib diisi.";
    if (!courseId) found.course = "Pilih mata kuliah.";
    if (
      !Number.isInteger(semesterNumber) ||
      semesterNumber < 1 ||
      semesterNumber > 14
    ) {
      found.semester = "Pilih semester.";
    }
    if (!/^\d{4}\/\d{4}$/.test(year) || endYear !== startYear + 1) {
      found.year = "Pilih tahun ajaran.";
    }

    setErrors(found);
    const firstInvalid = FIELD_ORDER.find((key) => found[key]);
    if (firstInvalid) {
      setError(null);
      focusField(FIELD_IDS[firstInvalid]);
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
          content: content.trim() || null,
          semester: semesterNumber,
          academic_year: year,
          deadline: deadline || null,
          status,
          work_type: workType,
        },
        previous: task ?? null,
        newFile: file,
        removeFile,
        newPreview: preview?.blob ?? null,
      });
      router.push("/admin");
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan tugas."));
      setSaving(false);
    }
  }

  /* ── Gambar kecil di kartu berkas ── */
  const activeName = file?.name ?? currentFile;
  const thumbNode = previewBusy ? (
    <div
      role="status"
      aria-label="Membuat pratinjau"
      className="h-full w-full animate-pulse bg-slate-200 dark:bg-slate-800"
    />
  ) : shownPreview ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={shownPreview}
      alt="Pratinjau berkas di kartu tugas"
      className="h-full w-full object-cover object-top"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 text-emerald-700 dark:from-emerald-500/10 dark:to-slate-800 dark:text-emerald-300">
      <Icon
        name={getPreviewKind(activeName) === "image" ? "image" : "file"}
        size="h-8 w-8"
      />
    </div>
  );

  const previewMessage = previewBusy
    ? "Membuat pratinjau..."
    : shownPreview
      ? "Gambar ini akan tampil di kartu tugas."
      : (previewNote ??
        (currentKind && !file
          ? "Berkas ini belum punya pratinjau."
          : NO_PREVIEW_NOTE));

  /* ── Area seret-lepas ── */
  const dropzone = (
    <label
      htmlFor={fileInputId}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition duration-200 active:scale-[0.995] peer-focus-visible:ring-4 peer-focus-visible:ring-emerald-500/30 ${dragging
          ? "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-500/10"
          : "border-slate-300 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/60 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/5"
        }`}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100 transition-transform duration-200 dark:bg-slate-900 dark:text-emerald-300 dark:ring-emerald-500/20 ${dragging ? "-translate-y-1 scale-110" : ""
          }`}
      >
        <Icon name="upload" size="h-5 w-5" />
      </span>
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        <span className="text-emerald-700 dark:text-emerald-300">
          {dragging ? "Lepaskan untuk memilih" : "Pilih berkas"}
        </span>{" "}
        {!dragging && "atau seret ke sini"}
      </span>
      <span className={`max-w-md text-xs leading-5 ${textMuted}`}>
        {FILE_TYPES_HELP}
      </span>
      <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
        Maksimal {MAX_MB} MB
      </span>
    </label>
  );

  return (
    // Tata letak mengikuti lebar wadahnya (container query), bukan lebar layar:
    // wadah sempit = satu kolom, wadah lebar (>= 56rem) = form + kolom samping.
    // Jadi halaman edit yang masih memakai wadah sempit tetap rapi.
    <div className="@container">
      <style>{FORM_CSS}</style>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-6 @4xl:grid @4xl:grid-cols-[minmax(0,1fr)_22rem] @4xl:items-start @4xl:gap-8"
      >
        {/* Kolom utama: bagian 1 sampai 3 */}
        <div
          className={`${surface} divide-y divide-slate-200 rounded-2xl shadow-sm dark:divide-slate-800`}
        >
          {/* ───── 1. Informasi tugas ───── */}
          <Section
            step={1}
            title="Informasi tugas"
            description="Judul, mata kuliah, dan penjelasan singkat yang tampil di kartu."
          >
            <div className="grid gap-5">
              <Field
                id="judul"
                label="Judul tugas"
                required
                error={errors.title}
                counter={`${title.length}/${TITLE_MAX}`}
              >
                <input
                  id="judul"
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    clearError("title");
                  }}
                  maxLength={TITLE_MAX}
                  placeholder="Contoh: Laporan Praktikum Penjadwalan Proses CPU"
                  aria-invalid={errors.title ? true : undefined}
                  aria-describedby={descId("judul", errors.title)}
                  className={`${field} ${invalidField}`}
                />
              </Field>

              <div>
                <Field
                  id="mata-kuliah"
                  label="Mata kuliah"
                  required
                  error={errors.course}
                  hint={courseHint}
                >
                  {/* Di layar sempit bertumpuk; sm ke atas sebaris.
                      "sm:flex-1" (bukan "flex-1") supaya tinggi pilihan
                      tidak menyusut saat bertumpuk. */}
                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <SelectInput
                      id="mata-kuliah"
                      wrapperClassName="min-w-0 sm:flex-1"
                      value={courseId}
                      onChange={(e) => {
                        setCourseId(e.target.value);
                        clearError("course");
                      }}
                      disabled={coursesLoading}
                      aria-invalid={errors.course ? true : undefined}
                      aria-describedby={descId(
                        "mata-kuliah",
                        errors.course,
                        courseHint
                      )}
                    >
                      <option value="">
                        {coursesLoading ? "Memuat..." : "Pilih mata kuliah"}
                      </option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.code
                            ? `${course.name} (${course.code})`
                            : course.name}
                        </option>
                      ))}
                    </SelectInput>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingCourse((open) => !open);
                        setCourseError(null);
                      }}
                      aria-expanded={addingCourse}
                      aria-controls="panel-mata-kuliah-baru"
                      className={`${btnSecondary} shrink-0 gap-1.5 whitespace-nowrap`}
                    >
                      <Icon name={addingCourse ? "x" : "plus"} />
                      {addingCourse ? "Batal" : "Mata kuliah baru"}
                    </button>
                  </div>
                </Field>

                {addingCourse && (
                  <div
                    id="panel-mata-kuliah-baru"
                    className={`panel-in mt-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700`}
                  >
                    <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Tambah mata kuliah baru
                    </p>
                    <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
                      <input
                        ref={courseNameRef}
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
                        {courseBusy && <Spinner />}
                        {courseBusy ? "Menyimpan..." : "Simpan"}
                      </button>
                    </div>
                  </div>
                )}

                {courseError && (
                  <FieldError
                    id="mata-kuliah-baru-error"
                    message={courseError}
                  />
                )}
              </div>

              <Field
                id="deskripsi"
                label="Deskripsi"
                hint="Jelaskan isi dan ketentuan tugas. Baris kosong akan menjadi paragraf baru."
              >
                <textarea
                  id="deskripsi"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  aria-describedby="deskripsi-hint"
                  className={`${fieldMultiline} resize-y`}
                />
              </Field>

              <Field
                id="isi-posting"
                label="Isi posting (opsional)"
                hint={
                  <>
                    Mendukung Markdown: judul <code>##</code>, tabel, daftar, dan gambar.
                    Blok <code>```disk</code> membuat tabel dan grafik Disk Scheduling
                    otomatis dari data soal.
                  </>
                }
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div
                    role="group"
                    aria-label="Mode isi posting"
                    className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800"
                  >
                    {([false, true] as const).map((preview) => (
                      <button
                        key={String(preview)}
                        type="button"
                        aria-pressed={contentPreview === preview}
                        onClick={() => setContentPreview(preview)}
                        className={`rounded-md px-3 py-1 text-xs font-semibold transition ${contentPreview === preview
                            ? "bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-300"
                            : "text-slate-600 hover:text-emerald-800 dark:text-slate-400 dark:hover:text-emerald-300"
                          }`}
                      >
                        {preview ? "Pratinjau" : "Tulis"}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setContent(
                        (prev) => (prev.trim() ? prev.trimEnd() + "\n\n" : "") + DISK_TEMPLATE
                      )
                    }
                    className={`${btnSecondary} !h-9 !px-3 text-xs`}
                  >
                    Sisipkan template Disk Scheduling
                  </button>
                </div>

                {contentPreview ? (
                  <div className="min-h-[10rem] rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                    {content.trim() ? (
                      <PostContent source={content} />
                    ) : (
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Belum ada isi untuk dipratinjau.
                      </p>
                    )}
                  </div>
                ) : (
                  <textarea
                    id="isi-posting"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={14}
                    spellCheck={false}
                    aria-describedby="isi-posting-hint"
                    className={`${fieldMultiline} resize-y font-mono text-[13px]`}
                  />
                )}
              </Field>
            </div>
          </Section>

          {/* ───── 2. Jadwal dan jenis ───── */}
          <Section
            step={2}
            title="Jadwal dan jenis"
            description="Kapan tugas ini berlaku dan bagaimana pengerjaannya."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="semester"
                label="Semester"
                required
                hint={semesterHint}
                error={errors.semester}
              >
                <SelectInput
                  id="semester"
                  value={semester}
                  onChange={(e) => {
                    setSemester(e.target.value);
                    clearError("semester");
                  }}
                  aria-invalid={errors.semester ? true : undefined}
                  aria-describedby={descId(
                    "semester",
                    errors.semester,
                    semesterHint
                  )}
                >
                  <option value="">Pilih semester</option>
                  {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      Semester {n}
                    </option>
                  ))}
                </SelectInput>
              </Field>

              <Field
                id="tahun-ajaran"
                label="Tahun ajaran"
                required
                error={errors.year}
              >
                <SelectInput
                  id="tahun-ajaran"
                  value={academicYear}
                  onChange={(e) => {
                    setAcademicYear(e.target.value);
                    clearError("year");
                  }}
                  aria-invalid={errors.year ? true : undefined}
                  aria-describedby={descId("tahun-ajaran", errors.year)}
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </SelectInput>
              </Field>

              <Field
                id="deadline"
                label="Batas pengumpulan"
                hint={deadlineHint}
              >
                <input
                  id="deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  aria-describedby="deadline-hint"
                  className={field}
                />
              </Field>

              <Field
                id="jenis-tugas"
                label="Jenis tugas"
                hint="Tampil sebagai lencana di kartu tugas."
              >
                <SelectInput
                  id="jenis-tugas"
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value as WorkType)}
                  aria-describedby="jenis-tugas-hint"
                >
                  {(Object.keys(WORK_TYPE_LABEL) as WorkType[]).map((value) => (
                    <option key={value} value={value}>
                      {WORK_TYPE_LABEL[value]}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
          </Section>

          {/* ───── 3. Berkas ───── */}
          <Section
            step={3}
            title="Berkas tugas"
            description="Opsional. Tanpa berkas, tombol Unduh di kartu akan nonaktif."
          >
            {/* Input asli disembunyikan; area seret-lepas dan tombol memicunya */}
            <input
              key={fileInputKey}
              ref={fileInputRef}
              id={fileInputId}
              type="file"
              accept={FILE_EXTENSIONS.join(",")}
              onChange={handleFileInput}
              className="peer sr-only"
            />

            {showNew && file && (
              <FileCard
                thumb={thumbNode}
                name={file.name}
                meta={`${getFileExtension(file.name) ?? "Berkas"} • ${formatSize(file.size)}`}
                badge="Baru"
                actions={
                  <>
                    <button
                      type="button"
                      onClick={openFilePicker}
                      className={btnSmall}
                    >
                      <Icon name="refresh" size="h-3.5 w-3.5" />
                      Ganti
                    </button>
                    <button
                      type="button"
                      onClick={clearPickedFile}
                      className={btnSmallDanger}
                    >
                      <Icon name="x" size="h-3.5 w-3.5" />
                      Batalkan
                    </button>
                  </>
                }
              >
                <p
                  aria-live="polite"
                  className={`mt-2 text-xs leading-5 ${textMuted}`}
                >
                  {previewMessage}
                  {currentFile &&
                    ` Berkas ini akan menggantikan ${currentFile} saat disimpan.`}
                </p>
              </FileCard>
            )}

            {showCurrent && currentFile && (
              <FileCard
                thumb={thumbNode}
                name={currentFile}
                meta={`${getFileExtension(currentFile) ?? "Berkas"} • Berkas saat ini`}
                actions={
                  <>
                    <button
                      type="button"
                      onClick={openFilePicker}
                      className={btnSmall}
                    >
                      <Icon name="refresh" size="h-3.5 w-3.5" />
                      Ganti
                    </button>
                    {canRegenerate && (
                      <button
                        type="button"
                        onClick={handleRegenerate}
                        className={btnSmall}
                      >
                        <Icon name="image" size="h-3.5 w-3.5" />
                        Buat pratinjau
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setRemoveFile(true)}
                      className={btnSmallDanger}
                    >
                      <Icon name="trash" size="h-3.5 w-3.5" />
                      Hapus
                    </button>
                  </>
                }
              >
                <p
                  aria-live="polite"
                  className={`mt-2 text-xs leading-5 ${textMuted}`}
                >
                  {previewMessage}
                </p>
              </FileCard>
            )}

            {showRemoved && currentFile && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
                <span className="min-w-0 break-words">
                  Berkas <strong>{currentFile}</strong> akan dihapus saat tugas
                  disimpan.
                </span>
                <button
                  type="button"
                  onClick={() => setRemoveFile(false)}
                  className={btnSmall}
                >
                  <Icon name="undo" size="h-3.5 w-3.5" />
                  Urungkan
                </button>
              </div>
            )}

            {(showRemoved || (!showNew && !showCurrent)) && dropzone}

            {fileError && <FieldError id="berkas-error" message={fileError} />}
          </Section>
        </div>

        {/* Kolom samping. Di wadah sempit "contents" membuat isinya mengalir
            biasa di bawah kolom utama; di wadah lebar menjadi kolom yang menempel. */}
        <div className="contents @4xl:sticky @4xl:top-24 @4xl:flex @4xl:flex-col @4xl:gap-4">
          <div className={`${surface} rounded-2xl shadow-sm`}>
            {/* ───── 4. Publikasi ─────
                Nomor langkah disembunyikan di kolom samping (wadah lebar),
                karena di sana kartu ini muncul paling atas, bukan terakhir. */}
            <Section
              step={4}
              title="Publikasi"
              description="Draft bisa disimpan dulu dan dipublikasikan nanti."
              badgeClassName="@4xl:hidden"
            >
              <fieldset className="min-w-0">
                <legend className="sr-only">Status publikasi</legend>
                <div className="grid gap-3 @2xl:grid-cols-2 @4xl:grid-cols-1">
                  {STATUS_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4 transition duration-200 active:scale-[0.985] hover:border-emerald-300 has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 has-[:checked]:ring-1 has-[:checked]:ring-emerald-600/20 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-emerald-500/30 dark:border-slate-700 dark:hover:border-emerald-500/40 dark:has-[:checked]:border-emerald-500 dark:has-[:checked]:bg-emerald-500/10"
                    >
                      <input
                        type="radio"
                        name="status"
                        value={option.value}
                        checked={status === option.value}
                        onChange={() => setStatus(option.value)}
                        className="mt-1 h-4 w-4 shrink-0 accent-emerald-700"
                      />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-50">
                          <span
                            key={String(status === option.value)}
                            className={`inline-flex ${status === option.value ? "anim-pop" : ""
                              }`}
                          >
                            <Icon
                              name={option.icon}
                              className={
                                status === option.value
                                  ? "text-emerald-700 dark:text-emerald-300"
                                  : "text-slate-500 dark:text-slate-400"
                              }
                            />
                          </span>
                          {option.label}
                        </span>
                        <span
                          className={`mt-1 block text-xs leading-5 ${textMuted}`}
                        >
                          {option.hint}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </Section>
          </div>

          {/* Aksi: menempel di bawah layar di wadah sempit (menghormati area
              aman ponsel); kartu terpisah di kolom samping saat lebar */}
          <div className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-lg shadow-slate-900/10 backdrop-blur-md sm:p-4 @4xl:static @4xl:p-5 @4xl:shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
            {barMessage && (
              <p
                role="alert"
                className="panel-in mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
              >
                <Icon name="alert" className="mt-0.5" />
                {barMessage}
              </p>
            )}

            <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:justify-between @4xl:flex-col @4xl:items-stretch">
              <p
                className={`hidden min-w-0 truncate text-xs @2xl:block @4xl:hidden ${textMuted}`}
              >
                Status:{" "}
                <strong className="font-semibold text-slate-800 dark:text-slate-200">
                  {statusInfo?.label}
                </strong>
                . {statusInfo?.hint}
              </p>

              {/* Simpan lebih dulu di DOM (urutan Tab yang wajar). Tampilannya:
                  Batal di kiri, Simpan di kanan; di kolom samping Simpan di atas. */}
              <div className="flex flex-row-reverse gap-3 @4xl:flex-col">
                <button
                  type="submit"
                  disabled={saving || previewBusy}
                  className={`${btnPrimary} min-w-0 flex-1 @2xl:flex-none @4xl:flex-none`}
                >
                  {saving && <Spinner />}
                  <span className="truncate">
                    {saving
                      ? "Menyimpan..."
                      : previewBusy
                        ? "Menyiapkan pratinjau..."
                        : submitLabel}
                  </span>
                </button>
                <Link
                  href="/admin"
                  className={`${btnSecondary} shrink-0 @4xl:shrink`}
                >
                  Batal
                </Link>
              </div>

              {/* Hanya di kolom samping: penanda perubahan + pintasan */}
              <div className="hidden flex-col gap-1.5 text-center text-xs @4xl:flex">
                {dirty && !saving && (
                  <p
                    role="status"
                    className="panel-in inline-flex items-center justify-center gap-1.5 font-medium text-slate-700 dark:text-slate-300"
                  >
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-amber-500 motion-safe:animate-pulse"
                    />
                    Ada perubahan yang belum disimpan
                  </p>
                )}
                <p className="text-slate-500 dark:text-slate-400">
                  Pintasan: Ctrl/⌘ + S
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}