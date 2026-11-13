"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useTasks } from "@/features/tasks/hooks/useTasks";

/* ────────────────────────────────────────────────────────────
   DATA
   Halaman ini tidak terikat ke satu mata kuliah: daftar mata kuliah
   dan semester di filter dibentuk otomatis dari data tugas.
   Field bertanda "opsional" boleh dihapus; UI akan menyesuaikan.
   ──────────────────────────────────────────────────────────── */

type Status =
  | "Dikerjakan"
  | "Selesai"
  | "Terverifikasi"
  | "Dipublikasikan";

type Task = {
  id: string;
  title: string;
  course: string;
  semester: string;
  deadline: string; // format ISO: YYYY-MM-DD
  description: string;
  type: string;
  status: Status;
  fileType: string;
  fileSize?: string; // opsional, contoh: "1.8 MB"
  meeting?: string; // opsional, contoh: "Pertemuan 9"
  fileUrl?: string; // opsional, tombol "Unduh" aktif kalau diisi
};

const profile = {
  name: "Muhammad Nur Faaiz",
  nim: "2503010002",
  major: "Teknik Informatika",
  classGroup: "A",
  cohort: "2025",
  academicYear: "TA 2026/2027 · Semester 3 (Ganjil)",
};

// Status bawaan semua tugas dari database. Lencananya hanya tampil kalau
// statusnya berbeda, supaya kartu tidak mengulang kata yang sama.
const DEFAULT_STATUS: Status = "Dipublikasikan";

const ALL_SEMESTERS = "Semua Semester";
const ALL_COURSES = "Semua Mata Kuliah";
const SORT_OPTIONS = ["Terbaru", "Terlama", "Judul A–Z"] as const;

// Lebar konten dibatasi dan diratakan di tengah, supaya di layar lebar
// kartu tidak melar dan tepi kiri header, banner, filter, daftar, footer sejajar.
const CONTAINER = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

// Foto banner di folder public/. Ubah sesuai nama filemu
const BANNER_IMAGE = "/fotoPribadi.jpg";

// Bagian foto yang dipertahankan saat dipotong: mobile, tablet kecil, lalu desktop.
// Angka persen = posisi vertikal. Naikkan kalau wajah terlalu ke atas,
// turunkan kalau terlalu ke bawah (foto potret, jadi hasilnya sensitif).
const BANNER_FOCUS =
  "object-[center_47%] sm:object-[center_40%] md:object-[center_51%]";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/* ────────────────────────────────────────────────────────────
   ANIMASI
   Semua gerak ada di file ini, tanpa library tambahan.
   - Satu urutan masuk di banner saat halaman dibuka
   - Kartu muncul saat masuk layar (scroll), bukan semuanya sekaligus
   - Selebihnya merespons aksi pengguna: klik, filter
   - Otomatis mati kalau perangkat memakai "reduce motion"
   Kalau mau, pindahkan MOTION_CSS ke globals.css.
   ──────────────────────────────────────────────────────────── */

const MOTION_CSS = `
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes popIn{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
.anim-fade-up{animation:fadeUp .8s cubic-bezier(.22,1,.36,1) both}
.anim-fade{animation:fadeIn 1.2s ease-out both}
.anim-pop{animation:popIn .25s cubic-bezier(.34,1.56,.64,1) both}
.parallax{transition:transform .35s ease-out;will-change:transform}

/* Foto banner: memudar ke bawah di mobile, ke kiri di desktop */
.hero-photo{
  -webkit-mask-image:linear-gradient(to bottom,#000 55%,transparent);
  mask-image:linear-gradient(to bottom,#000 55%,transparent);
}
@media (min-width:768px){
  .hero-photo{
    -webkit-mask-image:linear-gradient(to right,transparent,#000 36%);
    mask-image:linear-gradient(to right,transparent,#000 36%);
  }
}

/* Muncul saat masuk layar; kelas is-in dipasang oleh <Reveal> */
.reveal{
  opacity:0;
  transform:translateY(20px);
  transition:opacity .7s cubic-bezier(.22,1,.36,1),transform .7s cubic-bezier(.22,1,.36,1);
}
.reveal.is-in{opacity:1;transform:none}

@media (prefers-reduced-motion:reduce){
  .anim-fade-up,.anim-fade,.anim-pop{animation:none!important}
  .parallax{transform:none!important;transition:none}
  .reveal{opacity:1!important;transform:none!important;transition:none!important}
}
`;

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function scrollToList() {
  document.getElementById("daftar-tugas")?.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
}

