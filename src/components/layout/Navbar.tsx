
import Link from "next/link";

export default function Navbar() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white">
                        A
                    </div>

                    <div>
                        <h1 className="text-base font-bold text-slate-900">
                            Portal Arsip Tugas
                        </h1>
                        <p className="text-xs text-slate-500">
                            Teknik Informatika
                        </p>
                    </div>
                </Link>

                {/* Navigasi */}
                <nav className="hidden items-center gap-8 md:flex">
                    <Link
                        href="/"
                        className="text-sm font-semibold text-emerald-700"
                    >
                        Beranda
                    </Link>

                    <Link
                        href="/#daftar-tugas"
                        className="text-sm font-medium text-slate-600 transition hover:text-emerald-600"
                    >
                        Daftar Tugas
                    </Link>
                </nav>

                {/* Tombol Admin */}
                <Link
                    href="/admin/login"
                    className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                    Login Admin
                </Link>
            </div>
        </header>
    );
}
