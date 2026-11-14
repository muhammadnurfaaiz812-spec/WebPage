"use client";

/* Halaman daftar tugas admin (/admin). Butuh admin-ui.ts versi terbaru. */

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  WORK_TYPE_LABEL,
  type Task,
  type TaskStatus,
} from "@/features/tasks/types/task";
import {
  deleteTask,
  listAllTasks,
  setTaskStatus,
} from "@/features/admin/services/adminService";
import {
  MOTION_CSS,
  btnPrimary,
  delay,
  errorMessage,
  focusRing,
  focusRingOnDark,
  formatDate,
  heroBtnSolid,
  heroChip,
  surface,
} from "@/features/admin/ui";

type Filter = "all" | TaskStatus;

/* ────────────────────────────────────────────────────────────
   IKON (inline SVG, tanpa dependensi tambahan)
   Ukuran dipisah dari className ("size"), jadi className tambahan
   (posisi absolut, warna, dll.) tidak pernah menghapus ukuran bawaan.
   Itulah penyebab ikon pencarian membesar sebelumnya.
   ──────────────────────────────────────────────────────────── */

const ICONS = {
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  x: <path d="M18 6 6 18M6 6l12 12" />,
  tick: <path d="m5 12 5 5L20 7" />,
  pencil: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  external: (
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  layers: (
    <>
      <path d="m12 2 10 5-10 5L2 7l10-5Z" />
      <path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
    </>
  ),
  user: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
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

function Spinner({ size = "h-4 w-4" }: { size?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 animate-spin motion-reduce:animate-none ${size}`}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth={3}
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────
   ANIMASI
   Keyframe bersama (banner, filter, badge) ada di MOTION_CSS pada
   features/admin/ui.ts. Di sini hanya yang khusus halaman ini:
   - Baris baru memudar masuk (saat filter atau pencarian berubah)
   - Toast naik dari bawah setelah aksi berhasil
   - Saklar status, ikon, dan tombol merespons langsung
   Otomatis mati kalau perangkat memakai "reduce motion".
   ──────────────────────────────────────────────────────────── */

const ADMIN_CSS = `
@keyframes rowIn{from{opacity:0}to{opacity:1}}
@keyframes toastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.row-in{animation:rowIn .35s ease-out both}
.toast-in{animation:toastIn .35s cubic-bezier(.22,1,.36,1) both}
@media (prefers-reduced-motion:reduce){
  .row-in,.toast-in{animation:none!important}
}
`;

const rowDelay = (index: number): CSSProperties => ({
  animationDelay: `${Math.min(index, 8) * 30}ms`,
});

/* ────────────────────────────────────────────────────────────
   PALET WARNA (sama dengan beranda dan halaman detail)
   - Brand  : emerald. Solid 700 (hover 800). Tint 50 dengan teks 800.
   - Netral : slate. Kontrol di atas latar halaman = putih; kontrol di
              dalam panel putih = slate-50. Batas 200 / 700.
   - Hover  : semua kontrol interaktif berubah ke emerald-300.
   - Merah  : hanya untuk hapus dan pesan error.
   Tombol di baris punya tiga tingkat:
   1. Edit            : berbingkai (aksi utama)
   2. Lihat, Hapus    : tombol ikon; Hapus merah
   3. Terbit / Draft  : saklar di kolom Status
   ──────────────────────────────────────────────────────────── */

const actionBase = `inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition duration-200 active:scale-95 disabled:cursor-not-allowed ${focusRing}`;

const actionNeutral = `${actionBase} border-slate-200 bg-slate-50 px-3 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300`;

const actionDanger = `${actionBase} border-red-600 bg-red-600 px-3 text-white hover:border-red-700 hover:bg-red-700 disabled:opacity-70 dark:border-red-500 dark:bg-red-500 dark:hover:border-red-600 dark:hover:bg-red-600`;

const iconBase = `${actionBase} w-9 border-transparent`;

const iconNeutral = `${iconBase} text-slate-600 hover:bg-emerald-50 hover:text-emerald-800 dark:text-slate-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300`;

const iconOff = `${iconBase} text-slate-300 dark:text-slate-600`;

const iconRed = `${iconBase} text-red-600 hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-500/10`;

const searchInput =
  "h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 hover:border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:hover:border-emerald-500/40 dark:focus:border-emerald-500 dark:[color-scheme:dark] [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none";

const titleLink = `line-clamp-2 rounded font-semibold leading-snug text-slate-900 transition-colors hover:text-emerald-700 dark:text-slate-50 dark:hover:text-emerald-300 ${focusRing}`;

const textMuted = "text-slate-600 dark:text-slate-400";

const rowTone = (confirming: boolean) =>
  `transition-colors ${
    confirming
      ? "bg-red-50/70 dark:bg-red-500/5"
      : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
  }`;

const LIST_CLASS = `${surface} divide-y divide-slate-200 overflow-hidden rounded-2xl shadow-sm dark:divide-slate-800`;

// Daftar bertumpuk (di bawah 1280px). Di bawah lg: info di atas, lalu satu
// baris bawah berisi saklar status (kiri) dan aksi (kanan). Mulai lg jadi
// tiga kolom: info (lentur) | status (tetap) | aksi.
const ROW_GRID =
  "grid gap-3 p-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_11rem_auto] lg:items-center lg:gap-x-6";

/* ────────────────────────────────────────────────────────────
   TABEL ATAU DAFTAR?
   Mulai 1280px (breakpoint xl Tailwind) dipakai tabel dengan judul
   kolom. Di bawah itu dipakai daftar bertumpuk. Hanya satu yang
   dirender sekaligus, jadi tidak ada elemen ganda di DOM.
   ──────────────────────────────────────────────────────────── */

const WIDE_QUERY = "(min-width: 1280px)";

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const getWideSnapshot = () => window.matchMedia(WIDE_QUERY).matches;
const getServerWideSnapshot = () => false;

function useIsWide() {
  return useSyncExternalStore(
    subscribeWide,
    getWideSnapshot,
    getServerWideSnapshot
  );
}

/* ────────────────────────────────────────────────────────────
   KOMPONEN BERSAMA (dipakai tabel dan daftar)
   ──────────────────────────────────────────────────────────── */

type RowProps = {
  task: Task;
  busy: boolean;
  confirming: boolean;
  onToggle: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
};

/**
 * Saklar status. Menggantikan lencana + tombol "Jadikan draft/Terbitkan"
 * yang sebelumnya memakan dua tempat dan membuat aksi terbungkus ke baris
 * kedua. Satu kontrol menunjukkan status sekaligus mengubahnya.
 */
function StatusToggle({
  task,
  busy,
  onToggle,
}: Pick<RowProps, "task" | "busy" | "onToggle">) {
  const published = task.status === "published";

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={published}
        aria-label={`${published ? "Jadikan draft" : "Terbitkan"}: ${task.title}`}
        title={published ? "Klik untuk jadikan draft" : "Klik untuk terbitkan"}
        disabled={busy}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:cursor-wait ${focusRing} ${
          published
            ? "bg-emerald-700 dark:bg-emerald-600"
            : "bg-slate-300 dark:bg-slate-600"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
            published ? "translate-x-5" : "translate-x-0"
          }`}
        >
          {busy && <Spinner size="h-3 w-3 text-slate-500" />}
        </span>
      </button>
      <span
        className={`whitespace-nowrap text-xs font-semibold ${
          published
            ? "text-emerald-800 dark:text-emerald-300"
            : "text-slate-600 dark:text-slate-400"
        }`}
      >
        {published ? "Dipublikasikan" : "Draft"}
      </span>
    </div>
  );
}

function MetaItem({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon
        name={icon}
        size="h-3.5 w-3.5"
        className="text-slate-400 dark:text-slate-500"
      />
      {children}
    </span>
  );
}

/** Edit, lihat di situs, hapus. Lebarnya tetap, jadi baris selalu sejajar. */
function RowActions({
  task,
  busy,
  onAskDelete,
  className = "",
}: Pick<RowProps, "task" | "busy" | "onAskDelete"> & { className?: string }) {
  const published = task.status === "published";

  return (
    <div className={`flex items-center justify-end gap-1.5 ${className}`}>
      <Link href={`/admin/tugas/${task.id}`} className={actionNeutral}>
        <Icon name="pencil" size="h-3.5 w-3.5" />
        Edit
      </Link>

      {published ? (
        <Link
          href={`/tugas/${task.id}`}
          target="_blank"
          rel="noopener"
          title="Lihat di situs (tab baru)"
          aria-label={`Lihat ${task.title} di situs, tab baru`}
          className={iconNeutral}
        >
          <Icon name="external" />
        </Link>
      ) : (
        // Draft belum punya halaman publik. Tombolnya tetap ada (nonaktif)
        // supaya posisi tombol lain sama di semua baris.
        <button
          type="button"
          disabled
          title="Draft belum punya halaman publik"
          aria-label="Lihat di situs (tidak tersedia untuk draft)"
          className={iconOff}
        >
          <Icon name="external" />
        </button>
      )}

      <button
        type="button"
        disabled={busy}
        title="Hapus"
        aria-label={`Hapus ${task.title}`}
        onClick={onAskDelete}
        className={iconRed}
      >
        <Icon name="trash" />
      </button>
    </div>
  );
}

/** Konfirmasi hapus: menggantikan seluruh isi baris, tinggi baris tetap wajar. */
function ConfirmDelete({
  task,
  busy,
  onCancelDelete,
  onConfirmDelete,
}: Pick<RowProps, "task" | "busy" | "onCancelDelete" | "onConfirmDelete">) {
  return (
    <div
      role="group"
      aria-label={`Konfirmasi hapus ${task.title}`}
      // Esc membatalkan konfirmasi hapus
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancelDelete();
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
          <Icon name="alert" size="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            Hapus tugas ini?
          </p>
          <p
            title={task.title}
            className="mt-0.5 line-clamp-1 text-xs text-red-700 dark:text-red-300/80"
          >
            {task.title} · tidak dapat dibatalkan
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        {/* Fokus awal di "Batal": Enter tidak sengaja tidak menghapus */}
        <button
          type="button"
          autoFocus
          disabled={busy}
          onClick={onCancelDelete}
          className={actionNeutral}
        >
          Batal
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirmDelete}
          className={actionDanger}
        >
          {busy && <Spinner size="h-3.5 w-3.5" />}
          {busy ? "Menghapus..." : "Ya, hapus"}
        </button>
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <li aria-hidden="true" className={`${ROW_GRID} animate-pulse`}>
      <div className="min-w-0">
        <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 flex gap-4">
          <div className="h-3 w-28 rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-3 w-20 rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-3 w-24 rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 lg:contents">
        <div className="h-6 w-36 rounded-full bg-slate-100 dark:bg-slate-800" />
        <div className="flex gap-2">
          <div className="h-9 w-16 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    </li>
  );
}

