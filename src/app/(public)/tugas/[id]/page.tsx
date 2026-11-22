"use client";

/* Simpan sebagai src/app/(public)/tugas/[id]/page.tsx */

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { useTasks } from "@/features/tasks/hooks/useTasks";
import { getFileExtension } from "@/features/tasks/lib/documents";
import PostContent from "@/features/tasks/components/PostContent";
import { WORK_TYPE_LABEL, type Task } from "@/features/tasks/types/task";

/* ────────────────────────────────────────────────────────────
   KONFIGURASI
   ──────────────────────────────────────────────────────────── */

const OWNER = "Muhammad Nur Faaiz";
const ACADEMIC_LABEL = "TA 2026/2027 · Semester 3 (Ganjil)";

// Padding horizontal saja (sama dengan beranda). Dipakai sendiri oleh Notice,
// yang punya max-w sendiri.
const GUTTER = "px-4 sm:px-6 lg:px-8";

// Lebar konten halaman. SAMAKAN max-w-7xl dengan container di beranda.
// Jangan digabung dengan kelas max-w lain pada elemen yang sama.
const CONTAINER = `mx-auto w-full max-w-7xl ${GUTTER}`;

// Padding dalam kartu banner
const HERO_PAD = "px-5 py-6 sm:px-8 sm:py-10 lg:px-12 lg:py-14";

// Nama bucket Supabase Storage tempat berkas tugas disimpan. Tidak dipakai
// kalau document_path sudah berupa URL lengkap.
const DOCUMENT_BUCKET = "task-documents";

/* ────────────────────────────────────────────────────────────
   HELPER
   ──────────────────────────────────────────────────────────── */

function formatDate(iso: string, timeZone = "UTC") {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  });
}

/** "15 November 2026, 14.30 WIB". Zona waktu dikunci supaya sama di server dan browser. */
function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });
  return `${formatDate(iso, "Asia/Jakarta")}, ${time} WIB`;
}

/** Pecahan tanggal untuk panel batas pengumpulan: hari, tanggal, bulan + tahun. */
function dateParts(iso: string) {
  const date = new Date(iso);
  const part = (options: Intl.DateTimeFormatOptions) =>
    date.toLocaleDateString("id-ID", { ...options, timeZone: "UTC" });
  return {
    weekday: part({ weekday: "long" }),
    day: part({ day: "numeric" }),
    monthYear: part({ month: "long", year: "numeric" }),
  };
}

/** Selisih hari dari hari ini ke tanggal ISO (negatif = sudah lewat). */
function daysUntil(iso: string) {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(iso).getTime() - today) / 86_400_000);
}

/** Tautan lihat dan unduh untuk berkas tugas. Null kalau belum ada berkas. */
function resolveDocumentUrls(path: string | null, name: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return { view: path, download: path };

  const storage = supabase.storage.from(DOCUMENT_BUCKET);
  return {
    view: storage.getPublicUrl(path).data.publicUrl,
    download: storage.getPublicUrl(path, { download: name ?? true }).data
      .publicUrl,
  };
}

/* ────────────────────────────────────────────────────────────
   ANIMASI
   - Blok judul masuk berurutan saat halaman dibuka
   - Panel di bawahnya muncul saat masuk layar (scroll)
   - Selebihnya merespons aksi pengguna: pointer, klik, salin tautan
   - Otomatis mati kalau perangkat memakai "reduce motion"

   CSS ini sama dengan beranda. Kalau sudah dipindah ke globals.css,
   hapus konstanta ini dan tag <style> di bawah.
   ──────────────────────────────────────────────────────────── */

