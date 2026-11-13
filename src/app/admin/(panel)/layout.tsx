"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAdminGuard } from "@/features/admin/hooks/useAdminGuard";
import { signOut } from "@/features/admin/services/adminService";
import { GUTTER, btnPrimary, focusRing } from "@/features/admin/ui";

function CenterMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
      {children}
    </div>
  );
}

export default function AdminPanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { state, email } = useAdminGuard();

  useEffect(() => {
    if (state === "anon") router.replace("/admin/login");
  }, [state, router]);

  if (state === "checking" || state === "anon") {
    return <CenterMessage>Memeriksa sesi...</CenterMessage>;
  }

  if (state === "forbidden") {
    return (
      <CenterMessage>
        <p className="max-w-sm">
          Akun {email} berhasil masuk, tetapi tidak terdaftar sebagai admin.
        </p>
        <button type="button" onClick={signOut} className={btnPrimary}>
          Keluar
        </button>
      </CenterMessage>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-200">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/85">
        <div
          className={`mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 ${GUTTER}`}
        >
          <Link
            href="/admin"
            className={`flex items-center gap-3 rounded-lg ${focusRing}`}
          >
            <Image
              src="/logo-unper.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
            <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              Panel Admin
            </span>
          </Link>

          <div className="flex items-center gap-1 text-sm font-semibold">
            <span className="mr-2 hidden max-w-[14rem] truncate text-xs font-normal text-slate-500 md:block dark:text-slate-400">
              {email}
            </span>
            <Link
              href="/"
              target="_blank"
              className={`rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${focusRing}`}
            >
              Lihat situs
            </Link>
            <button
              type="button"
              onClick={signOut}
              className={`rounded-lg px-3 py-2 text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 ${focusRing}`}
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className={`mx-auto w-full max-w-5xl py-8 ${GUTTER}`}>{children}</main>
    </div>
  );
}