/* ────────────────────────────────────────────────────────────
   DAFTAR BERTUMPUK (di bawah 1280px)
   ──────────────────────────────────────────────────────────── */

function TaskList({
  tasks,
  rowProps,
}: {
  tasks: Task[];
  rowProps: (task: Task) => RowProps;
}) {
  return (
    <ul className={LIST_CLASS}>
      {tasks.map((task, index) => {
        const props = rowProps(task);
        return (
          <li
            key={task.id}
            aria-busy={props.busy}
            style={rowDelay(index)}
            className={`row-in ${rowTone(props.confirming)}`}
          >
            {props.confirming ? (
              <div className="p-4 sm:px-5">
                <ConfirmDelete {...props} />
              </div>
            ) : (
              <div className={ROW_GRID}>
                {/* Judul + metadata */}
                <div className="min-w-0">
                  <Link
                    href={`/admin/tugas/${task.id}`}
                    title={task.title}
                    className={`${titleLink} text-[15px]`}
                  >
                    {task.title}
                  </Link>
                  <p
                    className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs ${textMuted}`}
                  >
                    <MetaItem icon="book">
                      {task.courses?.name ?? "Tanpa mata kuliah"}
                    </MetaItem>
                    <MetaItem icon="layers">Semester {task.semester}</MetaItem>
                    <MetaItem icon="user">
                      {WORK_TYPE_LABEL[task.work_type] ?? "Individu"}
                    </MetaItem>
                    <MetaItem icon="calendar">
                      {task.deadline
                        ? `Batas ${formatDate(task.deadline)}`
                        : "Tanpa batas waktu"}
                    </MetaItem>
                  </p>
                </div>

                {/* Di bawah lg: satu baris bawah. Mulai lg: dua kolom grid */}
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 lg:contents">
                  <StatusToggle
                    task={task}
                    busy={props.busy}
                    onToggle={props.onToggle}
                  />
                  <RowActions
                    task={task}
                    busy={props.busy}
                    onAskDelete={props.onAskDelete}
                  />
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ────────────────────────────────────────────────────────────
   TABEL (mulai 1280px)
   Lima kolom. Mata kuliah dan semester digabung sebagai baris kedua di
   bawah judul (pola yang umum di panel admin), jadi kolom judul
   mendapat sisa lebar paling besar dan jarang terpotong.
   Lebar kolom tetap (rem): 7 + 9 + 11 + 12 = 39, sisanya judul.
   ──────────────────────────────────────────────────────────── */

const thBase =
  "px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400";
const tdBase = "px-3 py-3.5 align-middle text-sm";
const tdText = `${tdBase} text-slate-700 dark:text-slate-300`;

function TaskTable({
  tasks,
  rowProps,
}: {
  tasks: Task[];
  rowProps: (task: Task) => RowProps;
}) {
  return (
    <div className={`${surface} overflow-hidden rounded-2xl shadow-sm`}>
      <table className="w-full table-fixed text-left">
        <caption className="sr-only">Daftar tugas</caption>
        <colgroup>
          <col />
          <col className="w-28" />
          <col className="w-36" />
          <col className="w-44" />
          <col className="w-48" />
        </colgroup>

        <thead className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/40">
          <tr>
            <th scope="col" className={`${thBase} pl-5`}>
              Judul
            </th>
            <th scope="col" className={thBase}>
              Jenis
            </th>
            <th scope="col" className={thBase}>
              Batas
            </th>
            <th scope="col" className={thBase}>
              Status
            </th>
            <th scope="col" className={`${thBase} pr-5 text-right`}>
              Aksi
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {tasks.map((task, index) => {
            const props = rowProps(task);
            return (
              <tr
                key={task.id}
                aria-busy={props.busy}
                style={rowDelay(index)}
                className={`row-in ${rowTone(props.confirming)}`}
              >
                {props.confirming ? (
                  <td colSpan={5} className="px-5 py-3.5">
                    <ConfirmDelete {...props} />
                  </td>
                ) : (
                  <>
                    <td className={`${tdBase} pl-5`}>
                      <Link
                        href={`/admin/tugas/${task.id}`}
                        title={task.title}
                        className={`${titleLink} text-sm`}
                      >
                        {task.title}
                      </Link>
                      <p
                        className={`mt-1 flex min-w-0 items-center gap-x-2 text-xs ${textMuted}`}
                      >
                        <span className="min-w-0 truncate">
                          {task.courses?.name ?? "Tanpa mata kuliah"}
                        </span>
                        <span
                          aria-hidden="true"
                          className="text-slate-300 dark:text-slate-600"
                        >
                          •
                        </span>
                        <span className="shrink-0">Semester {task.semester}</span>
                      </p>
                    </td>
                    <td className={tdText}>
                      {WORK_TYPE_LABEL[task.work_type] ?? "Individu"}
                    </td>
                    <td className={`${tdText} whitespace-nowrap tabular-nums`}>
                      {task.deadline ? (
                        formatDate(task.deadline)
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">
                          Tanpa batas
                        </span>
                      )}
                    </td>
                    <td className={tdBase}>
                      <StatusToggle
                        task={task}
                        busy={props.busy}
                        onToggle={props.onToggle}
                      />
                    </td>
                    <td className={`${tdBase} pr-5`}>
                      <RowActions
                        task={task}
                        busy={props.busy}
                        onAskDelete={props.onAskDelete}
                      />
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   HALAMAN
   ──────────────────────────────────────────────────────────── */

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const isWide = useIsWide();

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

  // Pintasan: tekan "/" untuk langsung mengetik di kolom pencarian
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
      ) {
        return;
      }
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

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

  function notify(text: string) {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }

  const counts = useMemo(
    () => ({
      all: tasks.length,
      published: tasks.filter((t) => t.status === "published").length,
      draft: tasks.filter((t) => t.status === "draft").length,
    }),
    [tasks]
  );

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return tasks.filter((t) => {
      const matchesStatus = filter === "all" || t.status === filter;
      const matchesQuery =
        keyword === "" ||
        t.title.toLowerCase().includes(keyword) ||
        (t.courses?.name ?? "").toLowerCase().includes(keyword);
      return matchesStatus && matchesQuery;
    });
  }, [tasks, filter, query]);

  async function handleToggle(task: Task) {
    const next: TaskStatus = task.status === "published" ? "draft" : "published";
    setBusyId(task.id);
    setActionError(null);
    try {
      await setTaskStatus(task.id, next);
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: next } : t))
      );
      notify(
        next === "published"
          ? "Tugas dipublikasikan."
          : "Tugas dijadikan draft."
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
      notify("Tugas dihapus.");
    } catch (err) {
      setActionError(errorMessage(err, "Gagal menghapus tugas."));
    } finally {
      setBusyId(null);
    }
  }

  // Props baris yang sama untuk tabel maupun daftar
  function rowProps(task: Task): RowProps {
    return {
      task,
      busy: busyId === task.id,
      confirming: confirmId === task.id,
      onToggle: () => handleToggle(task),
      onAskDelete: () => {
        setActionError(null);
        setConfirmId(task.id);
      },
      onCancelDelete: () => setConfirmId(null),
      onConfirmDelete: () => handleDelete(task),
    };
  }

  const tabs: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "Semua", count: counts.all },
    { value: "published", label: "Dipublikasikan", count: counts.published },
    { value: "draft", label: "Draft", count: counts.draft },
  ];

  const showFooter = !loading && !error && tasks.length > 0;

  // Angka ringkasan di banner: tanda "–" selama data dimuat
  const stat = (value: number) => (loading ? "–" : value);

  return (
    <>
      <style>{MOTION_CSS + ADMIN_CSS}</style>

      {/* ───── BANNER JUDUL + AKSI UTAMA ─────
          Gradasi hijau yang sama dengan beranda, halaman detail, dan halaman
          "Tugas baru". "Tugas baru" memakai tombol putih penuh (aksi utama),
          ringkasan memakai pil datar (hanya informasi, tidak bisa diklik). */}
      <header
        aria-labelledby="judul-halaman"
        onPointerMove={handleBannerMove}
        onPointerLeave={handleBannerLeave}
        className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 p-5 text-white shadow-lg shadow-emerald-950/20 sm:rounded-3xl sm:p-8 dark:via-emerald-950 dark:to-emerald-900"
      >
        <div
          aria-hidden="true"
          className="parallax pointer-events-none absolute -right-16 -top-24 -z-10 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl"
          style={{
            transform:
              "translate3d(calc(var(--px, 0) * -28px), calc(var(--py, 0) * -28px), 0)",
          }}
        />

        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
          <div className="min-w-0">
            <div
              className="anim-fade-up flex items-center gap-3 sm:gap-4"
              style={delay(0)}
            >
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/20 sm:h-12 sm:w-12"
              >
                <Icon name="layers" size="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <h1
                id="judul-halaman"
                className="text-3xl font-extrabold tracking-tight sm:text-4xl"
              >
                Kelola tugas
              </h1>
            </div>
            <p
              className="anim-fade-up mt-3 max-w-2xl text-sm leading-6 text-emerald-50/90 sm:text-base sm:leading-7"
              style={delay(90)}
            >
              Tambah, ubah, dan terbitkan tugas yang tampil di situs publik.
            </p>
          </div>

          <Link
            href="/admin/tugas/baru"
            style={delay(170)}
            className={`anim-fade-up group/new ${heroBtnSolid} ${focusRingOnDark}`}
          >
            <Icon
              name="plus"
              className="transition-transform duration-200 group-hover/new:rotate-90"
            />
            Tugas baru
          </Link>
        </div>

        <ul
          aria-label="Ringkasan tugas"
          className="anim-fade-up mt-5 flex flex-wrap gap-2"
          style={delay(250)}
        >
          <li className={heroChip}>
            <span className="font-bold tabular-nums text-white">
              {stat(counts.all)}
            </span>{" "}
            tugas
          </li>
          <li className={heroChip}>
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-emerald-300"
            />
            <span className="font-bold tabular-nums text-white">
              {stat(counts.published)}
            </span>{" "}
            dipublikasikan
          </li>
          <li className={heroChip}>
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-white/50"
            />
            <span className="font-bold tabular-nums text-white">
              {stat(counts.draft)}
            </span>{" "}
            draft
          </li>
        </ul>
      </header>

      {/* ───── FILTER STATUS + PENCARIAN ─────
          Tab di kiri, pencarian di kanan (desktop). Di mobile pencarian
          turun ke baris sendiri supaya selebar layar. */}
      <div
        className="anim-fade-up mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        style={delay(330)}
      >
        <div
          role="group"
          aria-label="Filter status"
          className="flex flex-wrap gap-2"
        >
          {tabs.map((tab) => {
            const active = filter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                aria-pressed={active}
                className={`inline-flex h-10 items-center gap-2 rounded-full pl-4 pr-2 text-sm font-semibold transition duration-200 active:scale-95 ${focusRing} ${
                  active
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:text-emerald-800 hover:ring-emerald-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:text-emerald-300 dark:hover:ring-emerald-500/40"
                }`}
              >
                {tab.label}
                {/* key = angka: lencana memantul setiap kali jumlahnya berubah */}
                <span
                  key={tab.count}
                  className={`anim-pop min-w-[1.75rem] rounded-full px-2 py-0.5 text-center text-xs font-bold tabular-nums transition-colors ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="group relative w-full sm:w-80">
          <label htmlFor="cari-tugas-admin" className="sr-only">
            Cari tugas
          </label>
          <Icon
            name="search"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition duration-200 group-focus-within:scale-110 group-focus-within:text-emerald-600 dark:text-slate-400 dark:group-focus-within:text-emerald-400"
          />
          <input
            ref={searchRef}
            id="cari-tugas-admin"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                if (query) setQuery("");
                else e.currentTarget.blur();
              }
            }}
            placeholder="Cari judul atau mata kuliah..."
            className={searchInput}
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              aria-label="Hapus pencarian"
              className={`absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-slate-500 text-white transition hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500 ${focusRing}`}
            >
              <Icon name="x" size="h-3 w-3" />
            </button>
          ) : (
            <kbd
              aria-hidden="true"
              className="pointer-events-none absolute right-2.5 top-1/2 hidden h-5 -translate-y-1/2 items-center rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[11px] text-slate-500 transition-opacity group-focus-within:opacity-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 sm:inline-flex"
            >
              /
            </kbd>
          )}
        </div>
      </div>

      {actionError && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
        >
          <Icon name="alert" className="mt-0.5" />
          <span>{actionError}</span>
        </p>
      )}

      {/* ───── DAFTAR ───── */}
      <div className="mt-4">
        {loading ? (
          <div aria-busy="true">
            <p role="status" className="sr-only">
              Memuat tugas...
            </p>
            <ul className={LIST_CLASS}>
              {[0, 1, 2, 3, 4].map((i) => (
                <RowSkeleton key={i} />
              ))}
            </ul>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-900/50 dark:bg-red-950/20"
          >
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={`mt-4 rounded-lg px-3 py-2 text-sm font-bold text-red-800 transition hover:underline active:scale-95 dark:text-red-300 ${focusRing}`}
            >
              Coba lagi
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              <Icon name={tasks.length === 0 ? "inbox" : "search"} size="h-5 w-5" />
            </span>
            <p className={`mt-4 text-sm ${textMuted}`}>
              {tasks.length === 0
                ? "Belum ada tugas. Tambahkan tugas pertamamu."
                : query.trim()
                  ? "Tidak ada tugas yang cocok dengan pencarian ini."
                  : "Tidak ada tugas dengan status ini."}
            </p>
            {tasks.length === 0 ? (
              <Link href="/admin/tugas/baru" className={`${btnPrimary} mt-5`}>
                <Icon name="plus" />
                Tugas baru
              </Link>
            ) : (
              query.trim() && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className={`mt-4 rounded-lg px-3 py-2 text-sm font-bold text-emerald-700 transition hover:underline active:scale-95 dark:text-emerald-300 ${focusRing}`}
                >
                  Hapus pencarian
                </button>
              )
            )}
          </div>
        ) : isWide ? (
          <TaskTable tasks={visible} rowProps={rowProps} />
        ) : (
          <TaskList tasks={visible} rowProps={rowProps} />
        )}
      </div>

      {showFooter && (
        <p className={`mt-3 px-1 text-xs ${textMuted}`}>
          Menampilkan{" "}
          <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
            {visible.length}
          </span>{" "}
          dari {tasks.length} tugas
        </p>
      )}

      {/* Umpan balik setelah aksi berhasil. Wilayah sr-only selalu ada
          supaya pembaca layar mengumumkan pesannya. */}
      <div role="status" aria-live="polite" className="sr-only">
        {toast?.text}
      </div>
      {toast && (
        <div
          key={toast.id}
          aria-hidden="true"
          className="toast-in fixed inset-x-4 bottom-6 z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-slate-900/20 dark:bg-slate-100 dark:text-slate-900"
        >
          <Icon
            name="tick"
            className="text-emerald-400 dark:text-emerald-700"
          />
          {toast.text}
        </div>
      )}
    </>
  );
}