const DETAIL_CSS = `
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes popIn{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
.anim-fade-up{animation:fadeUp .8s cubic-bezier(.22,1,.36,1) both}
.anim-pop{animation:popIn .25s cubic-bezier(.34,1.56,.64,1) both}
.parallax{transition:transform .35s ease-out;will-change:transform}

.reveal{
  opacity:0;
  transform:translateY(20px);
  transition:opacity .7s cubic-bezier(.22,1,.36,1),transform .7s cubic-bezier(.22,1,.36,1);
}
.reveal.is-in{opacity:1;transform:none}

@media (prefers-reduced-motion:reduce){
  .anim-fade-up,.anim-pop{animation:none!important}
  .parallax{transform:none!important;transition:none}
  .reveal{opacity:1!important;transform:none!important;transition:none!important}
}
`;

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

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
   PALET WARNA (sama dengan beranda)
   - Brand  : emerald. Solid 700 (hover 800). Tint 50 dengan teks 800.
   - Aksen  : amber-300, hanya di atas banner hijau tua dan hanya
              untuk tenggat dekat.
   - Netral : slate. Halaman 50 / 950, permukaan putih / 900.
              Teks meta 600 / 400 (sama dengan beranda).
   - Merah  : hanya untuk pesan error.
   - TOMBOL  = rounded-xl, ada batas + bayangan tipis, berubah saat hover.
   - LENCANA = pil (rounded-full), datar, tidak bisa diklik.
   ──────────────────────────────────────────────────────────── */

const surface =
  "border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";

const dashedBox =
  "rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900";

const textHeading = "text-slate-900 dark:text-slate-50";
const textMuted = "text-slate-600 dark:text-slate-400";

const brandTint =
  "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20";

const btnShape =
  "inline-flex items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition duration-200 active:scale-[0.97]";

const btnPrimary =
  "border-emerald-700 bg-emerald-700 text-white shadow-sm shadow-emerald-900/20 hover:border-emerald-800 hover:bg-emerald-800 hover:shadow-md hover:shadow-emerald-700/25";

const btnOutline =
  "border-emerald-300 bg-white text-emerald-800 shadow-sm hover:border-emerald-500 hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-transparent dark:text-emerald-300 dark:hover:border-emerald-400 dark:hover:bg-emerald-500/10";

const btnDanger =
  "border-red-300 bg-white text-red-800 shadow-sm hover:bg-red-50 dark:border-red-500/40 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-950/40";

const btnDisabled =
  "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 active:scale-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30";

const focusRingOnDark =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50";

// Tombol di banner (kembali, salin tautan)
const heroBtn =
  "inline-flex h-10 items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:border-white hover:bg-white hover:text-emerald-900 active:scale-[0.97]";

// Lencana datar di banner (mata kuliah, semester, tahun ajaran)
const heroChip =
  "inline-flex items-center gap-1.5 rounded-full bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-50";

// Kotak informasi di banner (panel dan strip batas pengumpulan)
const heroInfoBox = "bg-emerald-950/40 ring-1 ring-inset ring-white/10";

// Gradasi banner, dipakai juga oleh skeleton
const heroGradient =
  "bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 dark:via-emerald-950 dark:to-emerald-900";

/* ────────────────────────────────────────────────────────────
   IKON
   ──────────────────────────────────────────────────────────── */

