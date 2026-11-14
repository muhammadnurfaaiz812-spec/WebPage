"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useAdminGuard } from "@/features/admin/hooks/useAdminGuard";
import { signOut } from "@/features/admin/services/adminService";
import {
  btnPrimary,
  btnSecondary,
  focusRing,
  surface,
} from "@/features/admin/ui";

// Sama persis dengan CONTAINER di halaman publik ((public)/page.tsx),
// jadi tepi kiri-kanan header dan konten sejajar di kedua area.
// Ubah di dua tempat sekaligus kalau suatu saat lebarnya diganti.
const CONTAINER = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

/* ────────────────────────────────────────────────────────────
   IKON (inline SVG, tanpa dependensi tambahan)
   Ukuran dipisah dari className ("size"), supaya className tambahan
   tidak pernah menghapus ukuran bawaan.
   ──────────────────────────────────────────────────────────── */

const ICONS = {
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
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
  size = "h-[18px] w-[18px]",
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

function Spinner({ size = "h-[18px] w-[18px]" }: { size?: string }) {
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
   TEMA GELAP
   Membaca class "dark" di <html>, yang dipasang oleh skrip di layout.tsx
   utama. Sama dengan halaman publik, jadi pilihan tema ikut terbawa.
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

function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Aktifkan tema terang" : "Aktifkan tema gelap"}
      title={dark ? "Tema terang" : "Tema gelap"}
      className={`${headerButton} w-10 ${headerQuiet}`}
    >
      {/* Ikon matahari dan bulan bertukar dengan putaran */}
      <span className="relative block h-[18px] w-[18px]">
        <Icon
          name="sun"
          className={`absolute inset-0 transition-all duration-500 ${
            dark
              ? "rotate-0 scale-100 opacity-100"
              : "-rotate-90 scale-0 opacity-0"
          }`}
        />
        <Icon
          name="moon"
          className={`absolute inset-0 transition-all duration-500 ${
            dark
              ? "rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100"
          }`}
        />
      </span>
    </button>
  );
}

/* ────────────────────────────────────────────────────────────
   STYLE TOKENS (sama dengan beranda dan halaman admin lain)
   Tombol header: bentuk yang sama, dua warna.
   - Tenang : netral, hover slate (sama dengan tombol tema di situs publik)
   - Keluar : netral saat diam, merah hanya saat disorot
   ──────────────────────────────────────────────────────────── */

const headerButton = `inline-flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition duration-200 active:scale-95 disabled:cursor-wait ${focusRing}`;

const headerQuiet =
  "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800";

const headerDanger =
  "text-slate-600 hover:bg-red-50 hover:text-red-700 dark:text-slate-300 dark:hover:bg-red-500/10 dark:hover:text-red-400";

/* ────────────────────────────────────────────────────────────
   HOOK
   ──────────────────────────────────────────────────────────── */

/** Keluar dengan status "sedang proses", supaya tidak terklik dua kali. */
function useSignOut() {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return { signingOut, handleSignOut };
}

/* ────────────────────────────────────────────────────────────
   KOMPONEN
   ──────────────────────────────────────────────────────────── */

function CenterMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-400">
      {children}
    </div>
  );
}

/** Lingkaran berinisial: penanda akun yang sedang masuk. */
function Avatar({ email }: { email: string | null }) {
  const initial = email?.trim().charAt(0).toUpperCase() || "A";
  return (
    <span
      aria-hidden="true"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-800 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20"
    >
      {initial}
    </span>
  );
}

