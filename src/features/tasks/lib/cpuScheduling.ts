/* Simulasi penjadwalan proses CPU: FCFS, SJF, SRT, HPRN (HRRN), dan Round Robin.
   Fungsi murni tanpa React. Simpan sebagai src/features/tasks/lib/cpuScheduling.ts

   Definisi yang dipakai:
     lama tanggap = waktu selesai - saat tiba
     lama tunggu  = lama tanggap - lama proses
     rasio penalti (HPRN) = (lama tunggu + lama proses) / lama proses */

export type Proc = { id: string; arrival: number; burst: number };
// Saat kuantum habis tepat ketika proses lain tiba, siapa yang masuk antrean lebih dulu?
export type RrOrder = "tiba-dulu" | "kembali-dulu";

export type CpuConfig = { procs: Proc[]; quanta: number[]; rrOrder: RrOrder };

/** proc kosong ("") = CPU menganggur */
export type Segment = { proc: string; start: number; end: number; note: string };

export type Row = {
    id: string;
    arrival: number;
    burst: number;
    start: number; // saat pertama kali dilayani
    finish: number;
    waiting: number;
    turnaround: number;
};

export type CpuResult = {
    id: string;
    name: string;
    fullName: string;
    summary: string;
    segments: Segment[];
    rows: Row[];
    totalTurnaround: number;
    avgTurnaround: number;
    totalWaiting: number;
    avgWaiting: number;
    end: number;
};

const MAX_PROCS = 12;
const dec = (n: number) => n.toFixed(2).replace(".", ",");
const round2 = (n: number) => Math.round(n * 100) / 100;

function finish(
    cfg: CpuConfig,
    meta: Pick<CpuResult, "id" | "name" | "fullName" | "summary">,
    segments: Segment[]
): CpuResult {
    const rows: Row[] = cfg.procs.map((p) => {
        const segs = segments.filter((s) => s.proc === p.id);
        const fin = segs[segs.length - 1].end;
        const turnaround = fin - p.arrival;
        return {
            id: p.id,
            arrival: p.arrival,
            burst: p.burst,
            start: segs[0].start,
            finish: fin,
            waiting: turnaround - p.burst,
            turnaround,
        };
    });
    const totalTurnaround = rows.reduce((a, r) => a + r.turnaround, 0);
    const totalWaiting = rows.reduce((a, r) => a + r.waiting, 0);
    return {
        ...meta,
        segments,
        rows,
        totalTurnaround,
        avgTurnaround: round2(totalTurnaround / rows.length),
        totalWaiting,
        avgWaiting: round2(totalWaiting / rows.length),
        end: segments[segments.length - 1].end,
    };
}

/* ───────────── Tanpa preemptive: FCFS, SJF, HPRN ───────────── */

function nonPreemptive(
    cfg: CpuConfig,
    pick: (ready: Proc[], t: number) => { proc: Proc; note: string }
): Segment[] {
    const left = [...cfg.procs];
    const segs: Segment[] = [];
    let t = 0;
    while (left.length) {
        const ready = left.filter((p) => p.arrival <= t);
        if (!ready.length) {
            const next = Math.min(...left.map((p) => p.arrival));
            segs.push({ proc: "", start: t, end: next, note: "CPU menganggur" });
            t = next;
            continue;
        }
        const { proc, note } = pick(ready, t);
        segs.push({ proc: proc.id, start: t, end: t + proc.burst, note });
        t += proc.burst;
        left.splice(left.indexOf(proc), 1);
    }
    return segs;
}

const fcfs = (cfg: CpuConfig) =>
    nonPreemptive(cfg, (ready) => {
        const proc = ready.reduce((a, b) => (b.arrival < a.arrival ? b : a));
        return {
            proc,
            note: ready.length > 1 ? `Antrean: ${ready.map((p) => p.id).join(", ")}; ${proc.id} tiba paling dulu` : "",
        };
    });

const sjf = (cfg: CpuConfig) =>
    nonPreemptive(cfg, (ready) => {
        const proc = ready.reduce((a, b) => (b.burst < a.burst ? b : a));
        return {
            proc,
            note:
                ready.length > 1
                    ? `Antrean: ${ready.map((p) => `${p.id}(${p.burst})`).join(", ")}; ${proc.id} paling pendek`
                    : "",
        };
    });

