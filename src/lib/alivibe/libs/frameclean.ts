/**
 * FrameClean — Reference-anchored frame assignment + frame-correction post-processor
 * Converted to ES module from frameclean.js
 */

export interface AlnEntry {
    id: string;
    seq: string;
}

export interface InferResult {
    frameVec: (number | null)[];
    backboneMask: boolean[];
    meta: Record<string, unknown>;
}

export interface CleanResult {
    alignment: AlnEntry[];
    removedCols: number[];
}

function assert(cond: boolean, msg?: string) {
    if (!cond) throw new Error(msg || "Assertion failed");
}

function clamp(x: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, x));
}

function safeProb(p: number) {
    return clamp(p, 1e-9, 1 - 1e-9);
}

function isGap(c: string) {
    return c === "-";
}

function normalizeAlignment(alignment: AlnEntry[]): AlnEntry[] {
    assert(Array.isArray(alignment) && alignment.length > 0, "alignment must be a non-empty array");
    const L = alignment[0].seq.length;
    for (const s of alignment) {
        assert(typeof s.id === "string", "each sequence needs an id");
        assert(typeof s.seq === "string", "each sequence needs a seq string");
        assert(s.seq.length === L, "all sequences must have the same aligned length");
    }
    return alignment.map((s) => ({
        id: s.id,
        seq: s.seq.toUpperCase(),
    }));
}

function columnNonGapCount(aln: AlnEntry[], j: number) {
    let k = 0;
    for (let i = 0; i < aln.length; i++) if (!isGap(aln[i].seq[j])) k++;
    return k;
}

function argmax3(a0: number, a1: number, a2: number) {
    if (a0 >= a1 && a0 >= a2) return 0;
    if (a1 >= a0 && a1 >= a2) return 1;
    return 2;
}

const STANDARD_CODE: Record<string, string> = {
    TTT: "F", TTC: "F", TTA: "L", TTG: "L",
    TCT: "S", TCC: "S", TCA: "S", TCG: "S",
    TAT: "Y", TAC: "Y", TAA: "*", TAG: "*",
    TGT: "C", TGC: "C", TGA: "*", TGG: "W",
    CTT: "L", CTC: "L", CTA: "L", CTG: "L",
    CCT: "P", CCC: "P", CCA: "P", CCG: "P",
    CAT: "H", CAC: "H", CAA: "Q", CAG: "Q",
    CGT: "R", CGC: "R", CGA: "R", CGG: "R",
    ATT: "I", ATC: "I", ATA: "I", ATG: "M",
    ACT: "T", ACC: "T", ACA: "T", ACG: "T",
    AAT: "N", AAC: "N", AAA: "K", AAG: "K",
    AGT: "S", AGC: "S", AGA: "R", AGG: "R",
    GTT: "V", GTC: "V", GTA: "V", GTG: "V",
    GCT: "A", GCC: "A", GCA: "A", GCG: "A",
    GAT: "D", GAC: "D", GAA: "E", GAG: "E",
    GGT: "G", GGC: "G", GGA: "G", GGG: "G",
};

function translateCodon(codon: string, code?: Record<string, string>) {
    const c = (codon || "").toUpperCase();
    if (c.length !== 3) return "X";
    if (c.indexOf("-") !== -1) return "X";
    if (c.indexOf("N") !== -1) return "X";
    const aa = (code || STANDARD_CODE)[c];
    return aa ? aa : "X";
}

function makeColumnEmissionFn(aln: AlnEntry[], opts: Record<string, any>) {
    const N = aln.length;
    const pB = safeProb((opts.columnModelOptions && opts.columnModelOptions.pBackbone) != null ? opts.columnModelOptions.pBackbone : 0.9);
    const pI = safeProb((opts.columnModelOptions && opts.columnModelOptions.pInsertion) != null ? opts.columnModelOptions.pInsertion : 0.05);

    const logpB = Math.log(pB), logqB = Math.log(1 - pB);
    const logpI = Math.log(pI), logqI = Math.log(1 - pI);

    const extra = (opts && typeof opts.columnScoreFn === "function") ? opts.columnScoreFn : null;

    return function emission(j: number, state: number) {
        const k = columnNonGapCount(aln, j);
        const base = (state === 1)
            ? (k * logpB + (N - k) * logqB)
            : (k * logpI + (N - k) * logqI);
        if (!extra) return base;
        return base + (extra({ colIndex: j, state, nonGapCount: k, N }) || 0);
    };
}

