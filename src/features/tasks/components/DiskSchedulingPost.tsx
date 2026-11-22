"use client";

/* Menampilkan jawaban Disk Scheduling dari data soal: tabel ringkasan, tabel
   langkah, grafik arah head (animasi + sorot baris), gambar gabungan, kesimpulan.
   Simpan sebagai src/features/tasks/components/DiskSchedulingPost.tsx */

import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type RefObject,
} from "react";
import {
    parseDiskBlock,
    simulateAll,
    type AlgoResult,
    type DiskConfig,
} from "@/features/tasks/lib/diskScheduling";

/* ────────────── Token gaya (sama dengan palet situs) ────────────── */

const surface =
    "border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";
const textHeading = "text-slate-900 dark:text-slate-50";
const textMuted = "text-slate-600 dark:text-slate-400";
const brandTint =
    "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20";
const amberTint =
    "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20";
const slateTint =
    "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
const focusRing =
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30";

const th =
    "px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400";
const td = "px-3 py-2.5 align-top text-sm";

const CSS = `
@keyframes dgDraw{from{stroke-dashoffset:1;opacity:0}to{stroke-dashoffset:0;opacity:1}}
@keyframes dgFade{from{opacity:0}to{opacity:1}}
@keyframes dgBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.dg-draw{animation:dgDraw .5s ease-out both}
.dg-fade{animation:dgFade .35s ease-out both}
.dg-bar{transform-origin:left;animation:dgBar .8s cubic-bezier(.22,1,.36,1) both}
@media (prefers-reduced-motion:reduce){.dg-draw,.dg-fade,.dg-bar{animation:none!important}}
`;

/* ────────────── Helper ────────────── */

const fmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

function joinNames(names: string[]) {
    if (names.length <= 1) return names[0] ?? "";
    if (names.length === 2) return `${names[0]} dan ${names[1]}`;
    return `${names.slice(0, -1).join(", ")}, dan ${names[names.length - 1]}`;
}

/** true setelah elemen pertama kali terlihat di layar. */
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

/* ────────────── Grafik arah gerak head ──────────────
   Sumbu mendatar = nomor track, sumbu tegak = urutan langkah (ke bawah). */

function niceStep(max: number) {
    const steps = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
    return steps.find((s) => max / s <= 5) ?? 5000;
}