const hprn = (cfg: CpuConfig) =>
    nonPreemptive(cfg, (ready, t) => {
        const ratio = (p: Proc) => (t - p.arrival + p.burst) / p.burst;
        const proc = ready.reduce((a, b) => (ratio(b) > ratio(a) ? b : a));
        return {
            proc,
            note:
                ready.length > 1
                    ? `Rasio penalti: ${ready.map((p) => `${p.id} = ${dec(ratio(p))}`).join("; ")}; ${proc.id} tertinggi`
                    : "",
        };
    });

/* ───────────── SRT (preemptive) ───────────── */

function srt(cfg: CpuConfig): Segment[] {
    const rem = new Map(cfg.procs.map((p) => [p.id, p.burst]));
    const segs: Segment[] = [];
    let t = 0;
    let last = "";
    const left = () => cfg.procs.filter((p) => rem.get(p.id)! > 0);

    while (left().length) {
        const ready = left().filter((p) => p.arrival <= t);
        if (!ready.length) {
            const next = Math.min(...left().map((p) => p.arrival));
            segs.push({ proc: "", start: t, end: next, note: "CPU menganggur" });
            t = next;
            last = "";
            continue;
        }

        // sisa paling kecil; seri: yang sedang berjalan tetap lanjut, lalu yang tiba lebih dulu
        const better = (p: Proc, q: Proc) => {
            const a = rem.get(p.id)!;
            const b = rem.get(q.id)!;
            if (a !== b) return a < b;
            if (p.id === last) return true;
            if (q.id === last) return false;
            return p.arrival < q.arrival;
        };
        const pick = ready.reduce((a, b) => (better(b, a) ? b : a));

        const later = left().filter((p) => p.arrival > t).map((p) => p.arrival);
        const nextArrival = later.length ? Math.min(...later) : Infinity;
        const run = Math.min(rem.get(pick.id)!, nextArrival - t);
        const start = t;
        t += run;
        rem.set(pick.id, rem.get(pick.id)! - run);

        const notes: string[] = [];
        const remain = rem.get(pick.id)!;
        if (t === nextArrival && remain > 0) {
            for (const n of cfg.procs.filter((p) => p.arrival === t)) {
                const rel = n.burst < remain ? "<" : n.burst === remain ? "=" : ">";
                notes.push(
                    `${n.id} tiba di ${t} (${n.burst}) ${rel} sisa ${pick.id} (${remain}), ${pick.id} ${rel === "<" ? "dipreempt" : "lanjut"
                    }`
                );
            }
        }
        if (remain === 0) notes.push(`${pick.id} selesai`);

        const prev = segs[segs.length - 1];
        if (prev && prev.proc === pick.id && prev.end === start) {
            prev.end = t;
            prev.note = [prev.note, ...notes].filter(Boolean).join("; ");
        } else {
            segs.push({ proc: pick.id, start, end: t, note: notes.join("; ") });
        }
        last = pick.id;
    }
    return segs;
}

/* ───────────── Round Robin ───────────── */

function roundRobin(cfg: CpuConfig, q: number): Segment[] {
    const sorted = [...cfg.procs].sort((a, b) => a.arrival - b.arrival);
    const rem = new Map(cfg.procs.map((p) => [p.id, p.burst]));
    const queue: string[] = [];
    const segs: Segment[] = [];
    let next = 0;
    let t = 0;

    const enqueue = (ok: (arrival: number) => boolean) => {
        while (next < sorted.length && ok(sorted[next].arrival)) queue.push(sorted[next++].id);
    };

    enqueue((a) => a <= 0);
    while (queue.length || next < sorted.length) {
        if (!queue.length) {
            const arrival = sorted[next].arrival;
            segs.push({ proc: "", start: t, end: arrival, note: "CPU menganggur" });
            t = arrival;
            enqueue((a) => a <= t);
            continue;
        }
        const id = queue.shift()!;
        const run = Math.min(q, rem.get(id)!);
        const start = t;
        t += run;
        rem.set(id, rem.get(id)! - run);

        enqueue((a) => a < t); // tiba di tengah jatah: pasti masuk sebelum proses ini
        const done = rem.get(id) === 0;
        if (cfg.rrOrder === "kembali-dulu") {
            if (!done) queue.push(id);
            enqueue((a) => a <= t);
        } else {
            enqueue((a) => a <= t);
            if (!done) queue.push(id);
        }

        segs.push({
            proc: id,
            start,
            end: t,
            note: `${done ? `${id} selesai` : `sisa ${id} = ${rem.get(id)}`}; antrean: ${queue.length ? queue.join(", ") : "kosong"}`,
        });
    }
    return segs;
}

/* ───────────── Semua algoritma ───────────── */