function getPriorParams(opts: Record<string, any>) {
    const prior = (opts && opts.priorModelOptions) ? opts.priorModelOptions : {};
    return {
        backboneStartPenalty: (prior.insertionStartPenalty != null) ? prior.insertionStartPenalty : -2.0,
        backboneExtendPenalty: (prior.insertionExtendPenalty != null) ? prior.insertionExtendPenalty : -0.2,
        residuePenalty: Array.isArray(prior.insertionEndResidPenalty) && prior.insertionEndResidPenalty.length === 3
            ? prior.insertionEndResidPenalty.slice(0, 3)
            : [0.0, -6.0, -6.0],
    };
}

function computeReferencePhases(aln: AlnEntry[], refIndex: number, frameOffset: number) {
    const ref = aln[refIndex].seq;
    const L = ref.length;

    const isAnchor = new Array(L);
    const refUngappedPos = new Array(L);
    let u = -1;
    for (let j = 0; j < L; j++) {
        const c = ref[j];
        if (!isGap(c)) {
            u++;
            isAnchor[j] = true;
            refUngappedPos[j] = u;
        } else {
            isAnchor[j] = false;
            refUngappedPos[j] = -1;
        }
    }

    const anchorPhase = new Array(L).fill(null);
    for (let j = 0; j < L; j++) {
        if (!isAnchor[j]) continue;
        const idx = refUngappedPos[j];
        anchorPhase[j] = (idx + (frameOffset | 0)) % 3;
        if (anchorPhase[j] < 0) anchorPhase[j] += 3;
    }

    return { isAnchor, anchorPhase };
}

function solveGapSegmentDP(segCols: number[], emission: (j: number, s: number) => number, prior: ReturnType<typeof getPriorParams>, mode: string) {
    const n = segCols.length;
    if (n === 0) {
        return { backbone: [] as boolean[], endResid: 0, score: 0.0 };
    }

    const NEG = -1e300;

    const dp = new Float64Array((n + 1) * 3 * 2);
    const bt = new Int32Array((n + 1) * 3 * 2);
    for (let t = 0; t < dp.length; t++) { dp[t] = NEG; bt[t] = -1; }

    function idx(i: number, res: number, s: number) { return ((i * 3 + res) * 2 + s); }

    dp[idx(0, 0, 0)] = 0.0;
    bt[idx(0, 0, 0)] = -2;

    for (let i = 0; i < n; i++) {
        const colJ = segCols[i];

        for (let res = 0; res < 3; res++) {
            for (let s = 0; s < 2; s++) {
                const cur = dp[idx(i, res, s)];
                if (cur <= NEG / 2) continue;

                {
                    const res2 = res;
                    const s2 = 0;
                    const sc = cur + emission(colJ, 0);
                    const k = idx(i + 1, res2, s2);
                    if (sc > dp[k]) {
                        dp[k] = sc;
                        bt[k] = res * 2 + s;
                    }
                }

                {
                    const res2 = (res + 1) % 3;
                    const s2 = 1;
                    let trans = 0.0;
                    if (s === 0) trans += prior.backboneStartPenalty;
                    else trans += prior.backboneExtendPenalty;

                    const sc = cur + trans + emission(colJ, 1);
                    const k = idx(i + 1, res2, s2);
                    if (sc > dp[k]) {
                        dp[k] = sc;
                        bt[k] = res * 2 + s;
                    }
                }
            }
        }
    }

    const resPen = prior.residuePenalty;
    let bestRes = 0, bestS = 0, bestScore = NEG;

    for (let res = 0; res < 3; res++) {
        const pen = (mode === "soft") ? resPen[res] : (res === 0 ? 0.0 : NEG);
        for (let s = 0; s < 2; s++) {
            const sc = dp[idx(n, res, s)] + pen;
            if (sc > bestScore) {
                bestScore = sc;
                bestRes = res;
                bestS = s;
            }
        }
    }

    const backbone = new Array(n).fill(false);
    let i = n, res = bestRes, s = bestS;

    while (i > 0) {
        const packed = bt[idx(i, res, s)];
        if (packed < 0) break;
        backbone[i - 1] = (s === 1);

        const prevRes = Math.floor(packed / 2);
        const prevS = packed % 2;

        res = prevRes;
        s = prevS;
        i--;
    }

    return { backbone, endResid: bestRes, score: bestScore };
}

