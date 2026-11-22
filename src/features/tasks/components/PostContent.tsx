"use client";

/* Menampilkan isi posting dalam Markdown (tabel, judul, daftar, gambar).
   Blok berpagar ```disk ... ``` diubah menjadi jawaban Disk Scheduling lengkap.
   Butuh: npm i react-markdown remark-gfm
   Simpan sebagai src/features/tasks/components/PostContent.tsx
   Catatan keamanan: HTML mentah di dalam Markdown TIDAK dirender. */

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import DiskSchedulingPost from "@/features/tasks/components/DiskSchedulingPost";

const textHeading = "text-slate-900 dark:text-slate-50";

const components: Components = {
    h1: ({ children }) => (
        <h2 className={`mb-3 mt-10 border-l-4 border-emerald-600 pl-3 text-xl font-extrabold tracking-tight first:mt-0 ${textHeading}`}>
            {children}
        </h2>
    ),
    h2: ({ children }) => (
        <h2 className={`mb-3 mt-10 border-l-4 border-emerald-600 pl-3 text-xl font-extrabold tracking-tight first:mt-0 ${textHeading}`}>
            {children}
        </h2>
    ),
    h3: ({ children }) => (
        <h3 className={`mb-2 mt-7 text-lg font-bold tracking-tight ${textHeading}`}>{children}</h3>
    ),
    h4: ({ children }) => (
        <h4 className={`mb-2 mt-5 text-base font-bold ${textHeading}`}>{children}</h4>
    ),
    p: ({ children }) => (
        <p className="my-3 break-words text-[15px] leading-7 text-slate-600 dark:text-slate-300 sm:text-base sm:leading-8">
            {children}
        </p>
    ),
    ul: ({ children }) => (
        <ul className="my-3 list-disc space-y-1.5 pl-6 text-[15px] leading-7 text-slate-600 dark:text-slate-300">{children}</ul>
    ),
    ol: ({ children }) => (
        <ol className="my-3 list-decimal space-y-1.5 pl-6 text-[15px] leading-7 text-slate-600 dark:text-slate-300">{children}</ol>
    ),
    strong: ({ children }) => (
        <strong className={`font-semibold ${textHeading}`}>{children}</strong>
    ),
    a: ({ href, children }) => (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800 dark:text-emerald-300"
        >
            {children}
        </a>
    ),
    blockquote: ({ children }) => (
        <blockquote className="my-4 rounded-r-xl border-l-4 border-emerald-600 bg-emerald-50/70 px-4 py-1 dark:bg-emerald-500/10">
            {children}
        </blockquote>
    ),
    hr: () => <hr className="my-8 border-slate-200 dark:border-slate-800" />,
    img: ({ src, alt }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={typeof src === "string" ? src : undefined}
            alt={alt ?? ""}
            loading="lazy"
            className="my-4 h-auto max-w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700"
        />
    ),
    table: ({ children }) => (
        <div className="my-5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[20rem] text-left text-sm">{children}</table>
        </div>
    ),
    thead: ({ children }) => <thead className="bg-slate-50 dark:bg-slate-950/40">{children}</thead>,
    tbody: ({ children }) => (
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">{children}</tbody>
    ),
    th: ({ children }) => (
        <th className="px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
            {children}
        </th>
    ),
    td: ({ children }) => (
        <td className="px-3 py-2.5 align-top tabular-nums text-slate-700 dark:text-slate-300">{children}</td>
    ),
    // Blok berpagar: ```disk jadi widget, bahasa lain jadi kotak kode biasa
    pre: ({ children }) => <>{children}</>,
    code: ({ className, children }) => {
        const text = String(children ?? "").replace(/\n$/, "");
        const lang = /language-([\w-]+)/.exec(className ?? "")?.[1];

        if (lang === "disk") {
            return (
                <div className="my-6">
                    <DiskSchedulingPost source={text} />
                </div>
            );
        }
        if (lang || text.includes("\n")) {
            return (
                <pre className="my-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-[13px] leading-6 text-slate-100">
                    <code>{text}</code>
                </pre>
            );
        }
        return (
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em] text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                {text}
            </code>
        );
    },
};

export default function PostContent({ source }: { source: string }) {
    return (
        <div className="min-w-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {source}
            </ReactMarkdown>
        </div>
    );
}