export function simulateCpu(cfg: CpuConfig): CpuResult[] {
    return [
        finish(cfg, {
            id: "fcfs",
            name: "FCFS / PTPD",
            fullName: "First-Come, First-Served (tanpa preemptive)",
            summary: "Proses dilayani sesuai urutan tiba sampai selesai, tidak dihentikan di tengah jalan.",
        }, fcfs(cfg)),
        finish(cfg, {
            id: "sjf",
            name: "SJF / PTD",
            fullName: "Shortest Job First (tanpa preemptive)",
            summary: "Dari proses yang sudah tiba dipilih yang lama prosesnya paling pendek, lalu dijalankan sampai selesai.",
        }, sjf(cfg)),
        finish(cfg, {
            id: "srt",
            name: "SRT / PTDP",
            fullName: "Shortest Remaining Time (preemptive)",
            summary: "Setiap ada proses baru tiba, sisa waktunya dibandingkan dengan proses yang sedang berjalan. Yang sisanya lebih pendek mengambil alih CPU.",
        }, srt(cfg)),
        finish(cfg, {
            id: "hprn",
            name: "HPRN / RPTD",
            fullName: "Highest Penalty Ratio Next (tanpa preemptive)",
            summary: "Dari proses yang sudah tiba dipilih yang rasio penaltinya tertinggi, yaitu (lama tunggu + lama proses) / lama proses, lalu dijalankan sampai selesai.",
        }, hprn(cfg)),
        ...cfg.quanta.map((q) =>
            finish(cfg, {
                id: `rr${q}`,
                name: `RR (kuantum = ${q})`,
                fullName: "Round Robin",
                summary: `Tiap proses mendapat jatah CPU paling lama ${q} satuan waktu, lalu kembali ke belakang antrean kalau belum selesai.`,
            }, roundRobin(cfg, q))
        ),
    ];
}

/* ───────────── Pembaca blok ```cpu ───────────── */

const int = (s: string) => (/^\d+$/.test(s) ? Number(s) : NaN);

/**
 * Format blok:
 *   proses: A 0 6, B 3 8, C 5 4      (nama, saat tiba, lama proses)
 *   kuantum: 3, 5                    (opsional; satu RR per kuantum)
 *   rr: tiba-dulu                    (opsional: tiba-dulu | kembali-dulu)
 */
export function parseCpuBlock(text: string): { config: CpuConfig } | { error: string } {
    const raw: Record<string, string> = {};
    for (const line of text.split("\n")) {
        const clean = line.replace(/#.*/, "").trim();
        if (!clean) continue;
        const i = clean.indexOf(":");
        if (i < 1) return { error: `Baris tidak dikenali: "${clean}". Pakai format "kunci: nilai".` };
        raw[clean.slice(0, i).trim().toLowerCase()] = clean.slice(i + 1).trim();
    }

    const procText = raw["proses"] ?? raw["process"];
    if (!procText) return { error: 'Isi "proses" dengan daftar "nama saat-tiba lama-proses", dipisah koma.' };

    const procs: Proc[] = [];
    for (const item of procText.split(",").map((s) => s.trim()).filter(Boolean)) {
        const [id, a, b, ...extra] = item.split(/\s+/);
        const arrival = int(a ?? "");
        const burst = int(b ?? "");
        if (!id || extra.length || Number.isNaN(arrival) || Number.isNaN(burst)) {
            return { error: `Proses "${item}" tidak valid. Contoh yang benar: "A 0 6".` };
        }
        if (burst < 1) return { error: `Lama proses ${id} harus minimal 1.` };
        if (procs.some((p) => p.id === id)) return { error: `Nama proses "${id}" dipakai dua kali.` };
        procs.push({ id, arrival, burst });
    }
    if (!procs.length) return { error: "Daftar proses kosong." };
    if (procs.length > MAX_PROCS) return { error: `Proses maksimal ${MAX_PROCS}.` };

    const quanta = (raw["kuantum"] ?? raw["quantum"] ?? "")
        .split(/[,\s]+/)
        .filter(Boolean)
        .map(int);
    if (quanta.some((q) => Number.isNaN(q) || q < 1) || quanta.length > 4) {
        return { error: '"kuantum" harus berisi 1 sampai 4 angka positif, misalnya "kuantum: 3, 5".' };
    }

    const rr = (raw["rr"] ?? "tiba-dulu").toLowerCase();
    if (!["tiba-dulu", "kembali-dulu"].includes(rr)) {
        return { error: '"rr" harus "tiba-dulu" atau "kembali-dulu".' };
    }

    return { config: { procs, quanta, rrOrder: rr as RrOrder } };
}