function inferFrameNoReference(aln: AlnEntry[], opts: Record<string, any>): InferResult {
    const L = aln[0].seq.length;
    const backboneMask = inferBackboneMaskNoRef(aln, opts);
    const delta = chooseOffsetByStopRate(aln, backboneMask, opts);

    const frameVec = new Array(L).fill(null);
    let k = 0;
    for (let j = 0; j < L; j++) {
        if (!backboneMask[j]) continue;
        frameVec[j] = (k + delta) % 3;
        k++;
    }

    return {
        frameVec,
        backboneMask,
        meta: { mode: "noref", delta },
    };
}

function inferBackboneMaskNoRef(aln: AlnEntry[], opts: Record<string, any>): boolean[] {
    const L = aln[0].seq.length;
    const emission = makeColumnEmissionFn(aln, opts);

    const insStart = (opts.priorModelOptions && opts.priorModelOptions.insertionStartPenalty != null)
        ? opts.priorModelOptions.insertionStartPenalty
        : -2.0;
    const insExtend = (opts.priorModelOptions && opts.priorModelOptions.insertionExtendPenalty != null)
        ? opts.priorModelOptions.insertionExtendPenalty
        : -0.2;

    let dp0 = 0.0, dp1 = 0.0;
    const bt = new Int8Array(L * 2);
    for (let j = 0; j < L; j++) {
        const e0 = emission(j, 0);
        const e1 = emission(j, 1);

        const ndp0_from0 = dp0 + insExtend + e0;
        const ndp0_from1 = dp1 + insStart + e0;
        const ndp1_from0 = dp0 + e1;
        const ndp1_from1 = dp1 + e1;

        let ndp0, prev0, ndp1, prev1;
        if (ndp0_from0 >= ndp0_from1) { ndp0 = ndp0_from0; prev0 = 0; } else { ndp0 = ndp0_from1; prev0 = 1; }
        if (ndp1_from0 >= ndp1_from1) { ndp1 = ndp1_from0; prev1 = 0; } else { ndp1 = ndp1_from1; prev1 = 1; }

        bt[j * 2 + 0] = prev0;
        bt[j * 2 + 1] = prev1;

        dp0 = ndp0;
        dp1 = ndp1;
    }

    const backboneMask = new Array(L).fill(false);
    let s = (dp1 >= dp0) ? 1 : 0;
    for (let j = L - 1; j >= 0; j--) {
        backboneMask[j] = (s === 1);
        s = bt[j * 2 + s];
    }
    return backboneMask;
}

function chooseOffsetByStopRate(aln: AlnEntry[], backboneMask: boolean[], opts: Record<string, any>): number {
    const codOpts = opts.codonModelOptions || {};
    const stopPenalty = (codOpts.stopCodonPenalty != null) ? codOpts.stopCodonPenalty : 8.0;

    const cols: number[] = [];
    for (let j = 0; j < backboneMask.length; j++) if (backboneMask[j]) cols.push(j);
    if (cols.length < 3) return 0;

    function scoreDelta(delta: number) {
        let score = 0.0;
        const M = cols.length;
        for (let i = 0; i + 2 < M; i++) {
            const k = i;
            if (((k + delta) % 3) !== 0) continue;
            const j0 = cols[i], j1 = cols[i + 1], j2 = cols[i + 2];
            for (let s = 0; s < aln.length; s++) {
                const c0 = aln[s].seq[j0], c1 = aln[s].seq[j1], c2 = aln[s].seq[j2];
                if (isGap(c0) || isGap(c1) || isGap(c2)) continue;
                const codon = c0 + c1 + c2;
                if (translateCodon(codon, STANDARD_CODE) === "*") score -= stopPenalty;
            }
        }
        return score;
    }

    const s0 = scoreDelta(0), s1 = scoreDelta(1), s2 = scoreDelta(2);
    return argmax3(s0, s1, s2);
}

