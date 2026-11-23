"use client";

/* Menampilkan jawaban penjadwalan proses CPU dari data soal: tabel ringkasan,
   diagram Gantt beranimasi, tabel per proses, kronologi, gambar gabungan, kesimpulan.
   Simpan sebagai src/features/tasks/components/CpuSchedulingPost.tsx */

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
    parseCpuBlock,
    simulateCpu,
    type CpuConfig,
    type CpuResult,
} from "@/features/tasks/lib/cpuScheduling";

/* ────────────── Token gaya (sama dengan palet situs) ────────────── */

const surface =
    "border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";
const textHeading = "text-slate-900 dark:text-slate-50";
const textMuted = "text-slate-600 dark:text-slate-400";
const brandTint =
    "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20";
const amberTint =
    "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20";
const focusRing =
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30";
const th =
    "px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400";
const td = "px-3 py-2.5 align-top text-sm";
const sectionTitle = `border-l-4 border-emerald-600 pl-3 text-xl font-extrabold tracking-tight ${textHeading}`;

// Satu warna per proses (dipakai di Gantt, legenda, dan baris tabel)
const COLORS = [
    "bg-sky-600",
    "bg-amber-700",
    "bg-emerald-600",
    "bg-rose-600",
    "bg-violet-600",
    "bg-teal-700",
    "bg-orange-600",
    "bg-indigo-600",
    "bg-lime-700",
    "bg-pink-600",
    "bg-cyan-700",
    "bg-fuchsia-600",
];

const CSS = `
@keyframes cgGrow{from{transform:scaleX(0);opacity:0}to{transform:scaleX(1);opacity:1}}
@keyframes cgBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.cg-seg{transform-origin:left;animation:cgGrow .45s ease-out both}
.cg-bar{transform-origin:left;animation:cgBar .8s cubic-bezier(.22,1,.36,1) both}
@media (prefers-reduced-motion:reduce){.cg-seg,.cg-bar{animation:none!important}}
`;

const fmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

function joinNames(names: string[]) {
    if (names.length <= 1) return names[0] ?? "";
    if (names.length === 2) return `${names[0]} dan ${names[1]}`;
    return `${names.slice(0, -1).join(", ")}, dan ${names[names.length - 1]}`;
}

