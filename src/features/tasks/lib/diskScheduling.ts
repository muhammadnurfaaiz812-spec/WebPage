/* Simulasi penjadwalan akses lintas disk (Disk Scheduling).
   Fungsi murni tanpa React, jadi gampang diuji dan dipakai ulang.
   Simpan sebagai src/features/tasks/lib/diskScheduling.ts */

export type Direction = "naik" | "turun";
// "ujung"     : SCAN berjalan sampai kedua ujung disk (0 dan track terakhir)
// "permintaan": setelah berbalik, SCAN berhenti di permintaan terakhir
export type ScanMode = "ujung" | "permintaan";

export type DiskConfig = {
    head: number;
    tracks: number; // jumlah track; nomor 0 sampai tracks - 1
    queue: number[];
    direction: Direction;
    countJump: boolean; // lompatan C-SCAN dan C-LOOK ikut dihitung?
    scanMode: ScanMode;
};

export type StepKind = "layani" | "ujung" | "lompat";

export type Step = {
    from: number;
    to: number;
    distance: number;
    kind: StepKind;
    note: string;
};

export type AlgoId = "fcfs" | "sstf" | "scan" | "cscan" | "look" | "clook" | "pickup";

export type AlgoResult = {
    id: AlgoId;
    name: string;
    fullName: string;
    summary: string;
    steps: Step[];
    total: number;
    /** Urutan track yang dikunjungi, termasuk posisi awal head di depan. */
    order: number[];
};

type Stop = { track: number; kind: StepKind; note?: string };

const MAX_REQUESTS = 60;

/* ───────────── Penyusun langkah ───────────── */

function buildSteps(
    cfg: DiskConfig,
    stops: Stop[],
    opts: { keepZero?: boolean; countRequests?: boolean } = {}
): Step[] {
    const steps: Step[] = [];
    let cur = cfg.head;

    for (const stop of stops) {
        const delta = Math.abs(stop.track - cur);
        if (delta === 0 && !opts.keepZero && stop.kind !== "lompat") continue;

        let note = stop.note ?? "";
        if (!note && stop.kind === "layani" && opts.countRequests) {
            const n = cfg.queue.filter((q) => q === stop.track).length;
            if (n > 1) note = `${n} permintaan`;
        }
        if (stop.kind === "lompat" && !cfg.countJump) {
            note = `${note} (jarak tidak dihitung)`.trim();
        }

        steps.push({
            from: cur,
            to: stop.track,
            distance: stop.kind === "lompat" && !cfg.countJump ? 0 : delta,
            kind: stop.kind,
            note,
        });
        cur = stop.track;
    }
    return steps;
}

const sum = (steps: Step[]) => steps.reduce((acc, s) => acc + s.distance, 0);

function toResult(
    cfg: DiskConfig,
    meta: Pick<AlgoResult, "id" | "name" | "fullName" | "summary">,
    steps: Step[]
): AlgoResult {
    return {
        ...meta,
        steps,
        total: sum(steps),
        order: [cfg.head, ...steps.map((s) => s.to)],
    };
}

/* ───────────── Algoritma ───────────── */