function inferFrameWithReference(aln: AlnEntry[], opts: Record<string, any>): InferResult {
    const ref = opts.reference || {};
    const refIndex = clamp(ref.index | 0, 0, aln.length - 1);
    const mode = (ref.mode === "soft") ? "soft" : "hard";
    const frameOffset = ref.frameOffset | 0;

    const { isAnchor, anchorPhase } = computeReferencePhases(aln, refIndex, frameOffset);
    const L = aln[0].seq.length;

    const emission = makeColumnEmissionFn(aln, opts);
    const prior = getPriorParams(opts);

    const backboneMask = new Array(L).fill(false);
    const frameVec = new Array(L).fill(null);

    const anchors: number[] = [];
    for (let j = 0; j < L; j++) {
        if (isAnchor[j]) anchors.push(j);
    }

    if (anchors.length === 0) {
        return inferFrameNoReference(aln, opts);
    }

    for (const j of anchors) {
        backboneMask[j] = true;
        frameVec[j] = anchorPhase[j];
    }

    for (let t = 0; t + 1 < anchors.length; t++) {
        const left = anchors[t];
        const right = anchors[t + 1];

        const segCols: number[] = [];
        for (let j = left + 1; j <= right - 1; j++) {
            if (!isAnchor[j]) segCols.push(j);
        }

        const sol = solveGapSegmentDP(segCols, emission, prior, mode);
        for (let i = 0; i < segCols.length; i++) {
            const j = segCols[i];
            if (sol.backbone[i]) backboneMask[j] = true;
        }

        let runningPhase = (anchorPhase[left] + 1) % 3;

        for (let i = 0; i < segCols.length; i++) {
            const j = segCols[i];
            if (!backboneMask[j]) continue;
            frameVec[j] = runningPhase;
            runningPhase = (runningPhase + 1) % 3;
        }
    }

    const firstA = anchors[0];
    for (let j = 0; j < firstA; j++) {
        if (!isAnchor[j]) { backboneMask[j] = false; frameVec[j] = null; }
    }
    const lastA = anchors[anchors.length - 1];
    for (let j = lastA + 1; j < L; j++) {
        if (!isAnchor[j]) { backboneMask[j] = false; frameVec[j] = null; }
    }

    const meta = {
        mode: "reference",
        reference: { index: refIndex, mode, frameOffset },
        anchorsCount: anchors.length,
    };

    return { frameVec, backboneMask, meta };
}

function inferFrame(alignment: AlnEntry[], options?: Record<string, any>): InferResult {
    const aln = normalizeAlignment(alignment);
    const opts = options || {};

    if (opts.reference && typeof opts.reference.index === "number") {
        return inferFrameWithReference(aln, opts);
    }
    return inferFrameNoReference(aln, opts);
}

function cleanInFrame(alignment: AlnEntry[], inferred: InferResult): CleanResult {
    const aln = normalizeAlignment(alignment);
    const L = aln[0].seq.length;
    assert(inferred && Array.isArray(inferred.backboneMask), "inferred.backboneMask is required");

    const isIns = inferred.backboneMask.map(b => !b);
    const toDrop = new Array(L).fill(false);

    let j = 0;
    while (j < L) {
        if (!isIns[j]) { j++; continue; }
        const start = j;
        while (j < L && isIns[j]) j++;
        const end = j;
        const runLen = end - start;
        const r = runLen % 3;
        if (r === 0) continue;

        const cols: { c: number; sup: number; edge: number }[] = [];
        for (let c = start; c < end; c++) {
            const sup = columnNonGapCount(aln, c);
            const edge = Math.min(c - start, (end - 1) - c);
            cols.push({ c, sup, edge });
        }
        cols.sort((a, b) => (a.sup !== b.sup) ? (a.sup - b.sup) : (a.edge - b.edge));

        for (let t = 0; t < r; t++) toDrop[cols[t].c] = true;
    }

    const cleaned = aln.map(s => ({ id: s.id, seq: "" }));
    for (let i = 0; i < aln.length; i++) {
        let out = "";
        for (let k = 0; k < L; k++) if (!toDrop[k]) out += aln[i].seq[k];
        cleaned[i].seq = out;
    }

    const removed: number[] = [];
    for (let k = 0; k < L; k++) if (toDrop[k]) removed.push(k);

    return { alignment: cleaned, removedCols: removed };
}

export const FrameClean = {
    inferFrame,
    cleanInFrame,
    models: {
        STANDARD_CODE,
        translateCodon,
    },
};