const ICONS = {
  arrowLeft: <path d="M19 12H5M12 19l-7-7 7-7" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  bookmark: <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />,
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5M12 15V3" />
    </>
  ),
  external: (
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>
  ),
  file: (
    <>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <path d="M14 2v6h6M16 13H8M16 17H8" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  tick: <path d="m5 12 5 5L20 7" />,
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
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
   TEMA GELAP
   Membaca class "dark" di <html>, yang dipasang oleh skrip di layout.tsx.
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
   KOMPONEN
   ──────────────────────────────────────────────────────────── */

/**
 * Header seperti beranda. Tinggi tetap (h-16): header yang mengecil saat
 * scroll menggeser konten dan bisa membuat scroll bergetar. Efeknya hanya
 * bayangan dan garis progress baca.
 */
function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const dark = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

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
    } catch { }
  }

  const themeLabel = dark ? "Aktifkan tema terang" : "Aktifkan tema gelap";

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b border-slate-200 bg-white/85 backdrop-blur-md transition-shadow duration-300 dark:border-slate-800 dark:bg-slate-950/85 ${scrolled ? "shadow-md shadow-slate-900/5 dark:shadow-black/20" : ""
        }`}
    >
      <div className={`flex h-16 items-center justify-between gap-3 ${CONTAINER}`}>
        <Link
          href="/"
          aria-label="Arsip Tugas, ke beranda"
          className={`flex min-w-0 items-center gap-3 rounded-lg transition-transform duration-200 hover:scale-[1.02] active:scale-95 ${focusRing}`}
        >
          <Image
            src="/logo-unper.png"
            alt="Logo Universitas Perjuangan Tasikmalaya"
            width={40}
            height={40}
            priority
            className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10"
          />
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
            {ACADEMIC_LABEL}
          </span>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={themeLabel}
            title={themeLabel}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition duration-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 active:scale-90 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300 ${focusRing}`}
          >
            <span className="relative block h-[18px] w-[18px]">
              <Icon
                name="sun"
                className={`absolute inset-0 h-[18px] w-[18px] transition-all duration-500 ${dark
                    ? "rotate-0 scale-100 opacity-100"
                    : "-rotate-90 scale-0 opacity-0"
                  }`}
              />
              <Icon
                name="moon"
                className={`absolute inset-0 h-[18px] w-[18px] transition-all duration-500 ${dark
                    ? "rotate-90 scale-0 opacity-0"
                    : "rotate-0 scale-100 opacity-100"
                  }`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Progress baca halaman */}
      <div
        ref={progressRef}
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-gradient-to-r from-emerald-700 to-emerald-400"
        style={{ transform: "scaleX(0)" }}
      />
    </header>
  );
}

/** Tombol kembali. Di layar kecil labelnya dipendekkan agar muat satu baris. */
function BackLink({ onDark = false }: { onDark?: boolean }) {
  return (
    <Link
      href="/#daftar-tugas"
      aria-label="Kembali ke daftar tugas"
      className={`group/back ${onDark
          ? `${heroBtn} ${focusRingOnDark}`
          : `${btnShape} h-10 ${btnOutline} ${focusRing}`
        }`}
    >
      <Icon
        name="arrowLeft"
        className="h-4 w-4 transition-transform duration-200 group-hover/back:-translate-x-1"
      />
      <span className="sm:hidden">Kembali</span>
      <span className="hidden sm:inline">Kembali ke daftar tugas</span>
    </Link>
  );
}

/** Salin tautan halaman. Ikon berganti ke centang dengan efek pop. */
function CopyLinkButton() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2200);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`${heroBtn} shrink-0 ${state === "copied" ? "!border-white !bg-white !text-emerald-900" : ""
        } ${focusRingOnDark}`}
    >
      <span key={state} className="anim-pop inline-flex">
        <Icon name={state === "copied" ? "tick" : "link"} className="h-4 w-4" />
      </span>
      <span aria-live="polite">
        {state === "copied"
          ? "Tautan disalin"
          : state === "failed"
            ? "Gagal menyalin"
            : "Salin tautan"}
      </span>
    </button>
  );
}

/**
 * Lencana sisa waktu. Kuning (aksen) hanya untuk tenggat dalam 3 hari,
 * titik berdenyut kalau tinggal hari ini atau besok.
 */
function DeadlineBadge({ deadline }: { deadline: string }) {
  const diff = daysUntil(deadline);
  const urgent = diff >= 0 && diff <= 3;
  const pulsing = diff >= 0 && diff <= 1;
  const label =
    diff > 1
      ? `${diff} hari lagi`
      : diff === 1
        ? "Besok"
        : diff === 0
          ? "Hari ini"
          : "Sudah lewat";
  const tone = urgent
    ? "bg-amber-300 text-emerald-950"
    : diff > 3
      ? "bg-white/15 text-white ring-1 ring-inset ring-white/25"
      : "bg-white/10 text-emerald-100 ring-1 ring-inset ring-white/20";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}
    >
      {pulsing && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-950/60 motion-safe:animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-950" />
        </span>
      )}
      {label}
    </span>
  );
}