export function simulateAll(cfg: DiskConfig): AlgoResult[] {
    const max = cfg.tracks - 1;
    const up = cfg.direction === "naik";
    const end = up ? max : 0; // ujung searah gerak awal
    const otherEnd = up ? 0 : max;
    const uniq = [...new Set(cfg.queue)].sort((a, b) => a - b);

    // fwd : permintaan searah gerak awal, urut dilayani
    // back: permintaan di belakang head, urut dilayani setelah berbalik arah
    const fwd = up ? uniq.filter((t) => t >= cfg.head) : uniq.filter((t) => t <= cfg.head).reverse();
    const back = up ? uniq.filter((t) => t < cfg.head).reverse() : uniq.filter((t) => t > cfg.head);
    const wrap = [...back].reverse(); // permintaan di belakang head, ditelusuri searah gerak awal

    const serve = (tracks: number[]): Stop[] => tracks.map((track) => ({ track, kind: "layani" }));
    const side = up ? "naik" : "turun";
    const word = (up: boolean) => (up ? "terbesar" : "terkecil");

    // 1. FCFS: tiap permintaan dikunjungi satu per satu sesuai urutan antrean
    const fcfs = toResult(
        cfg,
        {
            id: "fcfs",
            name: "FCFS",
            fullName: "First-Come, First-Served",
            summary: "Melayani permintaan persis sesuai urutan antrean, tanpa memperhatikan jarak.",
        },
        buildSteps(cfg, serve(cfg.queue), { keepZero: true })
    );

    // 2. SSTF: selalu ke permintaan terdekat; permintaan kembar dilayani sekaligus
    const remaining = new Set(uniq);
    const sstfStops: Stop[] = [];
    let at = cfg.head;
    while (remaining.size) {
        let pick = -1;
        for (const t of remaining) {
            if (
                pick === -1 ||
                Math.abs(t - at) < Math.abs(pick - at) ||
                (Math.abs(t - at) === Math.abs(pick - at) && t < pick)
            ) {
                pick = t;
            }
        }
        remaining.delete(pick);
        sstfStops.push({ track: pick, kind: "layani" });
        at = pick;
    }
    const sstf = toResult(
        cfg,
        {
            id: "sstf",
            name: "SSTF",
            fullName: "Shortest Seek Time First",
            summary: "Selalu menuju permintaan yang paling dekat dari posisi head saat ini.",
        },
        buildSteps(cfg, sstfStops, { countRequests: true })
    );

    // 3. SCAN: sampai ujung, berbalik, lalu sampai ujung lain (atau permintaan terakhir)
    const scanStops: Stop[] = serve(fwd);
    if (fwd[fwd.length - 1] !== end) {
        scanStops.push({ track: end, kind: "ujung", note: "Ujung disk, balik arah" });
    }
    scanStops.push(...serve(back));
    if (cfg.scanMode === "ujung" && back[back.length - 1] !== otherEnd) {
        scanStops.push({ track: otherEnd, kind: "ujung", note: "Ujung disk" });
    }
    const scan = toResult(
        cfg,
        {
            id: "scan",
            name: "SCAN",
            fullName: "Elevator Algorithm",
            summary:
                cfg.scanMode === "ujung"
                    ? `Head bergerak ${side} sampai ujung disk (${end}), berbalik, lalu sampai ujung lain (${otherEnd}) sambil melayani permintaan yang dilewati.`
                    : `Head bergerak ${side} sampai ujung disk (${end}), berbalik, lalu melayani permintaan sampai yang terakhir.`,
        },
        buildSteps(cfg, scanStops, { countRequests: true })
    );

    // 4. C-SCAN: sampai ujung, lompat ke ujung lain tanpa melayani, lanjut searah
    const cscanStops: Stop[] = serve(fwd);
    if (fwd[fwd.length - 1] !== end) cscanStops.push({ track: end, kind: "ujung", note: "Ujung disk" });
    cscanStops.push({ track: otherEnd, kind: "lompat", note: `Lompat ke ${otherEnd} (tanpa melayani)` });
    cscanStops.push(...serve(wrap));
    const cscan = toResult(
        cfg,
        {
            id: "cscan",
            name: "C-SCAN",
            fullName: "Circular SCAN",
            summary: `Head bergerak ${side} sampai ujung disk (${end}), melompat ke ${otherEnd} tanpa melayani, lalu lanjut ${side} melayani sisa permintaan.`,
        },
        buildSteps(cfg, cscanStops, { countRequests: true })
    );

    // 5. LOOK: seperti SCAN, tetapi berbalik di permintaan terjauh
    const look = toResult(
        cfg,
        {
            id: "look",
            name: "LOOK",
            fullName: "Look Disk Scheduling",
            summary: `Seperti SCAN, tetapi berbalik arah di permintaan terjauh (${fwd[fwd.length - 1] ?? cfg.head} dan ${back[back.length - 1] ?? "-"}), bukan di ujung disk.`,
        },
        buildSteps(cfg, [...serve(fwd), ...serve(back)], { countRequests: true })
    );

    // 6. C-LOOK: seperti C-SCAN, tetapi lompat dari permintaan terjauh ke permintaan paling ujung
    const clookStops: Stop[] = serve(fwd);
    if (wrap.length) {
        clookStops.push({
            track: wrap[0],
            kind: "lompat",
            note: `Lompat ke permintaan ${word(!up)} (tanpa melayani)`,
        });
        clookStops.push(...serve(wrap.slice(1)));
    }
    const clook = toResult(
        cfg,
        {
            id: "clook",
            name: "C-LOOK",
            fullName: "Circular LOOK",
            summary: "Seperti C-SCAN, tetapi melompat dari permintaan terjauh ke permintaan paling ujung lain, bukan ke ujung disk.",
        },
        buildSteps(cfg, clookStops, { countRequests: true })
    );

    // 7. PICK UP: menuju permintaan pertama yang belum dilayani, memungut yang dilewati
    const unserved = [...cfg.queue];
    const pickStops: Stop[] = [];
    let pos = cfg.head;
    while (unserved.length) {
        const target = unserved[0];
        const lo = Math.min(pos, target);
        const hi = Math.max(pos, target);
        const dir = target >= pos ? 1 : -1;
        const onWay = [...new Set(unserved.filter((t) => t >= lo && t <= hi && t !== target))].sort(
            (a, b) => dir * (a - b)
        );
        const parts: string[] = [];
        const targetCount = unserved.filter((t) => t === target).length;
        if (targetCount > 1) parts.push(`${targetCount} permintaan`);
        if (onWay.length) {
            const list = onWay
                .map((t) => {
                    const n = unserved.filter((q) => q === t).length;
                    return n > 1 ? `${t} (${n} permintaan)` : String(t);
                })
                .join(", ");
            parts.push(`memungut ${list}`);
        }
        pickStops.push({ track: target, kind: "layani", note: parts.join("; ") });
        for (let i = unserved.length - 1; i >= 0; i--) {
            if (unserved[i] >= lo && unserved[i] <= hi) unserved.splice(i, 1);
        }
        pos = target;
    }
    const pickup = toResult(
        cfg,
        {
            id: "pickup",
            name: "PICK UP",
            fullName: "Pick Up",
            summary: "Menuju permintaan pertama yang belum dilayani dalam antrean, sambil memungut permintaan lain yang dilewatinya.",
        },
        buildSteps(cfg, pickStops)
    );

    return [fcfs, sstf, scan, cscan, look, clook, pickup];
}

