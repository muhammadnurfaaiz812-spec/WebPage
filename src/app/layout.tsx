
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "Portal Arsip Tugas | Muhammad Nur Faaiz",
    template: "%s | Portal Arsip Tugas",
  },
  description:
    "Portal Arsip Tugas Muhammad Nur Faaiz, mahasiswa Teknik Informatika Universitas Perjuangan Tasikmalaya. Repositori dan dokumentasi tugas perkuliahan.",
  applicationName: "Portal Arsip Tugas",
  authors: [{ name: "Muhammad Nur Faaiz" }],
  keywords: [
    "Portal Arsip Tugas",
    "Repositori Akademik",
    "Teknik Informatika",
    "Universitas Perjuangan Tasikmalaya",
    "Sistem Operasi",
  ],
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Portal Arsip Tugas",
    title: "Portal Arsip Tugas | Muhammad Nur Faaiz",
    description:
      "Repositori dan dokumentasi tugas perkuliahan Muhammad Nur Faaiz, Teknik Informatika Universitas Perjuangan Tasikmalaya.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

const themeScript = `
(function () {
  try {
    var saved = localStorage.getItem("theme");
    var dark = saved
      ? saved === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;

    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrains.variable} h-full`}
    >
      <body className="flex min-h-full flex-col font-sans antialiased">
        <Script
          id="theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />

        {children}
      </body>
    </html>
  );
}
