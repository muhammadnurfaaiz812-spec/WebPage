"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useAdminGuard } from "@/features/admin/hooks/useAdminGuard";
import { signIn } from "@/features/admin/services/adminService";
import {
  btnPrimary,
  errorMessage,
  field,
  fieldLabel,
  focusRing,
} from "@/features/admin/ui";

// Foto latar ada di folder public/. Simpan filenya di public/login-bg.png
// (atau ubah path ini, mis. "/gedung-rektorat.webp").
const LOGIN_BACKGROUND = "/login-bg.png";

/* ────────────────────────────────────────────────────────────
   IKON (inline SVG, tanpa dependensi tambahan)
   ──────────────────────────────────────────────────────────── */

function Svg({
  children,
  className = "h-4 w-4",
}: {
  children: ReactNode;
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
      {children}
    </svg>
  );
}

function MailIcon() {
  return (
    <Svg className="h-[18px] w-[18px]">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </Svg>
  );
}

function LockIcon() {
  return (
    <Svg className="h-[18px] w-[18px]">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <Svg className="h-[18px] w-[18px]">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="m2 2 20 20" />
    </Svg>
  ) : (
    <Svg className="h-[18px] w-[18px]">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

function LoginIcon() {
  return (
    <Svg className="h-[18px] w-[18px]">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="m10 17 5-5-5-5M15 12H3" />
    </Svg>
  );
}

function AlertIcon() {
  return (
    <Svg className="mt-0.5 h-4 w-4 shrink-0">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </Svg>
  );
}

function ArrowLeftIcon() {
  return (
    <Svg>
      <path d="m12 19-7-7 7-7M19 12H5" />
    </Svg>
  );
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[18px] w-[18px] animate-spin motion-reduce:animate-none"
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
   GAYA LOKAL
   Gaya kolom isian, label, dan tombol utama tetap dari
   @/features/admin/ui supaya seragam dengan halaman admin lain.
   Yang di sini hanya tambahan khusus halaman login.
   ──────────────────────────────────────────────────────────── */

// Batas merah saat kolom kosong waktu dikirim. Memakai atribut aria-invalid
// dan penanda "!" supaya menang atas batas bawaan token `field`.
const invalidField =
  "aria-[invalid=true]:!border-red-500 dark:aria-[invalid=true]:!border-red-400";

// Ikon di dalam kolom isian (kiri); berubah hijau saat kolom difokuskan
const leadingIcon =
  "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-emerald-600 dark:text-slate-400 dark:group-focus-within:text-emerald-400";

// Tombol tampil/sembunyi kata sandi, menempel di dalam kolom isian (kanan)
const toggleButton =
  "absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-emerald-700 active:scale-90 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-emerald-300";

type Invalid = { email: boolean; password: boolean };
const VALID: Invalid = { email: false, password: false };

/* ────────────────────────────────────────────────────────────
   HALAMAN
   ──────────────────────────────────────────────────────────── */

export default function AdminLoginPage() {
  const router = useRouter();
  const { state } = useAdminGuard();

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [invalid, setInvalid] = useState<Invalid>(VALID);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sudah masuk sebagai admin: langsung ke panel
  useEffect(() => {
    if (state === "admin") router.replace("/admin");
  }, [state, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return; // cegah kirim ganda (mis. Enter ditekan dua kali)

    const missing: Invalid = { email: !email.trim(), password: !password };
    if (missing.email || missing.password) {
      setInvalid(missing);
      setError("Isi email dan kata sandi.");
      // Fokus ke kolom pertama yang masih kosong
      (missing.email ? emailRef : passwordRef).current?.focus();
      return;
    }

    setBusy(true);
    setError(null);
    setInvalid(VALID);
    try {
      await signIn(email.trim(), password);
      router.replace("/admin");
    } catch (err) {
      setError(errorMessage(err, "Gagal masuk. Coba lagi."));
      setBusy(false);
      passwordRef.current?.focus();
    }
  }

  // Mengetik berarti pengguna sedang memperbaiki: bersihkan pesan dan tanda merah
  function handleEmailChange(value: string) {
    setEmail(value);
    if (invalid.email) setInvalid((prev) => ({ ...prev, email: false }));
    if (error) setError(null);
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    if (invalid.password) setInvalid((prev) => ({ ...prev, password: false }));
    if (error) setError(null);
  }

  // Sudah masuk: tampilkan status singkat, bukan formulir yang sekilas muncul
  if (state === "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <p
          role="status"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400"
        >
          <Spinner />
          Mengalihkan ke panel...
        </p>
      </div>
    );
  }

  const passwordDescribedBy =
    [invalid.password && "login-error", capsLock && "caps-hint"]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-emerald-900 px-4 py-6 text-slate-800 selection:bg-emerald-200 selection:text-emerald-950 dark:bg-slate-900 dark:text-slate-200 dark:selection:bg-emerald-500/30 dark:selection:text-emerald-50 sm:px-6">
      {/* ───── LATAR ─────
          Foto dari public/, ditutup lapisan terang (gelap di mode gelap)
          supaya kartu tetap menjadi pusat perhatian dan teks mudah dibaca.
          Kalau file fotonya belum ada, warna hijau di atas jadi cadangan. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <Image
          src={LOGIN_BACKGROUND}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/75" />
      </div>

      {/* ───── KARTU ───── */}
      <main className="flex flex-1 items-center justify-center py-6">
        <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/60 bg-white/95 shadow-2xl shadow-slate-900/20 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/95">
          {/* Garis aksen di tepi atas, warna sama dengan progress bar situs */}
          <div
            aria-hidden="true"
            className="h-1 w-full bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-300"
          />

          <div className="px-6 pb-7 pt-8 sm:px-10 sm:pb-9 sm:pt-10">
            {/* Logo + nama situs */}
            <div className="flex items-center justify-center gap-3">
              <Image
                src="/logo-unper.png"
                alt=""
                width={56}
                height={56}
                priority
                className="h-14 w-14 shrink-0 object-contain"
              />
              <div className="min-w-0 leading-tight">
                <p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                  Arsip Tugas
                </p>
                <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  Universitas Perjuangan Tasikmalaya
                </p>
              </div>
            </div>

            {/* Judul */}
            <div className="mt-8 text-center">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 sm:text-[1.75rem]">
                Masuk admin
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Masuk untuk mengelola arsip tugas.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              noValidate
              aria-busy={busy}
              className="mt-7 grid gap-5"
            >
              <div>
                <label htmlFor="email" className={fieldLabel}>
                  Email
                </label>
                <div className="group relative">
                  <span aria-hidden="true" className={leadingIcon}>
                    <MailIcon />
                  </span>
                  <input
                    ref={emailRef}
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    aria-invalid={invalid.email}
                    aria-describedby={invalid.email ? "login-error" : undefined}
                    className={`${field} ${invalidField} !pl-11`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className={fieldLabel}>
                  Kata sandi
                </label>
                <div className="group relative">
                  <span aria-hidden="true" className={leadingIcon}>
                    <LockIcon />
                  </span>
                  <input
                    ref={passwordRef}
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    onKeyDown={(e) =>
                      setCapsLock(e.getModifierState("CapsLock"))
                    }
                    onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                    onBlur={() => setCapsLock(false)}
                    aria-invalid={invalid.password}
                    aria-describedby={passwordDescribedBy}
                    className={`${field} ${invalidField} !pl-11 !pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    // Fokus tetap di kolom isian saat tombol ditekan mouse
                    onMouseDown={(e) => e.preventDefault()}
                    aria-label={
                      showPassword
                        ? "Sembunyikan kata sandi"
                        : "Tampilkan kata sandi"
                    }
                    aria-pressed={showPassword}
                    className={`${toggleButton} ${focusRing}`}
                  >
                    <EyeIcon off={showPassword} />
                  </button>
                </div>

                {capsLock && (
                  <p
                    id="caps-hint"
                    role="status"
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300"
                  >
                    <AlertIcon />
                    Caps Lock aktif
                  </p>
                )}
              </div>

              {error && (
                <p
                  id="login-error"
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
                >
                  <AlertIcon />
                  <span>{error}</span>
                </p>
              )}

              <button type="submit" disabled={busy} className={btnPrimary}>
                <span className="inline-flex items-center justify-center gap-2">
                  {busy ? <Spinner /> : <LoginIcon />}
                  {busy ? "Memeriksa..." : "Masuk"}
                </span>
              </button>
            </form>

            {/* Pemisah + jalan keluar */}
            <div className="mt-7 border-t border-slate-200 pt-5 text-center dark:border-slate-800">
              <Link
                href="/"
                className={`inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-emerald-700 transition hover:underline dark:text-emerald-300 ${focusRing}`}
              >
                <ArrowLeftIcon />
                Kembali ke situs
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ───── HAK CIPTA ───── */}
      <footer className="flex justify-center pt-2">
        <p className="rounded-full bg-white/70 px-4 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-white/60 backdrop-blur dark:bg-slate-900/70 dark:text-slate-300 dark:ring-slate-700">
          © 2026 Muhammad Nur Faaiz
        </p>
      </footer>
    </div>
  );
}