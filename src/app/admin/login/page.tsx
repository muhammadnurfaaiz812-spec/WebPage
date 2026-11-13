"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAdminGuard } from "@/features/admin/hooks/useAdminGuard";
import { signIn } from "@/features/admin/services/adminService";
import {
  btnPrimary,
  errorMessage,
  field,
  fieldLabel,
  focusRing,
  surface,
} from "@/features/admin/ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const { state } = useAdminGuard();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sudah masuk sebagai admin: langsung ke panel
  useEffect(() => {
    if (state === "admin") router.replace("/admin");
  }, [state, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Isi email dan kata sandi.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace("/admin");
    } catch (err) {
      setError(errorMessage(err, "Gagal masuk. Coba lagi."));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-800 dark:bg-slate-950 dark:text-slate-200">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3">
          <Image
            src="/logo-unper.png"
            alt=""
            width={44}
            height={44}
            priority
            className="h-11 w-11 object-contain"
          />
          <div className="leading-tight">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              Masuk admin
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Arsip Tugas
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className={`${surface} mt-6 grid gap-5 rounded-2xl p-6 shadow-sm`}
        >
          <div>
            <label htmlFor="email" className={fieldLabel}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
          </div>

          <div>
            <label htmlFor="password" className={fieldLabel}>
              Kata sandi
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
            >
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? "Memeriksa..." : "Masuk"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm">
          <Link
            href="/"
            className={`rounded font-semibold text-emerald-700 hover:underline dark:text-emerald-300 ${focusRing}`}
          >
            Kembali ke situs
          </Link>
        </p>
      </div>
    </div>
  );
}