function AdminHeader({ email }: { email: string | null }) {
  const { signingOut, handleSignOut } = useSignOut();
  const [scrolled, setScrolled] = useState(false);

  // Header mengecil dan diberi bayangan saat halaman di-scroll,
  // sama dengan header di situs publik
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    // Latar header selebar layar; isinya dibatasi CONTAINER
    <header
      className={`sticky top-0 z-40 w-full border-b border-slate-200 bg-white/85 backdrop-blur-md transition-shadow duration-300 dark:border-slate-800 dark:bg-slate-950/85 ${
        scrolled ? "shadow-md shadow-slate-900/5 dark:shadow-black/20" : ""
      }`}
    >
      <div
        className={`${CONTAINER} flex items-center justify-between gap-4 transition-[height] duration-300 ${
          scrolled ? "h-14" : "h-16"
        }`}
      >
        {/* Merek: logo + nama panel + subjudul, gaya yang sama dengan situs */}
        <Link
          href="/admin"
          aria-label="Panel Admin, ke daftar tugas"
          className={`flex shrink-0 items-center gap-3 rounded-lg transition-transform duration-200 hover:scale-[1.02] active:scale-95 ${focusRing}`}
        >
          <Image
            src="/logo-unper.png"
            alt=""
            width={40}
            height={40}
            priority
            className="h-9 w-9 object-contain sm:h-10 sm:w-10"
          />
          <span className="flex flex-col leading-none">
            <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              Panel Admin
            </span>
            <span className="mt-1.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-600 sm:text-[8.5px] sm:tracking-[0.2em] dark:text-slate-400">
              Arsip Tugas
            </span>
          </span>
        </Link>

        {/* Aksi. Di bawah sm hanya ikon (label tetap ada untuk pembaca layar) */}
        <nav aria-label="Menu admin" className="flex items-center gap-1">
          <Link
            href="/"
            target="_blank"
            rel="noopener"
            aria-label="Lihat situs (tab baru)"
            title="Lihat situs (tab baru)"
            className={`${headerButton} w-10 sm:w-auto sm:px-3.5 ${headerQuiet}`}
          >
            <Icon name="globe" />
            <span className="hidden sm:inline">Lihat situs</span>
          </Link>

          <ThemeToggle />

          <span
            aria-hidden="true"
            className="mx-1.5 hidden h-6 w-px bg-slate-200 dark:bg-slate-800 sm:block"
          />

          {/* Akun yang sedang masuk (md ke atas) */}
          <span
            title={email ?? undefined}
            className="mr-1 hidden h-10 items-center gap-2.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-4 md:flex dark:border-slate-700 dark:bg-slate-800"
          >
            <Avatar email={email} />
            <span className="max-w-[14rem] truncate text-xs font-medium text-slate-700 dark:text-slate-200">
              <span className="sr-only">Masuk sebagai </span>
              {email}
            </span>
          </span>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Keluar"
            title="Keluar"
            className={`${headerButton} w-10 sm:w-auto sm:px-3.5 ${headerDanger}`}
          >
            {signingOut ? <Spinner /> : <Icon name="logout" />}
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </nav>
      </div>
    </header>
  );
}

/** Akun berhasil masuk tetapi bukan admin. */
function ForbiddenScreen({ email }: { email: string | null }) {
  const { signingOut, handleSignOut } = useSignOut();

  return (
    <CenterMessage>
      <div
        role="alert"
        className={`${surface} w-full max-w-sm rounded-2xl p-8 shadow-sm`}
      >
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
          <Icon name="lock" size="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-50">
          Akses ditolak
        </h1>
        <p className="mt-2 leading-6">
          Akun{" "}
          <strong className="break-all font-semibold text-slate-800 dark:text-slate-200">
            {email}
          </strong>{" "}
          berhasil masuk, tetapi tidak terdaftar sebagai admin.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className={btnPrimary}
          >
            {signingOut ? <Spinner /> : <Icon name="logout" />}
            Keluar
          </button>
          <Link href="/" className={btnSecondary}>
            <Icon name="globe" />
            Kembali ke situs
          </Link>
        </div>
      </div>
    </CenterMessage>
  );
}

/* ────────────────────────────────────────────────────────────
   LAYOUT
   ──────────────────────────────────────────────────────────── */

export default function AdminPanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { state, email } = useAdminGuard();

  useEffect(() => {
    if (state === "anon") router.replace("/admin/login");
  }, [state, router]);

  if (state === "checking" || state === "anon") {
    return (
      <CenterMessage>
        <Spinner size="h-6 w-6 text-emerald-700 dark:text-emerald-400" />
        <p role="status">Memeriksa sesi...</p>
      </CenterMessage>
    );
  }

  if (state === "forbidden") {
    return <ForbiddenScreen email={email} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-emerald-200 selection:text-emerald-950 dark:bg-slate-950 dark:text-slate-200 dark:selection:bg-emerald-500/30 dark:selection:text-emerald-50">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-emerald-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Lewati ke konten
      </a>

      <AdminHeader email={email} />

      <main id="konten" className={`${CONTAINER} py-8 sm:py-10`}>
        {children}
      </main>
    </div>
  );
}