/** Hitung naik dari angka sebelumnya ke target (dipakai untuk jumlah tugas). */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const total = prefersReducedMotion() ? 0 : duration;
    const start = performance.now();
    const origin = from.current;
    let raf = 0;

    const tick = (now: number) => {
      const t = total === 0 ? 1 : Math.min((now - start) / total, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(origin + (target - origin) * eased);
      from.current = next;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

/** Membungkus elemen agar naik pelan-pelan saat pertama kali terlihat di layar. */
function Reveal({
  children,
  delayMs = 0,
  className = "",
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-in");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-in");
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PALET WARNA
   Satu sumber untuk semua warna di halaman ini. Jangan menulis kelas
   warna baru langsung di JSX; pakai atau tambahkan token di bawah.

   Aturan:
   - Brand  : emerald. Isi solid 700 (hover 800). Tint 50 dengan teks 800.
              Teks brand di atas putih memakai 700. Fokus memakai 500.
   - Aksen  : amber-300, hanya di atas latar hijau tua (banner).
   - Netral : slate, satu keluarga, dengan tiga tingkat teks:
              judul 900 / 50, isi dan meta 600 / 300-400, ikon 400-500.
              Halaman 50 / 950, permukaan putih / 900, batas 200 / 800,
              kolom isian putih / 800 dengan batas 300 / 700.
   - Hover  : semua kontrol interaktif berubah ke batas emerald-300.
   - Merah  : hanya untuk pesan error.
   Mode gelap memakai pasangan yang sama: tint emerald-500/10, teks emerald-300.
   ──────────────────────────────────────────────────────────── */

// Permukaan: kartu, panel filter, kotak kosong
const surface =
  "border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";

const dashedBox =
  "rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900";

// Teks netral. textMuted dipakai untuk deskripsi dan meta (kontras ±7:1 di atas putih)
const textHeading = "text-slate-900 dark:text-slate-50";
const textMuted = "text-slate-600 dark:text-slate-400";

// Brand: lencana bertint (mata kuliah, tahun ajaran, status terverifikasi)
const brandTint =
  "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20";

// Brand: tombol utama berisi penuh
const brandSolid = "bg-emerald-700 text-white hover:bg-emerald-800";

// Brand: tautan teks di atas permukaan putih
const brandLink = "text-emerald-700 dark:text-emerald-300";

// Kolom isian (input dan select)
const fieldBase =
  "h-11 w-full rounded-xl border border-slate-300 bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-500 hover:border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:hover:border-emerald-500/40 dark:focus:border-emerald-500 dark:[color-scheme:dark]";

const fieldLabel =
  "mb-1.5 block text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-400";

// Tombol sekunder (Unduh, Reset, Filter): bentuk, warna netral, hover, nonaktif
const btnShape =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition duration-200 active:scale-[0.97] disabled:active:scale-100";

const btnNeutral =
  "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";

const btnBrandOn =
  "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300";

const hoverBrand =
  "hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300";

const hoverBrandEnabled =
  "enabled:hover:border-emerald-300 enabled:hover:bg-emerald-50 enabled:hover:text-emerald-800 dark:enabled:hover:border-emerald-500/40 dark:enabled:hover:bg-emerald-500/10 dark:enabled:hover:text-emerald-300";

const btnDisabled =
  "disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:border-slate-800 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-500";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30";

const STATUS_STYLE: Record<
  Status,
  { icon: IconName; className: string }
> = {
  Dikerjakan: {
    icon: "clock",
    className:
      "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20",
  },
  Selesai: {
    icon: "check",
    className:
      "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  },
  Terverifikasi: {
    icon: "check",
    className: brandTint,
  },
  Dipublikasikan: {
    icon: "check",
    className: brandTint,
  },
};

/* ────────────────────────────────────────────────────────────
   IKON (inline SVG, tanpa dependensi tambahan)
   ──────────────────────────────────────────────────────────── */

const ICONS = {
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  sliders: (
    <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />
  ),
  reset: (
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5M12 15V3" />
    </>
  ),
  file: (
    <>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <path d="M14 2v6h6M16 13H8M16 17H8" />
    </>
  ),
  user: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  bookmark: <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />,
  check: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
} as const;

type IconName = keyof typeof ICONS;

function Icon({
  name,
  className = "h-4 w-4",
}: {
  name: IconName;
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
      className={className}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────
   KOMPONEN KECIL
   ──────────────────────────────────────────────────────────── */

function SelectField({
  label,
  value,
  onChange,
  options,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldBase} peer cursor-pointer appearance-none truncate pl-4 pr-10`}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {/* Panah berputar saat dropdown difokuskan */}
        <Icon
          name="chevron"
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-transform duration-300 peer-focus:rotate-180 peer-focus:text-emerald-600 dark:text-slate-400 dark:peer-focus:text-emerald-400"
        />
      </div>
    </div>
  );
}

/*
  Susunan kartu, dari atas ke bawah:
  1. Mata kuliah (+ status bila bukan bawaan) di kiri, tanggal di kanan
  2. Judul (maks. 3 baris) dan deskripsi (maks. 3 baris)
  3. Metadata berkas, selalu menempel di bawah isi
  4. Bilah aksi terpisah garis: Lihat Detail (utama) dan Unduh
  Bilah aksi selalu sejajar antar-kartu walau panjang judul berbeda.
*/
function TaskCard({ task }: { task: Task }) {
  const status = STATUS_STYLE[task.status];

  const chips: { icon: IconName; text: string }[] = [
    {
      icon: "file",
      text: task.fileSize ? `${task.fileType} • ${task.fileSize}` : task.fileType,
    },
  ];
  if (task.meeting) chips.push({ icon: "bookmark", text: task.meeting });
  chips.push({ icon: "user", text: task.type });

  return (
    <article
      className={`${surface} group flex h-full flex-col overflow-hidden rounded-2xl shadow-sm transition duration-200 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-900/5 dark:hover:border-emerald-500/40 dark:hover:shadow-none`}
    >
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Mata kuliah, status (hanya jika bukan bawaan), tanggal */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <span
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${brandTint}`}
          >
            {task.course}
          </span>
          {task.status !== DEFAULT_STATUS && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
            >
              <Icon name={status.icon} className="h-3 w-3" />
              {task.status}
            </span>
          )}
          {task.deadline ? (
            <time
              dateTime={task.deadline}
              title="Batas pengumpulan"
              className={`ml-auto inline-flex items-center gap-1.5 text-xs font-medium tabular-nums ${textMuted}`}
            >
              <Icon
                name="calendar"
                className="h-3.5 w-3.5 text-slate-500 dark:text-slate-500"
              />
              {formatDate(task.deadline)}
            </time>
          ) : (
            <span className={`ml-auto text-xs ${textMuted}`}>
              Deadline belum ditentukan
            </span>
          )}
        </div>

        {/* Judul dan deskripsi. Judul panjang dipotong di 3 baris;
            teks lengkap tetap ada di tooltip dan halaman detail. */}
        <h3
          title={task.title}
          className={`mt-4 line-clamp-3 text-lg font-bold leading-snug tracking-tight ${textHeading}`}
        >
          {task.title}
        </h3>
        <p className={`mt-2 line-clamp-3 text-sm leading-6 ${textMuted}`}>
          {task.description}
        </p>

        {/* Metadata berkas */}
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          {chips.map((chip) => (
            <span
              key={chip.text}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <Icon
                name={chip.icon}
                className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400"
              />
              {chip.text}
            </span>
          ))}
        </div>
      </div>

      {/* Aksi */}
      <div className="flex gap-2.5 border-t border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40 sm:p-4">
        <Link
          href={`/tugas/${task.id}`}
          className={`group/btn inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition duration-200 hover:shadow-md hover:shadow-emerald-700/25 active:scale-[0.97] ${brandSolid} ${focusRing}`}
        >
          <Icon
            name="eye"
            className="h-4 w-4 transition-transform duration-200 group-hover/btn:scale-125"
          />
          Lihat Detail
        </Link>

        {task.fileUrl ? (
          <a
            href={task.fileUrl}
            download
            className={`group/btn px-4 ${btnShape} ${btnNeutral} ${hoverBrand} ${focusRing}`}
          >
            <Icon
              name="download"
              className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-y-0.5"
            />
            Unduh
          </a>
        ) : (
          <button
            type="button"
            disabled
            title="Berkas belum tersedia"
            className={`px-4 ${btnShape} ${btnNeutral} ${btnDisabled}`}
          >
            <Icon name="download" />
            Unduh
          </button>
        )}
      </div>
    </article>
  );
}

function TaskSkeleton() {
  return (
    <div
      aria-hidden="true"
      className={`${surface} animate-pulse overflow-hidden rounded-2xl shadow-sm`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex gap-2">
          <div className="h-6 w-28 rounded-md bg-slate-200 dark:bg-slate-700" />
          <div className="ml-auto h-5 w-24 rounded bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="mt-5 h-5 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 h-3.5 w-full rounded bg-slate-100 dark:bg-slate-800" />
        <div className="mt-2 h-3.5 w-2/3 rounded bg-slate-100 dark:bg-slate-800" />
        <div className="mt-5 flex gap-2">
          <div className="h-7 w-20 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-7 w-20 rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
      <div className="flex gap-2.5 border-t border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40 sm:p-4">
        <div className="h-11 flex-1 rounded-xl bg-slate-200 dark:bg-slate-700" />
        <div className="h-11 w-24 rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   TEMA GELAP
   Sumber kebenarannya adalah class "dark" di <html>. Class itu dipasang
   lebih dulu oleh skrip di layout.tsx, jadi halaman cukup membacanya.
   ──────────────────────────────────────────────────────────── */

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

const getThemeSnapshot = () =>
  document.documentElement.classList.contains("dark");

const getServerThemeSnapshot = () => false;

/* ────────────────────────────────────────────────────────────
   HALAMAN
   ──────────────────────────────────────────────────────────── */

export default function Home() {
  const [search, setSearch] = useState("");
  const [semester, setSemester] = useState(ALL_SEMESTERS);
  const [course, setCourse] = useState(ALL_COURSES);
  const [sort, setSort] = useState<string>(SORT_OPTIONS[0]);
  const [filtersOpen, setFiltersOpen] = useState(false); // hanya berlaku di bawah lg
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [resetTurns, setResetTurns] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);
  const dark = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );
  const { tasks: databaseTasks, loading, error } = useTasks();

  const tasks: Task[] = useMemo(
    () =>
      databaseTasks.map((item) => ({
        id: item.id,
        title: item.title,
        course: item.courses?.name ?? "Mata Kuliah",
        semester: `Semester ${item.semester}`,
        deadline: item.deadline ?? "",
        description: item.description ?? "",
        type: "Individu",
        status: DEFAULT_STATUS,
        fileType:
          item.document_name?.split(".").pop()?.toUpperCase() ?? "Dokumen",
        fileSize: undefined,
      })),
    [databaseTasks]
  );

  const semesterOptions = useMemo(
    () => [
      ALL_SEMESTERS,
      ...Array.from(new Set(tasks.map((task) => task.semester))),
    ],
    [tasks]
  );

  const courseOptions = useMemo(
    () => [
      ALL_COURSES,
      ...Array.from(new Set(tasks.map((task) => task.course))),
    ],
    [tasks]
  );

  // Scroll: header mengecil, progress bar berjalan, tombol "ke atas" muncul
  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(y / max, 1) : 0;
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${progress})`;
      }
      setScrolled(y > 8);
      setShowTop(y > 480);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  // Banner: foto bergeser halus mengikuti kursor (hanya mouse, bukan sentuhan)
  function handleHeroMove(e: ReactPointerEvent<HTMLElement>) {
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

  function handleHeroLeave(e: ReactPointerEvent<HTMLElement>) {
    e.currentTarget.style.setProperty("--px", "0");
    e.currentTarget.style.setProperty("--py", "0");
  }

  const filteredTasks = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const result = tasks.filter((task) => {
      const matchesSearch =
        keyword === "" ||
        task.title.toLowerCase().includes(keyword) ||
        task.description.toLowerCase().includes(keyword) ||
        task.course.toLowerCase().includes(keyword);
      const matchesSemester =
        semester === ALL_SEMESTERS || task.semester === semester;
      const matchesCourse = course === ALL_COURSES || task.course === course;
      return matchesSearch && matchesSemester && matchesCourse;
    });

    return result.sort((a, b) => {
      if (sort === "Judul A–Z") return a.title.localeCompare(b.title, "id");

      // Tugas tanpa deadline selalu di akhir
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;

      return sort === "Terlama"
        ? a.deadline.localeCompare(b.deadline)
        : b.deadline.localeCompare(a.deadline);
    });
  }, [tasks, search, semester, course, sort]);

  // Angka hasil berputar naik/turun setiap filter berubah
  const shownCount = useCountUp(filteredTasks.length, 450);

  // Jumlah filter di panel (pencarian tidak dihitung karena selalu terlihat)
  const activeFilters = [
    semester !== ALL_SEMESTERS,
    course !== ALL_COURSES,
    sort !== SORT_OPTIONS[0],
  ].filter(Boolean).length;
  const hasActiveFilters = search.trim() !== "" || activeFilters > 0;

  function resetFilters() {
    setSearch("");
    setSemester(ALL_SEMESTERS);
    setCourse(ALL_COURSES);
    setSort(SORT_OPTIONS[0]);
    setResetTurns((turns) => turns + 1);
  }

  const countLabel = loading
    ? "Memuat data tugas..."
    : error
      ? "Data tugas tidak tersedia."
      : `Menampilkan ${filteredTasks.length}${
          hasActiveFilters ? ` dari ${tasks.length}` : ""
        } tugas`;

  // Grid kartu: 1 kolom di mobile, 2 di tablet, 3 di desktop
  const cardGrid =
    "grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800 transition-colors selection:bg-emerald-200 selection:text-emerald-950 dark:bg-slate-950 dark:text-slate-200 dark:selection:bg-emerald-500/30 dark:selection:text-emerald-50">
      <style>{MOTION_CSS}</style>

      <a
        href="#daftar-tugas"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-emerald-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Lewati ke daftar tugas
      </a>

      {/* ───── HEADER ─────
          Latar selebar layar, isi dibatasi CONTAINER. Tahun ajaran tampil di
          sini mulai tablet; di mobile pindah ke banner supaya header tetap lega. */}
      <header
        className={`sticky top-0 z-50 w-full border-b border-slate-200 bg-white/85 backdrop-blur-md transition-shadow duration-300 dark:border-slate-800 dark:bg-slate-950/85 ${
          scrolled ? "shadow-md shadow-slate-900/5 dark:shadow-black/20" : ""
        }`}
      >
        <div
          className={`${CONTAINER} flex items-center justify-between gap-3 transition-[height] duration-300 ${
            scrolled ? "h-14" : "h-16"
          }`}
        >
          <Link
            href="/"
            aria-label="Arsip Tugas, ke beranda"
            className={`flex min-w-0 items-center gap-3 rounded-lg transition-transform duration-200 hover:scale-[1.02] active:scale-95 ${focusRing}`}
          >
            {/* Logo Unper: simpan filenya di public/logo-unper.png (atau ubah path ini) */}
            <Image
              src="/logo-unper.png"
              alt="Logo Universitas Perjuangan Tasikmalaya"
              width={40}
              height={40}
              priority
              className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10"
            />
            {/* Teks asli, bukan SVG: otomatis memakai font utama halaman dan ikut tema gelap */}
            <span className="flex min-w-0 flex-col leading-none">
              <span
                className={`text-lg font-extrabold tracking-tight ${textHeading}`}
              >
                Arsip Tugas
              </span>
              <span
                className={`mt-1 truncate text-[11px] font-medium sm:text-xs ${textMuted}`}
              >
                Universitas Perjuangan Tasikmalaya
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2.5">
            <span
              className={`hidden items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold md:inline-flex ${brandTint}`}
            >
              <Icon name="calendar" className="h-3.5 w-3.5" />
              {profile.academicYear}
            </span>

            {/* Ikon matahari dan bulan bertukar dengan putaran */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={dark ? "Aktifkan tema terang" : "Aktifkan tema gelap"}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 active:scale-90 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300 ${focusRing}`}
            >
              <span className="relative block h-[18px] w-[18px]">
                <Icon
                  name="sun"
                  className={`absolute inset-0 h-[18px] w-[18px] transition-all duration-500 ${
                    dark
                      ? "rotate-0 scale-100 opacity-100"
                      : "-rotate-90 scale-0 opacity-0"
                  }`}
                />
                <Icon
                  name="moon"
                  className={`absolute inset-0 h-[18px] w-[18px] transition-all duration-500 ${
                    dark
                      ? "rotate-90 scale-0 opacity-0"
                      : "rotate-0 scale-100 opacity-100"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {/* Progress baca halaman: satu warna brand, tanpa aksen kuning
            (kuning hanya dipakai di atas banner hijau tua) */}
        <div
          ref={progressRef}
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-gradient-to-r from-emerald-700 to-emerald-400"
          style={{ transform: "scaleX(0)" }}
        />
      </header>

      <main className="flex-1">
        {/* ───── BANNER ─────
            Kartu hijau tua berpinggir membulat di dalam CONTAINER, bukan
            pita selebar layar, jadi tepinya sejajar dengan daftar di bawahnya.

            Mobile : foto di atas, memudar ke bawah; teks menumpuk di bawah foto.
            Desktop: dua kolom, teks 7/12 di kiri, foto 5/12 di kanan dan
                     memudar ke kiri.

            Warna teks: nama putih (paling besar), aksen kuning hanya di
            lencana jurusan dan tombol, sisanya emerald terang. */}
        <section
          aria-labelledby="judul-portal"
          className={`${CONTAINER} pt-4 sm:pt-6`}
        >
          <div
            onPointerMove={handleHeroMove}
            onPointerLeave={handleHeroLeave}
            className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white shadow-xl shadow-emerald-950/10 ring-1 ring-emerald-950/10 dark:via-emerald-950 dark:to-emerald-900 dark:ring-white/10 md:grid md:min-h-[26rem] md:grid-cols-12 lg:min-h-[28rem]"
          >
            {/* Foto */}
            <div
              aria-hidden="true"
              className="hero-photo pointer-events-none relative aspect-[3/2] w-full overflow-hidden sm:aspect-[2/1] md:order-2 md:col-span-5 md:aspect-auto"
            >
              <div
                className="anim-fade parallax absolute inset-0 origin-top"
                style={{
                  // Zoom tipis hanya untuk ruang gerak parallax. Titik tumpunya di atas
                  // dan gerak vertikalnya hanya ke atas, jadi puncak kepala tidak terpotong.
                  transform:
                    "translate3d(calc(var(--px, 0) * -14px), calc((var(--py, 0) + 1) * -5px), 0) scale(1.06)",
                }}
              >
                <Image
                  src={BANNER_IMAGE}
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 1280px) 520px, (min-width: 768px) 42vw, 100vw"
                  unoptimized={BANNER_IMAGE.endsWith(".svg")}
                  className={`object-cover ${BANNER_FOCUS}`}
                />
              </div>
            </div>

            {/* Teks */}
            <div className="relative z-10 -mt-14 px-5 pb-7 sm:-mt-16 sm:px-8 sm:pb-9 md:order-1 md:col-span-7 md:mt-0 md:flex md:items-center md:px-10 md:py-12 lg:px-14">
              <div className="w-full max-w-xl lg:max-w-2xl">
                <div
                  className="anim-fade-up flex flex-wrap items-center gap-2"
                  style={delay(0)}
                >
                  <span className="inline-flex items-center rounded-full bg-amber-300/15 px-3.5 py-1.5 text-xs font-semibold text-amber-200 ring-1 ring-inset ring-amber-300/30">
                    {profile.major}
                  </span>
                  {/* Tahun ajaran: di header mulai tablet, di sini untuk mobile */}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-50 ring-1 ring-inset ring-white/20 md:hidden">
                    <Icon name="calendar" className="h-3.5 w-3.5" />
                    {profile.academicYear}
                  </span>
                </div>

                <h1
                  id="judul-portal"
                  className="anim-fade-up mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight text-white [text-wrap:balance] sm:text-5xl lg:text-6xl"
                  style={delay(100)}
                >
                  {profile.name}
                </h1>

                {/* Identitas: tiga sel berlabel, lebih mudah dipindai
                    daripada satu baris yang dipisah titik */}
                <dl
                  className="anim-fade-up mt-5 flex w-full divide-x divide-white/15 overflow-hidden rounded-xl bg-white/10 ring-1 ring-inset ring-white/15 sm:w-fit"
                  style={delay(200)}
                >
                  {(
                    [
                      ["NIM", profile.nim],
                      ["Kelas", profile.classGroup],
                      ["Angkatan", profile.cohort],
                    ] as const
                  ).map(([label, value]) => (
                    <div
                      key={label}
                      className="flex-1 px-3 py-2.5 sm:flex-none sm:px-5"
                    >
                      <dt className="text-xs font-medium text-emerald-200">
                        {label}
                      </dt>
                      <dd className="mt-0.5 text-sm font-bold tabular-nums text-white">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <p
                  className="anim-fade-up mt-5 max-w-md text-[15px] leading-7 text-emerald-100 sm:text-base"
                  style={delay(300)}
                >
                  Arsip tugas kuliah dan laporan praktikum, tersusun rapi dan
                  terbuka untuk umum.
                </p>

                <div className="anim-fade-up mt-6" style={delay(420)}>
                  <a
                    href="#daftar-tugas"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToList();
                    }}
                    className="group/cta inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-amber-300 px-7 text-sm font-bold text-emerald-950 shadow-lg shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:bg-amber-200 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50 active:scale-95 sm:w-auto"
                  >
                    Lihat Tugas
                    <Icon
                      name="chevron"
                      className="h-4 w-4 transition-transform duration-300 group-hover/cta:translate-y-0.5"
                    />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ───── FILTER & DAFTAR TUGAS ───── */}
        <section
          id="daftar-tugas"
          aria-labelledby="judul-daftar"
          className={`${CONTAINER} scroll-mt-20 py-8 sm:py-10`}
        >
          {/* Judul bagian + jumlah hasil dalam satu baris */}
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2
              id="judul-daftar"
              className={`text-2xl font-extrabold tracking-tight sm:text-3xl ${textHeading}`}
            >
              Daftar Tugas
            </h2>
            <p role="status" className={`text-sm ${textMuted}`}>
              {loading || error ? (
                countLabel
              ) : (
                <>
                  <span className="sr-only">{countLabel}</span>
                  <span aria-hidden="true">
                    Menampilkan{" "}
                    <strong className="font-bold tabular-nums text-slate-900 dark:text-slate-50">
                      {shownCount}
                    </strong>
                    {hasActiveFilters ? ` dari ${tasks.length}` : ""} tugas
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Filter: satu baris di desktop; di mobile hanya pencarian + tombol Filter */}
          <div className={`${surface} rounded-2xl p-4 shadow-sm sm:p-5`}>
            <div className="lg:grid lg:grid-cols-12 lg:items-end lg:gap-4">
              <div className="lg:col-span-4">
                <label htmlFor="cari-tugas" className={fieldLabel}>
                  Pencarian Tugas
                </label>
                <div className="flex gap-2.5">
                  <div className="group relative min-w-0 flex-1">
                    <Icon
                      name="search"
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition duration-200 group-focus-within:scale-110 group-focus-within:text-emerald-600 dark:text-slate-400 dark:group-focus-within:text-emerald-400"
                    />
                    <input
                      id="cari-tugas"
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Ketik judul atau kata kunci tugas..."
                      className={`${fieldBase} pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none`}
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        aria-label="Hapus pencarian"
                        className={`absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-slate-500 text-white transition hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500 ${focusRing}`}
                      >
                        <Icon name="x" className="anim-pop h-3 w-3" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setFiltersOpen((open) => !open)}
                    aria-expanded={filtersOpen}
                    aria-controls="panel-filter"
                    className={`shrink-0 px-3.5 lg:hidden ${btnShape} ${
                      filtersOpen || activeFilters > 0
                        ? btnBrandOn
                        : `${btnNeutral} ${hoverBrand}`
                    } ${focusRing}`}
                  >
                    <Icon name="sliders" />
                    Filter
                    {activeFilters > 0 && (
                      <span
                        key={activeFilters}
                        className="anim-pop flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-700 px-1.5 text-[11px] font-bold text-white"
                      >
                        {activeFilters}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Panel filter: membuka-menutup halus di mobile, selalu tampil di lg.
                  lg:contents membuat isinya ikut grid 12 kolom di atas. */}
              <div
                id="panel-filter"
                className={`grid transition-[grid-template-rows,visibility] duration-300 ease-out lg:contents ${
                  filtersOpen
                    ? "visible grid-rows-[1fr]"
                    : "invisible grid-rows-[0fr]"
                } lg:visible`}
              >
                <div className="-mx-1 min-h-0 overflow-hidden px-1 pb-1 lg:contents">
                  <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2 lg:contents">
                    <SelectField
                      className="lg:col-span-2"
                      label="Filter Semester"
                      value={semester}
                      onChange={setSemester}
                      options={semesterOptions}
                    />
                    <SelectField
                      className="lg:col-span-2"
                      label="Filter Mata Kuliah"
                      value={course}
                      onChange={setCourse}
                      options={courseOptions}
                    />
                    <SelectField
                      className="lg:col-span-2"
                      label="Urutkan"
                      value={sort}
                      onChange={setSort}
                      options={SORT_OPTIONS}
                    />

                    <div className="sm:col-span-2 lg:col-span-2">
                      <button
                        type="button"
                        onClick={resetFilters}
                        disabled={!hasActiveFilters}
                        className={`w-full px-4 ${btnShape} ${btnNeutral} ${hoverBrandEnabled} ${btnDisabled} ${focusRing}`}
                      >
                        {/* Ikon berputar satu kali penuh setiap reset */}
                        <span
                          className="inline-flex transition-transform duration-500 ease-out"
                          style={{ transform: `rotate(${resetTurns * -360}deg)` }}
                        >
                          <Icon name="reset" />
                        </span>
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 sm:mt-6">
            {loading ? (
              <div aria-busy="true" className={cardGrid}>
                {[0, 1, 2].map((i) => (
                  <TaskSkeleton key={i} />
                ))}
              </div>
            ) : error ? (
              <div
                role="alert"
                className="anim-fade-up rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center dark:border-red-900/50 dark:bg-red-950/20"
              >
                <h3 className="text-lg font-bold text-red-800 dark:text-red-300">
                  Data tugas gagal dimuat
                </h3>
                <p className="mt-2 text-sm text-red-700 dark:text-red-300/80">
                  {error}
                </p>
                <p className="mt-2 text-xs text-red-700 dark:text-red-400">
                  Periksa koneksi Supabase dan konfigurasi file .env.local.
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className={`mt-5 rounded-lg px-3 py-2 text-sm font-bold text-red-800 transition hover:underline active:scale-95 dark:text-red-300 ${focusRing}`}
                >
                  Coba lagi
                </button>
              </div>
            ) : filteredTasks.length > 0 ? (
              // Key berubah saat filter atau urutan diganti, jadi kartu masuk
              // ulang berurutan. Mengetik di pencarian tidak memicunya.
              <div key={`${semester}|${course}|${sort}`} className={cardGrid}>
                {filteredTasks.map((task, index) => (
                  <Reveal
                    key={task.id}
                    className="h-full"
                    delayMs={Math.min(index, 8) * 70}
                  >
                    <TaskCard task={task} />
                  </Reveal>
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <div className={`anim-fade-up ${dashedBox}`}>
                <h3 className={`text-lg font-bold ${textHeading}`}>
                  Belum ada tugas yang dipublikasikan
                </h3>
                <p className={`mt-2 text-sm ${textMuted}`}>
                  Tugas akan muncul di sini setelah ditambahkan.
                </p>
              </div>
            ) : (
              <div className={`anim-fade-up ${dashedBox}`}>
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <Icon name="search" className="h-5 w-5" />
                </span>
                <h3 className={`mt-4 text-lg font-bold ${textHeading}`}>
                  Tugas tidak ditemukan
                </h3>
                <p className={`mt-2 text-sm ${textMuted}`}>
                  Coba kata kunci lain, atau hapus filter yang sedang aktif.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className={`mt-5 rounded-lg px-3 py-2 text-sm font-bold transition hover:underline active:scale-95 ${brandLink} ${focusRing}`}
                >
                  Reset filter
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ───── FOOTER (latar selebar layar, isi sejajar dengan konten) ───── */}
      <footer className="w-full border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className={`${CONTAINER} py-6 text-center text-xs sm:text-left ${textMuted}`}>
          <p>© 2026 {profile.name}. All rights reserved.</p>
        </div>
      </footer>

      {/* Tombol kembali ke atas, muncul setelah scroll */}
      <button
        type="button"
        onClick={() =>
          window.scrollTo({
            top: 0,
            behavior: prefersReducedMotion() ? "auto" : "smooth",
          })
        }
        aria-label="Kembali ke atas"
        aria-hidden={!showTop}
        tabIndex={showTop ? 0 : -1}
        className={`fixed bottom-5 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full shadow-lg shadow-emerald-900/25 transition-all duration-300 hover:-translate-y-1 active:scale-90 sm:bottom-6 sm:right-6 ${brandSolid} ${focusRing} ${
          showTop
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        <Icon name="chevron" className="h-5 w-5 rotate-180" />
      </button>
    </div>
  );
}