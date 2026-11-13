import type { Metadata } from "next";
import type { ReactNode } from "react";

// Halaman admin tidak boleh muncul di mesin pencari
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