/** Panel batas pengumpulan di sisi kanan banner (hanya layar lebar). */
function DeadlinePanel({ deadline }: { deadline: string }) {
  const parts = dateParts(deadline);

  return (
    <div
      className={`anim-fade-up hidden w-64 shrink-0 rounded-2xl p-5 backdrop-blur-sm lg:block ${heroInfoBox}`}
      style={delay(380)}
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">
        Batas pengumpulan
      </p>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-5xl font-extrabold leading-none tabular-nums text-white">
          {parts.day}
        </span>
        <span className="text-sm font-semibold text-emerald-100">
          {parts.monthYear}
        </span>
      </p>
      <p className="mt-1 text-sm text-emerald-100">{parts.weekday}</p>
      <div className="mt-4">
        <DeadlineBadge deadline={deadline} />
      </div>
    </div>
  );
}

/** Versi ringkas panel batas pengumpulan untuk layar kecil, di bawah judul. */
function DeadlineStrip({ deadline }: { deadline: string }) {
  const parts = dateParts(deadline);

  return (
    <div
      className={`anim-fade-up mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 rounded-2xl px-4 py-3 lg:hidden ${heroInfoBox}`}
      style={delay(320)}
    >
      <div className="flex items-center gap-3">
        <Icon name="clock" className="h-5 w-5 shrink-0 text-emerald-200" />
        <div>
          <p className="text-xs font-medium text-emerald-100">
            Batas pengumpulan
          </p>
          <p className="text-sm font-bold text-white">
            {parts.weekday}, {formatDate(deadline)}
          </p>
        </div>
      </div>
      <DeadlineBadge deadline={deadline} />
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <dt className={`shrink-0 ${textMuted}`}>{label}</dt>
      <dd className="text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">
        {children}
      </dd>
    </div>
  );
}