function HeadChart({
    result,
    config,
    active = null,
    play = 0,
    compact = false,
}: {
    result: AlgoResult;
    config: DiskConfig;
    active?: number | null;
    play?: number;
    compact?: boolean;
}) {
    const [wrapRef, seen] = useInView<HTMLDivElement>();
    const running = compact || seen ? "running" : "paused";

    const W = compact ? 360 : 720;
    const padL = compact ? 14 : 36;
    const padR = compact ? 14 : 36;
    const padT = compact ? 22 : 34;
    const padB = compact ? 8 : 14;
    const rowH = compact ? 11 : 26;

    const pts = result.order;
    const n = pts.length - 1;
    const H = padT + n * rowH + padB;
    const max = config.tracks - 1;
    const x = (t: number) => padL + (t / max) * (W - padL - padR);
    const y = (i: number) => padT + i * rowH;

    const step = niceStep(max);
    const ticks: number[] = [];
    for (let t = 0; t < max; t += step) ticks.push(t);
    ticks.push(max);

    const label = `Grafik arah gerak head ${result.name}, urutan track ${pts.join(", ")}`;

    return (
        <div ref={wrapRef}>
            <svg
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label={label}
                className="h-auto w-full"
            >
                {/* Garis bantu dan nomor track di atas */}
                {ticks.map((t) => (
                    <g key={t}>
                        <line
                            x1={x(t)}
                            x2={x(t)}
                            y1={padT - 6}
                            y2={H - padB}
                            className="stroke-slate-200 dark:stroke-slate-700"
                            strokeWidth={1}
                        />
                        <text
                            x={x(t)}
                            y={padT - 12}
                            textAnchor="middle"
                            fontSize={compact ? 9 : 11}
                            className="fill-slate-500 dark:fill-slate-400"
                        >
                            {t}
                        </text>
                    </g>
                ))}

                <g key={play}>
                    {/* Garis gerak: tiap segmen muncul berurutan */}
                    {result.steps.map((s, i) => {
                        const dashed = s.kind === "lompat";
                        const d = `M${x(s.from)} ${y(i)} L${x(s.to)} ${y(i + 1)}`;
                        const stroke =
                            s.kind === "ujung"
                                ? "stroke-amber-500"
                                : dashed
                                    ? "stroke-slate-400 dark:stroke-slate-500"
                                    : "stroke-emerald-600 dark:stroke-emerald-400";
                        const isActive = active === i;
                        return (
                            <g
                                key={i}
                                opacity={active === null || isActive ? 1 : 0.25}
                                style={{ transition: "opacity .2s" }}
                            >
                                <path
                                    d={d}
                                    pathLength={dashed ? undefined : 1}
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeWidth={isActive ? 3.5 : compact ? 1.5 : 2.25}
                                    strokeDasharray={dashed ? "5 4" : 1}
                                    className={`${stroke} ${compact ? "" : dashed ? "dg-fade" : "dg-draw"}`}
                                    style={{
                                        animationDelay: `${i * 130}ms`,
                                        animationPlayState: running,
                                    }}
                                />
                            </g>
                        );
                    })}

                    {/* Titik dan nomor track */}
                    {pts.map((t, i) => {
                        const isStart = i === 0;
                        const isActive = active !== null && i === active + 1;
                        const right = x(t) <= W / 2;
                        return (
                            <g
                                key={i}
                                className={compact ? "" : "dg-fade"}
                                style={{
                                    animationDelay: `${i * 130 + 200}ms`,
                                    animationPlayState: running,
                                }}
                            >
                                <circle
                                    cx={x(t)}
                                    cy={y(i)}
                                    r={isStart ? (compact ? 3.5 : 5) : isActive ? 5 : compact ? 2.2 : 3.5}
                                    strokeWidth={compact ? 1 : 2}
                                    className={
                                        isStart
                                            ? "fill-emerald-700 stroke-emerald-700 dark:fill-emerald-400 dark:stroke-emerald-400"
                                            : "fill-white stroke-emerald-600 dark:fill-slate-900 dark:stroke-emerald-400"
                                    }
                                />
                                {!compact && (
                                    <text
                                        x={x(t) + (right ? 9 : -9)}
                                        y={y(i) + 4}
                                        textAnchor={right ? "start" : "end"}
                                        fontSize={11}
                                        fontWeight={isStart || isActive ? 700 : 500}
                                        strokeWidth={3}
                                        strokeLinejoin="round"
                                        style={{ paintOrder: "stroke" }}
                                        className="fill-slate-700 stroke-white dark:fill-slate-300 dark:stroke-slate-900"
                                    >
                                        {t}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </g>
            </svg>
        </div>
    );
}

/* ────────────── Kartu satu algoritma ────────────── */

function AlgoCard({
    result,
    index,
    config,
}: {
    result: AlgoResult;
    index: number;
    config: DiskConfig;
}) {
    const [active, setActive] = useState<number | null>(null);
    const [play, setPlay] = useState(0);
    const working = result.steps.map((s) => s.distance).join(" + ");

    return (
        <section
            aria-labelledby={`algo-${result.id}`}
            className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"
        >
            <h4
                id={`algo-${result.id}`}
                className="flex flex-wrap items-baseline gap-x-2 bg-emerald-800 px-4 py-3 text-sm font-bold text-white dark:bg-emerald-900 sm:text-base"
            >
                <span>
                    {index + 1}. {result.name}
                </span>
                <span className="font-medium text-emerald-100">{result.fullName}</span>
                <span className="ml-auto rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold tabular-nums">
                    Total {result.total} lintasan
                </span>
            </h4>

            <div className="space-y-5 p-4">
                <p className={`text-sm leading-6 ${textMuted}`}>{result.summary}</p>

                {/* Urutan akses */}
                <div>
                    <p className={`mb-2 text-xs font-semibold ${textMuted}`}>Urutan akses</p>
                    <ol className="flex flex-wrap items-center gap-1.5">
                        {result.order.map((t, i) => {
                            const kind = i === 0 ? "awal" : result.steps[i - 1].kind;
                            const tone =
                                kind === "awal"
                                    ? "bg-emerald-700 text-white"
                                    : kind === "ujung"
                                        ? amberTint
                                        : kind === "lompat"
                                            ? `${slateTint} border border-dashed border-slate-400`
                                            : slateTint;
                            return (
                                <li key={i} className="inline-flex items-center gap-1.5">
                                    {i > 0 && (
                                        <span aria-hidden="true" className="text-slate-400">
                                            →
                                        </span>
                                    )}
                                    <span
                                        className={`rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ${tone}`}
                                    >
                                        {t}
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                </div>

                {/* Tabel langkah */}
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full min-w-[30rem] text-left">
                        <caption className="sr-only">Langkah proses {result.name}</caption>
                        <thead className="bg-slate-50 dark:bg-slate-950/40">
                            <tr>
                                <th scope="col" className={`${th} w-14`}>
                                    No
                                </th>
                                <th scope="col" className={th}>
                                    Dari → Ke
                                </th>
                                <th scope="col" className={`${th} text-right`}>
                                    Jarak
                                </th>
                                <th scope="col" className={th}>
                                    Keterangan
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            <tr>
                                <td className={`${td} tabular-nums`}>0</td>
                                <td colSpan={3} className={`${td} ${textMuted}`}>
                                    Posisi awal head: <strong className={textHeading}>{config.head}</strong>
                                </td>
                            </tr>
                            {result.steps.map((s, i) => (
                                <tr
                                    key={i}
                                    tabIndex={0}
                                    onMouseEnter={() => setActive(i)}
                                    onMouseLeave={() => setActive(null)}
                                    onFocus={() => setActive(i)}
                                    onBlur={() => setActive(null)}
                                    onClick={() => setActive((a) => (a === i ? null : i))}
                                    className={`cursor-pointer outline-none transition-colors focus-visible:bg-emerald-50 dark:focus-visible:bg-emerald-500/10 ${active === i
                                            ? "bg-emerald-50 dark:bg-emerald-500/10"
                                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                        }`}
                                >
                                    <td className={`${td} tabular-nums`}>{i + 1}</td>
                                    <td className={`${td} whitespace-nowrap tabular-nums text-slate-800 dark:text-slate-100`}>
                                        {s.from} → {s.to}
                                    </td>
                                    <td className={`${td} text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100`}>
                                        {s.distance}
                                    </td>
                                    <td className={`${td} text-xs leading-5 ${textMuted}`}>{s.note}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-200 bg-emerald-50/70 dark:border-slate-700 dark:bg-emerald-500/10">
                            <tr>
                                <td colSpan={2} className={`${td} font-bold ${textHeading}`}>
                                    Total lintasan
                                </td>
                                <td className={`${td} text-right font-bold tabular-nums ${textHeading}`}>
                                    {result.total}
                                </td>
                                <td className={`${td} break-words text-xs leading-5 tabular-nums ${textMuted}`}>
                                    {working} = {result.total}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Grafik */}
                <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <p className={`text-xs font-semibold ${textMuted}`}>
                            Gambar arah pergerakan head
                        </p>
                        <button
                            type="button"
                            onClick={() => setPlay((p) => p + 1)}
                            className={`rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300 ${focusRing}`}
                        >
                            Putar ulang
                        </button>
                    </div>
                    <div className={`${surface} rounded-lg p-2`}>
                        <HeadChart result={result} config={config} active={active} play={play} />
                    </div>
                    <p className={`mt-1.5 text-xs ${textMuted}`}>
                        Mendatar: nomor track. Tegak: urutan langkah (ke bawah). Garis putus-putus:
                        lompatan tanpa melayani; garis kuning: menuju ujung disk. Arahkan kursor ke
                        baris tabel untuk menyorot langkahnya.
                    </p>
                </div>
            </div>
        </section>
    );
}

/* ────────────── Rangkuman halaman ────────────── */

function Post({ config }: { config: DiskConfig }) {
    const results = useMemo(() => simulateAll(config), [config]);
    const [barRef, barSeen] = useInView<HTMLDivElement>();

    const totals = results.map((r) => r.total);
    const min = Math.min(...totals);
    const maxTotal = Math.max(...totals);
    const best = results.filter((r) => r.total === min);
    const worst = results.find((r) => r.total === maxTotal)!;
    const byId = (id: string) => results.find((r) => r.id === id)!;
    const saving = maxTotal > 0 ? (1 - min / maxTotal) * 100 : 0;
    const pickShare = byId("fcfs").total > 0 ? (byId("pickup").total / byId("fcfs").total) * 100 : 0;
    const lastTrack = config.tracks - 1;

    const given: [string, string][] = [
        ["Posisi awal head", String(config.head)],
        ["Jumlah track", `${config.tracks} (nomor 0 sampai ${lastTrack})`],
        ["Arah gerak awal", config.direction === "naik" ? "Naik (menuju track besar)" : "Turun (menuju track kecil)"],
        [
            "SCAN",
            config.scanMode === "ujung"
                ? `Berjalan sampai kedua ujung disk (0 dan ${lastTrack})`
                : "Berbalik di ujung disk, lalu berhenti di permintaan terakhir",
        ],
        [
            "Lompatan C-SCAN dan C-LOOK",
            config.countJump ? "Jaraknya dihitung" : "Jaraknya tidak dihitung",
        ],
    ];

    return (
        <div className="space-y-10">
            <style>{CSS}</style>

            {/* Diketahui */}
            <section aria-labelledby="dg-diketahui" className={`${surface} rounded-xl p-4 sm:p-5`}>
                <h3 id="dg-diketahui" className={`text-base font-bold ${textHeading}`}>
                    Diketahui dan asumsi
                </h3>
                <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                    {given.map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4 border-b border-slate-100 pb-2 dark:border-slate-800">
                            <dt className={textMuted}>{k}</dt>
                            <dd className="text-right font-semibold text-slate-800 dark:text-slate-100">{v}</dd>
                        </div>
                    ))}
                </dl>
                <p className={`mt-4 text-xs font-semibold ${textMuted}`}>Antrean permintaan</p>
                <ol className="mt-2 flex flex-wrap gap-1.5">
                    {config.queue.map((t, i) => (
                        <li key={i} className={`rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ${slateTint}`}>
                            {t}
                        </li>
                    ))}
                </ol>
            </section>

            {/* Ringkasan */}
            <section aria-labelledby="dg-ringkasan">
                <h3
                    id="dg-ringkasan"
                    className={`border-l-4 border-emerald-600 pl-3 text-xl font-extrabold tracking-tight ${textHeading}`}
                >
                    Ringkasan Total Lintasan
                </h3>
                <div ref={barRef} className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full min-w-[28rem] text-left">
                        <caption className="sr-only">Perbandingan total lintasan semua algoritma</caption>
                        <thead className="bg-slate-50 dark:bg-slate-950/40">
                            <tr>
                                <th scope="col" className={`${th} w-12`}>No</th>
                                <th scope="col" className={th}>Algoritma</th>
                                <th scope="col" className={`${th} text-right`}>Total</th>
                                <th scope="col" className={`${th} w-[40%]`}>Perbandingan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {results.map((r, i) => {
                                const isBest = r.total === min;
                                const isWorst = r.total === maxTotal && !isBest;
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
                                        <td className={`${td} text-right font-bold tabular-nums ${textHeading}`}>{r.total}</td>
                                        <td className={`${td} align-middle`}>
                                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                                <div
                                                    className={`dg-bar h-full rounded-full ${isBest ? "bg-emerald-600" : isWorst ? "bg-amber-500" : "bg-slate-400 dark:bg-slate-500"
                                                        }`}
                                                    style={{
                                                        width: `${maxTotal ? (r.total / maxTotal) * 100 : 0}%`,
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
            </section>

            {/* Rincian */}
            <section aria-labelledby="dg-rincian" className="space-y-6">
                <h3
                    id="dg-rincian"
                    className={`border-l-4 border-emerald-600 pl-3 text-xl font-extrabold tracking-tight ${textHeading}`}
                >
                    Rincian per Algoritma
                </h3>
                {results.map((r, i) => (
                    <AlgoCard key={r.id} result={r} index={i} config={config} />
                ))}
            </section>

            {/* Gambar gabungan */}
            <section aria-labelledby="dg-gabungan">
                <h3
                    id="dg-gabungan"
                    className={`border-l-4 border-emerald-600 pl-3 text-xl font-extrabold tracking-tight ${textHeading}`}
                >
                    Gambar Gabungan
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {results.map((r) => (
                        <figure key={r.id} className={`${surface} rounded-xl p-3`}>
                            <figcaption className="mb-2 flex items-baseline justify-between gap-2 text-sm">
                                <span className={`font-bold ${textHeading}`}>{r.name}</span>
                                <span className={`text-xs tabular-nums ${textMuted}`}>Total {r.total}</span>
                            </figcaption>
                            <HeadChart result={r} config={config} compact />
                        </figure>
                    ))}
                </div>
            </section>

            {/* Kesimpulan */}
            <section aria-labelledby="dg-kesimpulan">
                <h3
                    id="dg-kesimpulan"
                    className={`border-l-4 border-emerald-600 pl-3 text-xl font-extrabold tracking-tight ${textHeading}`}
                >
                    Kesimpulan
                </h3>
                <ul className={`mt-4 list-disc space-y-2 pl-5 text-[15px] leading-7 ${textMuted}`}>
                    <li>
                        <strong className={textHeading}>{joinNames(best.map((b) => b.name))}</strong>{" "}
                        paling efisien dengan {min} lintasan
                        {best.includes(worst) ? "." : `, sekitar ${fmt.format(saving)}% lebih hemat dibanding ${worst.name} yang paling banyak (${maxTotal}).`}
                    </li>
                    <li>
                        SCAN ({byId("scan").total}) dan C-SCAN ({byId("cscan").total}) tidak lebih pendek daripada
                        LOOK ({byId("look").total}) dan C-LOOK ({byId("clook").total}), karena head tetap berjalan
                        sampai ujung disk.
                    </li>
                    <li>
                        PICK UP menghasilkan {byId("pickup").total} lintasan, sekitar {fmt.format(pickShare)}% dari
                        total FCFS ({byId("fcfs").total}).
                    </li>
                </ul>
            </section>
        </div>
    );
}

/* ────────────── Pintu masuk: menerima teks blok ```disk ────────────── */

export default function DiskSchedulingPost({ source }: { source: string }) {
    const parsed = useMemo(() => parseDiskBlock(source), [source]);

    if ("error" in parsed) {
        return (
            <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
            >
                Blok disk scheduling tidak bisa dibaca. {parsed.error}
            </div>
        );
    }
    return <Post config={parsed.config} />;
}