function useInView<T extends Element>(): [RefObject<T | null>, boolean] {
    const ref = useRef<T>(null);
    const [seen, setSeen] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setSeen(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.2 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return [ref, seen];
}

/* ────────────── Diagram Gantt ──────────────
   Setiap blok = proses yang memakai CPU; angka di bawah = waktu. */

function Gantt({
    result,
    end,
    colorOf,
    active = null,
    play = 0,
    compact = false,
}: {
    result: CpuResult;
    end: number;
    colorOf: (id: string) => string;
    active?: string | null;
    play?: number;
    compact?: boolean;
}) {
    const [ref, seen] = useInView<HTMLDivElement>();
    const running = compact || seen ? "running" : "paused";
    const bounds = [...new Set([0, ...result.segments.map((s) => s.end)])];
    const pct = (t: number) => `${(t / end) * 100}%`;

    const label = `Diagram Gantt ${result.name}: ${result.segments
        .map((s) => `${s.proc || "menganggur"} ${s.start} sampai ${s.end}`)
        .join(", ")}`;

    return (
        <div ref={ref} className="overflow-x-auto">
            <div role="img" aria-label={label} className={compact ? "min-w-[24rem]" : "min-w-[34rem]"}>
                <div key={play} className={`relative mx-2 ${compact ? "h-7" : "h-11"}`}>
                    {result.segments.map((s, i) => (
                        <div
                            key={i}
                            className="absolute inset-y-0"
                            style={{
                                left: pct(s.start),
                                width: `${((s.end - s.start) / end) * 100}%`,
                                opacity: active === null || s.proc === active ? 1 : 0.25,
                                transition: "opacity .2s",
                            }}
                        >
                            <div
                                title={`${s.proc || "Menganggur"}: ${s.start} sampai ${s.end}`}
                                className={`cg-seg flex h-full items-center justify-center overflow-hidden border-r border-white/60 text-xs font-bold text-white first:rounded-l-md last:rounded-r-md ${s.proc ? colorOf(s.proc) : "bg-slate-300 !text-slate-600 dark:bg-slate-700 dark:!text-slate-300"
                                    }`}
                                style={{ animationDelay: `${i * 110}ms`, animationPlayState: running }}
                            >
                                {s.proc || (compact ? "" : "–")}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="relative mx-2 mt-1 h-4">
                    {bounds.map((t) => (
                        <span
                            key={t}
                            className="absolute -translate-x-1/2 text-[10px] tabular-nums text-slate-500 dark:text-slate-400"
                            style={{ left: pct(t) }}
                        >
                            {t}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ────────────── Kartu satu algoritma ────────────── */

function AlgoCard({
    result,
    index,
    config,
    colorOf,
}: {
    result: CpuResult;
    index: number;
    config: CpuConfig;
    colorOf: (id: string) => string;
}) {
    const [active, setActive] = useState<string | null>(null);
    const [play, setPlay] = useState(0);
    const n = result.rows.length;

    return (
        <section
            aria-labelledby={`cpu-${result.id}`}
            className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"
        >
            <h4
                id={`cpu-${result.id}`}
                className="flex flex-wrap items-baseline gap-x-2 bg-emerald-800 px-4 py-3 text-sm font-bold text-white dark:bg-emerald-900 sm:text-base"
            >
                <span>
                    {index + 1}. {result.name}
                </span>
                <span className="font-medium text-emerald-100">{result.fullName}</span>
                <span className="ml-auto rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold tabular-nums">
                    Total lama tanggap {result.totalTurnaround}
                </span>
            </h4>

            <div className="space-y-5 p-4">
                <p className={`text-sm leading-6 ${textMuted}`}>{result.summary}</p>

                {/* Gantt */}
                <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <p className={`text-xs font-semibold ${textMuted}`}>Diagram Gantt (arah proses)</p>
                        <button
                            type="button"
                            onClick={() => setPlay((p) => p + 1)}
                            className={`rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300 ${focusRing}`}
                        >
                            Putar ulang
                        </button>
                    </div>
                    <div className={`${surface} rounded-lg p-3`}>
                        <Gantt result={result} end={result.end} colorOf={colorOf} active={active} play={play} />
                    </div>
                    <p className={`mt-1.5 text-xs ${textMuted}`}>
                        Arahkan kursor ke baris tabel untuk menyorot prosesnya di diagram.
                    </p>
                </div>

                {/* Tabel per proses */}
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full min-w-[34rem] text-left">
                        <caption className="sr-only">Hasil per proses untuk {result.name}</caption>
                        <thead className="bg-slate-50 dark:bg-slate-950/40">
                            <tr>
                                <th scope="col" className={th}>Proses</th>
                                <th scope="col" className={`${th} text-right`}>Tiba</th>
                                <th scope="col" className={`${th} text-right`}>Lama proses</th>
                                <th scope="col" className={`${th} text-right`}>Mulai</th>
                                <th scope="col" className={`${th} text-right`}>Selesai</th>
                                <th scope="col" className={`${th} text-right`}>Lama tunggu</th>
                                <th scope="col" className={`${th} text-right`}>Lama tanggap</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {result.rows.map((r) => (
                                <tr
                                    key={r.id}
                                    tabIndex={0}
                                    onMouseEnter={() => setActive(r.id)}
                                    onMouseLeave={() => setActive(null)}
                                    onFocus={() => setActive(r.id)}
                                    onBlur={() => setActive(null)}
                                    className={`outline-none transition-colors ${active === r.id
                                            ? "bg-emerald-50 dark:bg-emerald-500/10"
                                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                        }`}
                                >
                                    <td className={`${td} font-semibold ${textHeading}`}>
                                        <span className="inline-flex items-center gap-2">
                                            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${colorOf(r.id)}`} />
                                            {r.id}
                                        </span>
                                    </td>
                                    <td className={`${td} text-right tabular-nums`}>{r.arrival}</td>
                                    <td className={`${td} text-right tabular-nums`}>{r.burst}</td>
                                    <td className={`${td} text-right tabular-nums`}>{r.start}</td>
                                    <td className={`${td} text-right tabular-nums`}>{r.finish}</td>
                                    <td className={`${td} text-right tabular-nums`}>{r.waiting}</td>
                                    <td className={`${td} text-right font-semibold tabular-nums ${textHeading}`}>{r.turnaround}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-200 bg-emerald-50/70 dark:border-slate-700 dark:bg-emerald-500/10">
                            <tr>
                                <td colSpan={5} className={`${td} font-bold ${textHeading}`}>Total</td>
                                <td className={`${td} text-right font-bold tabular-nums ${textHeading}`}>{result.totalWaiting}</td>
                                <td className={`${td} text-right font-bold tabular-nums ${textHeading}`}>{result.totalTurnaround}</td>
                            </tr>
                            <tr>
                                <td colSpan={5} className={`${td} font-bold ${textHeading}`}>
                                    Rata-rata <span className={`font-normal ${textMuted}`}>(total ÷ {n} proses)</span>
                                </td>
                                <td className={`${td} text-right font-bold tabular-nums ${textHeading}`}>{fmt.format(result.avgWaiting)}</td>
                                <td className={`${td} text-right font-bold tabular-nums ${textHeading}`}>{fmt.format(result.avgTurnaround)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Kronologi */}
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full min-w-[28rem] text-left">
                        <caption className="sr-only">Kronologi proses {result.name}</caption>
                        <thead className="bg-slate-50 dark:bg-slate-950/40">
                            <tr>
                                <th scope="col" className={th}>Waktu</th>
                                <th scope="col" className={th}>Proses</th>
                                <th scope="col" className={th}>Keterangan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {result.segments.map((s, i) => (
                                <tr key={i}>
                                    <td className={`${td} whitespace-nowrap tabular-nums text-slate-800 dark:text-slate-100`}>
                                        {s.start} – {s.end}
                                    </td>
                                    <td className={`${td} font-semibold ${textHeading}`}>{s.proc || "Menganggur"}</td>
                                    <td className={`${td} text-xs leading-5 ${textMuted}`}>{s.note}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {config.quanta.length > 0 && result.id.startsWith("rr") && (
                    <p className={`text-xs ${textMuted}`}>
                        Aturan antrean: {config.rrOrder === "tiba-dulu"
                            ? "proses yang tiba tepat saat jatah habis masuk antrean lebih dulu daripada proses yang baru dihentikan."
                            : "proses yang baru dihentikan masuk antrean lebih dulu daripada proses yang tiba tepat saat jatah habis."}
                    </p>
                )}
            </div>
        </section>
    );
}

/* ────────────── Rangkuman halaman ────────────── */

function Post({ config }: { config: CpuConfig }) {
    const results = useMemo(() => simulateCpu(config), [config]);
    const [barRef, barSeen] = useInView<HTMLDivElement>();
    const colorOf = (id: string) => {
        const i = config.procs.findIndex((p) => p.id === id);
        return COLORS[(i < 0 ? 0 : i) % COLORS.length];
    };

    const totals = results.map((r) => r.totalTurnaround);
    const min = Math.min(...totals);
    const max = Math.max(...totals);
    const best = results.filter((r) => r.totalTurnaround === min);
    const worst = results.filter((r) => r.totalTurnaround === max);
    const longer = min > 0 ? ((max / min - 1) * 100) : 0;
    const end = Math.max(...results.map((r) => r.end));

    // Algoritma yang urutan eksekusinya persis sama
    const groups = new Map<string, CpuResult[]>();
    for (const r of results) {
        const key = r.segments.map((s) => `${s.proc}@${s.start}-${s.end}`).join("|");
        groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    const same = [...groups.values()].filter((g) => g.length > 1);
    const rrs = results.filter((r) => r.id.startsWith("rr"));

    return (
        <div className="space-y-10">
            <style>{CSS}</style>

            {/* Diketahui */}
            <section aria-labelledby="cpu-diketahui" className={`${surface} rounded-xl p-4 sm:p-5`}>
                <h3 id="cpu-diketahui" className={`text-base font-bold ${textHeading}`}>
                    Diketahui dan asumsi
                </h3>
                <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full min-w-[20rem] text-left">
                        <caption className="sr-only">Data proses</caption>
                        <thead className="bg-slate-50 dark:bg-slate-950/40">
                            <tr>
                                <th scope="col" className={th}>Nama proses</th>
                                <th scope="col" className={`${th} text-right`}>Saat tiba</th>
                                <th scope="col" className={`${th} text-right`}>Lama proses</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {config.procs.map((p) => (
                                <tr key={p.id}>
                                    <td className={`${td} font-semibold ${textHeading}`}>
                                        <span className="inline-flex items-center gap-2">
                                            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${colorOf(p.id)}`} />
                                            {p.id}
                                        </span>
                                    </td>
                                    <td className={`${td} text-right tabular-nums`}>{p.arrival}</td>
                                    <td className={`${td} text-right tabular-nums`}>{p.burst}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <ul className={`mt-4 list-disc space-y-1.5 pl-5 text-sm leading-6 ${textMuted}`}>
                    <li>
                        <strong className={textHeading}>Lama tanggap</strong> = waktu selesai − saat tiba.{" "}
                        <strong className={textHeading}>Lama tunggu</strong> = lama tanggap − lama proses.
                    </li>
                    <li>
                        Rasio penalti (HPRN) = (lama tunggu + lama proses) ÷ lama proses. Saat nilainya seri,
                        dipilih proses yang tiba lebih dulu.
                    </li>
                    <li>
                        SRT: saat sisa waktu sama, proses yang sedang berjalan tidak digantikan.
                    </li>
                    {rrs.length > 0 && (
                        <li>
                            Round Robin memakai kuantum {joinNames(config.quanta.map(String))}.{" "}
                            {config.rrOrder === "tiba-dulu"
                                ? "Proses yang tiba tepat saat jatah habis masuk antrean lebih dulu daripada proses yang baru dihentikan."
                                : "Proses yang baru dihentikan masuk antrean lebih dulu daripada proses yang tiba tepat saat jatah habis."}
                        </li>
                    )}
                </ul>
            </section>

            {/* Ringkasan */}
            <section aria-labelledby="cpu-ringkasan">
                <h3 id="cpu-ringkasan" className={sectionTitle}>
                    Ringkasan Lama Tanggap
                </h3>
                <div ref={barRef} className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full min-w-[30rem] text-left">
                        <caption className="sr-only">Perbandingan total dan rata-rata lama tanggap</caption>
                        <thead className="bg-slate-50 dark:bg-slate-950/40">
                            <tr>
                                <th scope="col" className={`${th} w-12`}>No</th>
                                <th scope="col" className={th}>Algoritma</th>
                                <th scope="col" className={`${th} text-right`}>Total</th>
                                <th scope="col" className={`${th} text-right`}>Rata-rata</th>
                                <th scope="col" className={`${th} w-[32%]`}>Perbandingan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {results.map((r, i) => {
                                const isBest = r.totalTurnaround === min;
                                const isWorst = r.totalTurnaround === max && !isBest;
                                return (
                                    <tr key={r.id} className={isBest ? "bg-emerald-50/70 dark:bg-emerald-500/10" : ""}>
                                        <td className={`${td} tabular-nums`}>{i + 1}</td>
                                        <td className={`${td} font-semibold ${textHeading}`}>
                                            {r.name}
                                            {isBest && (
                                                <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${brandTint}`}>
                                                    Terendah
                                                </span>
                                            )}
                                            {isWorst && (
                                                <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${amberTint}`}>
                                                    Tertinggi
                                                </span>
                                            )}
                                        </td>
                                        <td className={`${td} text-right font-bold tabular-nums ${textHeading}`}>{r.totalTurnaround}</td>
                                        <td className={`${td} text-right font-bold tabular-nums ${textHeading}`}>{fmt.format(r.avgTurnaround)}</td>
                                        <td className={`${td} align-middle`}>
                                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                                <div
                                                    className={`cg-bar h-full rounded-full ${isBest ? "bg-emerald-600" : isWorst ? "bg-amber-500" : "bg-slate-400 dark:bg-slate-500"
                                                        }`}
                                                    style={{
                                                        width: `${max ? (r.totalTurnaround / max) * 100 : 0}%`,
                                                        animationDelay: `${i * 90}ms`,
                                                        animationPlayState: barSeen ? "running" : "paused",
                                                    }}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <p className={`mt-2 text-xs ${textMuted}`}>
                    Rata-rata = total ÷ {config.procs.length} proses. Lama tunggu tiap algoritma ada di tabel rincian.
                </p>
            </section>

            {/* Rincian */}
            <section aria-labelledby="cpu-rincian" className="space-y-6">
                <h3 id="cpu-rincian" className={sectionTitle}>
                    Rincian per Algoritma
                </h3>
                {results.map((r, i) => (
                    <AlgoCard key={r.id} result={r} index={i} config={config} colorOf={colorOf} />
                ))}
            </section>

            {/* Gambar gabungan */}
            <section aria-labelledby="cpu-gabungan">
                <h3 id="cpu-gabungan" className={sectionTitle}>
                    Gambar Gabungan
                </h3>
                <div className={`${surface} mt-4 space-y-4 rounded-xl p-4`}>
                    {results.map((r) => (
                        <div key={r.id}>
                            <p className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                                <span className={`font-bold ${textHeading}`}>{r.name}</span>
                                <span className={`text-xs tabular-nums ${textMuted}`}>Total {r.totalTurnaround}</span>
                            </p>
                            <Gantt result={r} end={end} colorOf={colorOf} compact />
                        </div>
                    ))}
                </div>
            </section>

            {/* Kesimpulan */}
            <section aria-labelledby="cpu-kesimpulan">
                <h3 id="cpu-kesimpulan" className={sectionTitle}>
                    Kesimpulan
                </h3>
                <ul className={`mt-4 list-disc space-y-2 pl-5 text-[15px] leading-7 ${textMuted}`}>
                    <li>
                        <strong className={textHeading}>{joinNames(best.map((b) => b.name))}</strong> menghasilkan
                        lama tanggap terendah: total {min}, rata-rata {fmt.format(best[0].avgTurnaround)}.
                    </li>
                    {!best.some((b) => worst.includes(b)) && (
                        <li>
                            {joinNames(worst.map((w) => w.name))} paling tinggi: total {max}, rata-rata{" "}
                            {fmt.format(worst[0].avgTurnaround)}, sekitar {fmt.format(longer)}% lebih besar daripada yang terendah.
                        </li>
                    )}
                    {same.map((g) => (
                        <li key={g[0].id}>
                            {joinNames(g.map((r) => r.name))} menghasilkan urutan eksekusi yang sama, sehingga totalnya
                            sama ({g[0].totalTurnaround}).
                        </li>
                    ))}
                    {rrs.length > 1 && (
                        <li>
                            Pada Round Robin, {joinNames(rrs.map((r) => `kuantum ${r.id.slice(2)} menghasilkan total ${r.totalTurnaround}`))}.
                        </li>
                    )}
                </ul>
            </section>
        </div>
    );
}

/* ────────────── Pintu masuk: menerima teks blok ```cpu ────────────── */

export default function CpuSchedulingPost({ source }: { source: string }) {
    const parsed = useMemo(() => parseCpuBlock(source), [source]);

    if ("error" in parsed) {
        return (
            <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
            >
                Blok CPU scheduling tidak bisa dibaca. {parsed.error}
            </div>
        );
    }
    return <Post config={parsed.config} />;
}