/* ───────────── Pembaca blok ```disk ───────────── */

const num = (s: string) => (/^-?\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);

/**
 * Format blok:
 *   head: 50
 *   track: 200
 *   antrean: 52, 170, 83, ...
 *   arah: naik            (opsional: naik | turun, bawaan naik)
 *   lompatan: hitung      (opsional: hitung | abaikan, bawaan hitung)
 *   scan: ujung           (opsional: ujung | permintaan, bawaan ujung)
 */
export function parseDiskBlock(text: string): { config: DiskConfig } | { error: string } {
    const raw: Record<string, string> = {};
    for (const line of text.split("\n")) {
        const clean = line.replace(/#.*/, "").trim();
        if (!clean) continue;
        const i = clean.indexOf(":");
        if (i < 1) return { error: `Baris tidak dikenali: "${clean}". Pakai format "kunci: nilai".` };
        raw[clean.slice(0, i).trim().toLowerCase()] = clean.slice(i + 1).trim();
    }

    const pick = (...keys: string[]) => keys.map((k) => raw[k]).find((v) => v !== undefined);

    const head = num(pick("head", "posisi") ?? "");
    const tracks = num(pick("track", "tracks", "jumlah_track") ?? "");
    const queueText = pick("antrean", "antrian", "queue");

    if (Number.isNaN(tracks) || tracks < 2 || tracks > 10000) {
        return { error: 'Isi "track" dengan jumlah track (angka 2 sampai 10000), misalnya "track: 200".' };
    }
    if (Number.isNaN(head) || head < 0 || head > tracks - 1) {
        return { error: `"head" harus angka antara 0 dan ${tracks - 1}.` };
    }
    if (!queueText) return { error: 'Isi "antrean" dengan nomor track dipisah koma.' };

    const queue = queueText.split(/[,\s]+/).filter(Boolean).map(num);
    if (!queue.length || queue.some((q) => Number.isNaN(q))) {
        return { error: 'Isi "antrean" hanya dengan angka yang dipisah koma.' };
    }
    if (queue.length > MAX_REQUESTS) return { error: `Antrean maksimal ${MAX_REQUESTS} permintaan.` };
    const bad = queue.find((q) => q < 0 || q > tracks - 1);
    if (bad !== undefined) return { error: `Track ${bad} di luar rentang 0 sampai ${tracks - 1}.` };

    const dir = (pick("arah", "direction") ?? "naik").toLowerCase();
    const jump = (pick("lompatan", "jump") ?? "hitung").toLowerCase();
    const scan = (pick("scan") ?? "ujung").toLowerCase();
    if (!["naik", "turun", "up", "down"].includes(dir)) return { error: '"arah" harus "naik" atau "turun".' };
    if (!["hitung", "abaikan"].includes(jump)) return { error: '"lompatan" harus "hitung" atau "abaikan".' };
    if (!["ujung", "permintaan"].includes(scan)) return { error: '"scan" harus "ujung" atau "permintaan".' };

    return {
        config: {
            head,
            tracks,
            queue,
            direction: dir === "turun" || dir === "down" ? "turun" : "naik",
            countJump: jump === "hitung",
            scanMode: scan as ScanMode,
        },
    };
}