function Notice({
  tone = "neutral",
  title,
  message,
  action,
}: {
  tone?: "neutral" | "error";
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const isError = tone === "error";
  return (
    <div className={`mx-auto w-full max-w-2xl py-10 sm:py-12 ${GUTTER}`}>
      <div className="mb-6">
        <BackLink />
      </div>
      <div
        role={isError ? "alert" : undefined}
        className={`anim-fade-up ${isError
            ? "rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center dark:border-red-900/50 dark:bg-red-950/20"
            : dashedBox
          }`}
      >
        <h1
          className={`text-lg font-bold ${isError ? "text-red-800 dark:text-red-300" : textHeading
            }`}
        >
          {title}
        </h1>
        <p
          className={`mt-2 text-sm ${isError ? "text-red-700 dark:text-red-300/80" : textMuted
            }`}
        >
          {message}
        </p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat detail tugas">
      <div className={`${CONTAINER} pt-4 sm:pt-6`}>
        <div
          className={`animate-pulse overflow-hidden rounded-3xl ${heroGradient}`}
        >
          <div className={HERO_PAD}>
            <div className="flex items-center justify-between gap-4">
              <div className="h-10 w-28 rounded-xl bg-white/20 sm:w-52" />
              <div className="h-10 w-32 rounded-xl bg-white/20" />
            </div>
            <div className="mt-6 h-7 w-36 rounded-full bg-white/15 sm:mt-8" />
            <div className="mt-4 h-10 w-full max-w-xl rounded bg-white/25" />
            <div className="mt-3 h-10 w-2/3 max-w-md rounded bg-white/25" />
            <div className="mt-6 flex gap-2">
              <div className="h-8 w-28 rounded-full bg-white/15" />
              <div className="h-8 w-32 rounded-full bg-white/15" />
            </div>
          </div>
        </div>
      </div>

      <div
        className={`grid animate-pulse gap-6 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-x-10 lg:py-12 ${CONTAINER}`}
      >
        <div className="space-y-4">
          <div className="h-6 w-44 rounded bg-slate-200 dark:bg-slate-700" />
          <div className={`${surface} space-y-3 rounded-2xl p-6`}>
            <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-4 w-5/6 rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-4 w-2/3 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
        <div className="space-y-6">
          <div className={`${surface} h-60 rounded-2xl`} />
          <div className={`${surface} h-64 rounded-2xl`} />
        </div>
      </div>
    </div>
  );
}

function TaskDetail({ task, related }: { task: Task; related: Task[] }) {
  const courseName = task.courses?.name ?? "Mata Kuliah";
  const urls = useMemo(
    () => resolveDocumentUrls(task.document_path, task.document_name),
    [task.document_path, task.document_name]
  );
  // Sama dengan beranda: jenis berkas hanya ada kalau berkasnya ada
  const fileType = urls ? getFileExtension(task.document_name) : undefined;

  // Cahaya di banner bergeser halus mengikuti kursor (hanya mouse)
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

  return (
    <>
      {/* ───── BANNER JUDUL (kartu inset, seperti beranda) ───── */}
      <div className={`${CONTAINER} pt-4 sm:pt-6`}>
        <section
          aria-labelledby="judul-tugas"
          onPointerMove={handleHeroMove}
          onPointerLeave={handleHeroLeave}
          className={`relative isolate overflow-hidden rounded-3xl text-white shadow-lg shadow-emerald-950/20 ${heroGradient}`}
        >
          <div
            aria-hidden="true"
            className="parallax pointer-events-none absolute -right-20 -top-28 -z-10 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl"
            style={{
              transform:
                "translate3d(calc(var(--px, 0) * -28px), calc(var(--py, 0) * -28px), 0)",
            }}
          />

          <div className={HERO_PAD}>
            <div
              className="anim-fade-up flex items-center justify-between gap-3"
              style={delay(0)}
            >
              <BackLink onDark />
              <CopyLinkButton />
            </div>

            <div className="mt-6 sm:mt-8 lg:flex lg:items-end lg:justify-between lg:gap-10">
              <div className="min-w-0 max-w-4xl">
                <span
                  className={`anim-fade-up uppercase tracking-wider ${heroChip}`}
                  style={delay(80)}
                >
                  {courseName}
                </span>

                <h1
                  id="judul-tugas"
                  className="anim-fade-up mt-4 break-words text-[1.75rem] font-extrabold leading-[1.2] tracking-tight [text-wrap:balance] sm:text-4xl sm:leading-[1.15] lg:text-5xl"
                  style={delay(160)}
                >
                  {task.title}
                </h1>

                <div
                  className="anim-fade-up mt-5 flex flex-wrap items-center gap-2"
                  style={delay(260)}
                >
                  <span className={heroChip}>
                    <Icon name="bookmark" className="h-3.5 w-3.5" />
                    Semester {task.semester}
                  </span>
                  <span className={heroChip}>
                    <Icon name="calendar" className="h-3.5 w-3.5" />
                    TA {task.academic_year}
                  </span>
                </div>

                {task.deadline && <DeadlineStrip deadline={task.deadline} />}
              </div>

              {task.deadline && <DeadlinePanel deadline={task.deadline} />}
            </div>
          </div>
        </section>
      </div>

      {/* ───── ISI ─────
          Desktop: kiri deskripsi + tugas lain, kanan berkas + informasi
          (menempel saat scroll). Mobile: satu kolom berurutan. */}
      <div
        className={`grid gap-6 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:gap-y-8 lg:py-12 ${CONTAINER}`}
      >
        {/* Deskripsi + jawaban (kolom kiri). Jawaban tidak dibungkus Reveal:
            isinya panjang, dan animasinya sendiri jalan saat tiap bagian terlihat. */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <Reveal>
            <article aria-labelledby="judul-deskripsi">
              <h2
                id="judul-deskripsi"
                className={`text-xl font-extrabold tracking-tight ${textHeading}`}
              >
                Deskripsi tugas
              </h2>
              <div className={`${surface} mt-3 rounded-2xl p-5 shadow-sm sm:p-6`}>
                {task.description?.trim() ? (
                  <p className="max-w-prose whitespace-pre-line break-words text-[15px] leading-7 text-slate-600 sm:text-base sm:leading-8 dark:text-slate-300">
                    {task.description}
                  </p>
                ) : (
                  <p className={`text-sm ${textMuted}`}>
                    Tugas ini belum memiliki deskripsi.
                  </p>
                )}
              </div>
            </article>
          </Reveal>

          {task.content?.trim() && (
            <section aria-labelledby="judul-jawaban" className="mt-10">
              <h2
                id="judul-jawaban"
                className={`text-xl font-extrabold tracking-tight ${textHeading}`}
              >
                Jawaban
              </h2>
              <div className={`${surface} mt-3 rounded-2xl p-5 shadow-sm sm:p-6`}>
                <PostContent source={task.content} />
              </div>
            </section>
          )}
        </div>

        {/* Berkas dan informasi */}
        <Reveal
          delayMs={80}
          className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
        >
          <aside className="space-y-6">
            <section
              aria-labelledby="judul-berkas"
              className={`${surface} rounded-2xl p-5 shadow-sm`}
            >
              <h2
                id="judul-berkas"
                className={`text-base font-bold ${textHeading}`}
              >
                Berkas tugas
              </h2>

              <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${urls
                      ? brandTint
                      : "bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:ring-slate-700"
                    }`}
                >
                  <Icon name="file" className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">
                    {urls
                      ? (task.document_name ?? "Dokumen tugas")
                      : "Belum ada berkas"}
                  </p>
                  <p className={`mt-0.5 text-xs ${textMuted}`}>
                    {urls
                      ? fileType
                        ? `Berkas ${fileType}`
                        : "Dokumen"
                      : "Berkas belum diunggah"}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2.5">
                {urls ? (
                  <>
                    <a
                      href={urls.download}
                      download={task.document_name ?? undefined}
                      className={`group/btn h-11 ${btnShape} ${btnPrimary} ${focusRing}`}
                    >
                      <Icon
                        name="download"
                        className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-y-0.5"
                      />
                      Unduh berkas
                    </a>
                    <a
                      href={urls.view}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group/btn h-11 ${btnShape} ${btnOutline} ${focusRing}`}
                    >
                      <Icon
                        name="external"
                        className="h-4 w-4 transition-transform duration-200 group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5"
                      />
                      Buka di tab baru
                      <span className="sr-only"> (tab baru)</span>
                    </a>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Berkas belum tersedia"
                    className={`h-11 ${btnShape} ${btnDisabled}`}
                  >
                    <Icon name="download" />
                    Unduh berkas
                  </button>
                )}
              </div>
            </section>

            <section
              aria-labelledby="judul-info"
              className={`${surface} rounded-2xl px-5 pb-2 pt-5 shadow-sm`}
            >
              <h2
                id="judul-info"
                className={`text-base font-bold ${textHeading}`}
              >
                Informasi
              </h2>
              <dl className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
                <InfoRow label="Mata kuliah">{courseName}</InfoRow>
                <InfoRow label="Semester">{task.semester}</InfoRow>
                <InfoRow label="Tahun ajaran">{task.academic_year}</InfoRow>
                <InfoRow label="Jenis tugas">
                  {WORK_TYPE_LABEL[task.work_type] ?? "Individu"}
                </InfoRow>
                <InfoRow label="Batas pengumpulan">
                  {task.deadline
                    ? formatDate(task.deadline)
                    : "Belum ditentukan"}
                </InfoRow>
                <InfoRow label="Dipublikasikan">
                  {formatDateTime(task.created_at)}
                </InfoRow>
              </dl>
            </section>
          </aside>
        </Reveal>

        {/* Tugas lain dari mata kuliah yang sama */}
        {related.length > 0 && (
          <Reveal delayMs={160} className="lg:col-start-1 lg:row-start-2">
            <section aria-labelledby="judul-terkait">
              <h2
                id="judul-terkait"
                className={`text-xl font-extrabold tracking-tight ${textHeading}`}
              >
                Tugas lain di {courseName}
              </h2>
              <ul
                className={`${surface} mt-3 divide-y divide-slate-200 overflow-hidden rounded-2xl shadow-sm dark:divide-slate-800`}
              >
                {related.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/tugas/${item.id}`}
                      className={`group/row flex items-center gap-4 px-5 py-4 transition hover:bg-emerald-50 dark:hover:bg-emerald-500/10 ${focusRing} focus-visible:ring-inset`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-snug text-slate-800 transition-colors group-hover/row:text-emerald-800 dark:text-slate-100 dark:group-hover/row:text-emerald-300">
                          {item.title}
                        </span>
                        <span
                          className={`mt-1.5 inline-flex items-center gap-1.5 text-xs ${textMuted}`}
                        >
                          <Icon name="calendar" className="h-3.5 w-3.5" />
                          {item.deadline
                            ? `Batas ${formatDate(item.deadline)}`
                            : "Tanpa batas waktu"}
                        </span>
                      </span>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition duration-200 group-hover/row:border-emerald-300 group-hover/row:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:group-hover/row:border-emerald-500/40 dark:group-hover/row:text-emerald-300">
                        <Icon
                          name="chevronRight"
                          className="h-4 w-4 transition-transform duration-200 group-hover/row:translate-x-0.5"
                        />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>
        )}
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────
   HALAMAN
   Mengambil semua tugas yang dipublikasikan lewat useTasks lalu
   memilih satu berdasarkan id di URL. Tugas draft otomatis tidak
   ditemukan, sama seperti di beranda.

   useParams dibungkus Suspense (lihat TaskDetailPage di bawah) karena
   Cache Components membutuhkannya untuk rute dinamis.
   ──────────────────────────────────────────────────────────── */

function TaskDetailContent() {
  const params = useParams<{ id: string }>();
  const id = String(params.id ?? "");
  const { tasks, loading, error } = useTasks();

  const task = useMemo(() => tasks.find((t) => t.id === id), [tasks, id]);

  const related = useMemo(
    () =>
      task
        ? tasks
          .filter((t) => t.id !== task.id && t.course_id === task.course_id)
          .slice(0, 3)
        : [],
    [tasks, task]
  );

  useEffect(() => {
    if (task) document.title = `${task.title} | Portal Arsip Tugas`;
  }, [task]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800 transition-colors selection:bg-emerald-200 selection:text-emerald-950 dark:bg-slate-950 dark:text-slate-200 dark:selection:bg-emerald-500/30 dark:selection:text-emerald-50">
      <style>{DETAIL_CSS}</style>

      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-emerald-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Lewati ke konten
      </a>

      <SiteHeader />

      <main id="konten" className="flex-1">
        {loading ? (
          <DetailSkeleton />
        ) : error ? (
          <Notice
            tone="error"
            title="Detail tugas gagal dimuat"
            message={error}
            action={
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={`h-11 ${btnShape} ${btnDanger} ${focusRing}`}
              >
                Coba lagi
              </button>
            }
          />
        ) : task ? (
          // key = id: berpindah ke tugas lain memutar ulang animasi masuk
          <TaskDetail key={task.id} task={task} related={related} />
        ) : (
          <Notice
            title="Tugas tidak ditemukan"
            message="Tugas ini belum dipublikasikan, sudah dihapus, atau tautannya salah."
            action={
              <Link
                href="/#daftar-tugas"
                className={`h-11 px-5 ${btnShape} ${btnPrimary} ${focusRing}`}
              >
                Lihat semua tugas
              </Link>
            }
          />
        )}
      </main>

      <footer className="w-full border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div
          className={`flex items-center justify-center py-6 text-center text-xs sm:justify-start sm:text-left ${textMuted} ${CONTAINER}`}
        >
          <p>© 2026 {OWNER}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default function TaskDetailPage() {
  return (
    <Suspense
      // Kerangka yang sama dengan halaman asli (header + skeleton), jadi tidak
      // ada layar kosong saat berpindah dari beranda
      fallback={
        <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-200">
          <style>{DETAIL_CSS}</style>
          <SiteHeader />
          <main className="flex-1">
            <DetailSkeleton />
          </main>
        </div>
      }
    >
      <TaskDetailContent />
    </Suspense>
  );
}