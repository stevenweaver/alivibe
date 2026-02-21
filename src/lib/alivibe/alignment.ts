import { data, ui, saveState, recalc } from './state.svelte.js';
import { CODON_TABLE } from './config.js';
import { doubleDP_nwalign, refinedMSA } from './libs/nw.js';
import { FrameClean } from './libs/frameclean.js';

export function runAlignmentTask() {
    if (data.rawSequences.length < 2) return;
    saveState();
    ui.overlayActive = true;
    ui.overlayMsg = "Initializing...";
    ui.overlaySub = "";

    const alignMode = getAlignMode();
    if (alignMode === 'msa') {
        setTimeout(runMSAAlignment, 50);
    } else if (alignMode === 'kalign') {
        setTimeout(runKalignAlignment, 50);
    } else {
        setTimeout(() => startAsyncAlignment(alignMode), 50);
    }
}

// This will be set by the component to read the select value
let _alignModeGetter: () => string = () => 'msa';
export function setAlignModeGetter(fn: () => string) {
    _alignModeGetter = fn;
}
function getAlignMode(): string {
    return _alignModeGetter();
}

function runMSAAlignment() {
    const isAA = (ui.mode === 'AA');

    ui.overlayMsg = "Running multiple sequence alignment...";
    ui.overlaySub = "";

    const cleanSeqs = data.rawSequences.map(s => s.seq.join('').replace(/-/g, ''));

    let seqsToAlign: string[];
    if (isAA) {
        const offset = ui.frame - 1;
        seqsToAlign = cleanSeqs.map(seq => {
            const aa: string[] = [];
            for (let i = offset; i < seq.length; i += 3) {
                if (i + 2 >= seq.length) break;
                const codon = seq.substring(i, i + 3);
                if (/[^ACGT]/i.test(codon)) aa.push('X');
                else aa.push(CODON_TABLE[codon] || 'X');
            }
            return aa.join('');
        });
    } else {
        seqsToAlign = cleanSeqs;
    }

    try {
        const alignedSeqs = refinedMSA(seqsToAlign);

        if (isAA) {
            for (let i = 0; i < data.rawSequences.length; i++) {
                const alignedAA = alignedSeqs[i];
                const cleanDNA = cleanSeqs[i];
                const offset = ui.frame - 1;

                const finalSeq: string[] = [];
                for (let p = 0; p < offset; p++) finalSeq.push(cleanDNA[p] || '-');

                let dnaIdx = offset;
                for (const char of alignedAA) {
                    if (char === '-') {
                        finalSeq.push('-', '-', '-');
                    } else {
                        if (dnaIdx + 3 <= cleanDNA.length) {
                            finalSeq.push(cleanDNA[dnaIdx], cleanDNA[dnaIdx + 1], cleanDNA[dnaIdx + 2]);
                            dnaIdx += 3;
                        } else {
                            finalSeq.push('-', '-', '-');
                        }
                    }
                }
                while (dnaIdx < cleanDNA.length) finalSeq.push(cleanDNA[dnaIdx++]);
                data.rawSequences[i].seq = finalSeq;
            }
        } else {
            for (let i = 0; i < data.rawSequences.length; i++) {
                data.rawSequences[i].seq = alignedSeqs[i].split('');
            }
        }

        recalc();
        ui.overlayActive = false;
    } catch (err: any) {
        console.error("MSA error:", err);
        ui.overlayActive = false;
    }
}

async function runKalignAlignment() {
    if (!ui.aioliCLI) {
        ui.overlayActive = false;
        return;
    }

    const isAA = (ui.mode === 'AA');
    ui.overlayMsg = "Running Kalign alignment...";
    ui.overlaySub = "via bioWASM";

    try {
        const fastaInput = data.rawSequences.map((s, idx) => {
            const seqArr = isAA ? data.viewSequences[idx].seq : s.seq;
            const seqStr = seqArr.join('').replace(/-/g, '');
            return `>${idx}\n${seqStr}`;
        }).join('\n');

        if (!fastaInput.trim()) throw new Error("No sequences to align.");

        await ui.aioliCLI.mount({ name: "input.fa", data: fastaInput });
        const resultFasta = await ui.aioliCLI.exec(`kalign input.fa -f fasta`);

        if (!resultFasta || !resultFasta.includes('>')) {
            throw new Error("Kalign failed to return a valid FASTA alignment.");
        }

        const lines = resultFasta.split(/\r?\n/);
        const indexToSeq = new Map<string, string>();
        let currentIndex: string | null = null;
        let buf: string[] = [];
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            if (line.startsWith('>')) {
                if (currentIndex !== null) indexToSeq.set(currentIndex, buf.join(''));
                currentIndex = line.substring(1).trim();
                buf = [];
            } else if (currentIndex !== null) {
                buf.push(line.toUpperCase().replace(/[^A-Z-]/g, ''));
            }
        }
        if (currentIndex !== null) indexToSeq.set(currentIndex, buf.join(''));

        if (isAA) {
            for (let i = 0; i < data.rawSequences.length; i++) {
                const s = data.rawSequences[i];
                const alignedAA = indexToSeq.get(i.toString());
                if (!alignedAA) continue;

                const cleanDNA = s.seq.join('').replace(/-/g, '');
                const offset = ui.frame - 1;
                const finalSeq: string[] = [];

                for (let p = 0; p < offset; p++) finalSeq.push(cleanDNA[p] || '-');

                let dnaIdx = offset;
                for (const char of alignedAA) {
                    if (char === '-') {
                        finalSeq.push('-', '-', '-');
                    } else {
                        if (dnaIdx + 3 <= cleanDNA.length) {
                            finalSeq.push(cleanDNA[dnaIdx], cleanDNA[dnaIdx + 1], cleanDNA[dnaIdx + 2]);
                            dnaIdx += 3;
                        } else {
                            finalSeq.push('-', '-', '-');
                        }
                    }
                }
                while (dnaIdx < cleanDNA.length) finalSeq.push(cleanDNA[dnaIdx++]);
                s.seq = finalSeq;
            }
        } else {
            data.rawSequences.forEach((s, idx) => {
                const alignedNT = indexToSeq.get(idx.toString());
                if (alignedNT) s.seq = alignedNT.split('');
            });
        }

        recalc();
        ui.overlayActive = false;
    } catch (err: any) {
        console.error("Kalign error:", err);
        ui.overlayActive = false;
    }
}

function startAsyncAlignment(alignMode: string) {
    const isAA = (ui.mode === 'AA');

    const seqsToAlign = data.rawSequences.map(s => {
        const cleanSeq = s.seq.join('').replace(/-/g, '');
        if (isAA) {
            const aa: string[] = [];
            const offset = ui.frame - 1;
            for (let i = offset; i < cleanSeq.length; i += 3) {
                if (i + 2 >= cleanSeq.length) break;
                const codon = cleanSeq.substring(i, i + 3);
                if (/[^ACGT]/i.test(codon)) aa.push('X');
                else aa.push(CODON_TABLE[codon] || 'X');
            }
            return { name: s.name, str: aa.join(''), original: cleanSeq };
        } else {
            return { name: s.name, str: cleanSeq, original: cleanSeq };
        }
    });

    const refStr = seqsToAlign[ui.refIndex].str;
    const results = new Array(seqsToAlign.length);
    results[ui.refIndex] = { alignedRef: refStr, alignedQuery: refStr };

    let currentIndex = 0;
    const total = seqsToAlign.length;

    function tick() {
        const startT = performance.now();
        while (currentIndex < total && (performance.now() - startT < 30)) {
            if (currentIndex !== ui.refIndex) {
                const query = seqsToAlign[currentIndex];
                const [alnRef, alnQuery] = doubleDP_nwalign(refStr, query.str);
                results[currentIndex] = { alignedRef: alnRef, alignedQuery: alnQuery };
            }
            currentIndex++;
        }

        const pct = Math.round((currentIndex / total) * 100);
        ui.overlayMsg = `Aligning... ${currentIndex}/${total} (${pct}%)`;

        if (currentIndex < total) {
            setTimeout(tick, 0);
        } else {
            ui.overlayMsg = "Reconstructing...";
            setTimeout(() => {
                reconstructAlignment(results, seqsToAlign, alignMode, isAA);
                ui.overlayActive = false;
            }, 10);
        }
    }
    tick();
}

function reconstructAlignment(results: any[], seqsToAlign: any[], alignMode: string, isAA: boolean) {
    const refStr = seqsToAlign[ui.refIndex].str;
    const refLen = refStr.length;

    const insertionsMap = Array(refLen + 1).fill(null).map(() => [] as { seqIdx: number; str: string }[]);

    for (let i = 0; i < results.length; i++) {
        if (!results[i]) continue;
        const res = results[i];
        let rIdx = 0;
        let currentIns = "";

        for (let k = 0; k < res.alignedRef.length; k++) {
            if (res.alignedRef[k] === '-') {
                currentIns += res.alignedQuery[k];
            } else {
                if (currentIns.length > 0) {
                    insertionsMap[rIdx].push({ seqIdx: i, str: currentIns });
                    currentIns = "";
                }
                rIdx++;
            }
        }
        if (currentIns.length > 0) insertionsMap[refLen].push({ seqIdx: i, str: currentIns });
    }

    const insertionWidths = new Int32Array(refLen + 1);
    const polishedCache = new Map<number, Map<number, string>>();

    for (let i = 0; i <= refLen; i++) {
        const bucket = insertionsMap[i];
        if (bucket.length === 0) continue;

        if (alignMode === 'discard') {
            insertionWidths[i] = 0;
        } else if (alignMode === 'left') {
            let max = 0;
            for (const item of bucket) if (item.str.length > max) max = item.str.length;
            insertionWidths[i] = max;
        } else if (alignMode === 'polish') {
            let leader = "";
            for (const item of bucket) if (item.str.length > leader.length) leader = item.str;
            if (leader.length === 0) { insertionWidths[i] = 0; continue; }

            let maxPolishedLen = leader.length;

            for (const item of bucket) {
                if (item.str === leader) {
                    if (!polishedCache.has(item.seqIdx)) polishedCache.set(item.seqIdx, new Map());
                    polishedCache.get(item.seqIdx)!.set(i, leader);
                } else {
                    const [, polishedQuery] = doubleDP_nwalign(leader, item.str);
                    if (!polishedCache.has(item.seqIdx)) polishedCache.set(item.seqIdx, new Map());
                    polishedCache.get(item.seqIdx)!.set(i, polishedQuery);
                    if (polishedQuery.length > maxPolishedLen) maxPolishedLen = polishedQuery.length;
                }
            }
            insertionWidths[i] = maxPolishedLen;
        }
    }

    for (let i = 0; i < seqsToAlign.length; i++) {
        const res = results[i];
        let alnPos = 0;

        if (!isAA) {
            let finalStr = "";

            const handleInsertion = (mapIdx: number) => {
                let myIns = "";
                while (alnPos < res.alignedRef.length && res.alignedRef[alnPos] === '-') {
                    myIns += res.alignedQuery[alnPos];
                    alnPos++;
                }

                if (alignMode !== 'discard') {
                    let content = myIns;
                    if (alignMode === 'polish' && myIns.length > 0 && polishedCache.has(i) && polishedCache.get(i)!.has(mapIdx)) {
                        content = polishedCache.get(i)!.get(mapIdx)!;
                    }
                    while (content.length < insertionWidths[mapIdx]) content += '-';
                    finalStr += content;
                }
            };

            handleInsertion(0);

            for (let r = 0; r < refLen; r++) {
                if (alnPos < res.alignedRef.length) {
                    finalStr += res.alignedQuery[alnPos];
                    alnPos++;
                }
                handleInsertion(r + 1);
            }
            data.rawSequences[i].seq = finalStr.split('');
        } else {
            const finalSeq: string[] = [];
            let dnaIdx = ui.frame - 1;
            const cleanDNA = seqsToAlign[i].original;

            for (let p = 0; p < ui.frame - 1; p++) finalSeq.push(cleanDNA[p] || '-');

            const getCodon = (): string[] => {
                if (dnaIdx + 3 <= cleanDNA.length) {
                    const c = cleanDNA.slice(dnaIdx, dnaIdx + 3);
                    dnaIdx += 3;
                    return c.split('');
                }
                dnaIdx += 3;
                return ['-', '-', '-'];
            };

            const skipCodon = () => { dnaIdx += 3; };

            const handleAAInsertion = (mapIdx: number) => {
                let myIns = "";
                while (alnPos < res.alignedRef.length && res.alignedRef[alnPos] === '-') {
                    myIns += res.alignedQuery[alnPos];
                    alnPos++;
                }

                if (alignMode === 'discard') {
                    for (const char of myIns) {
                        if (char !== '-') skipCodon();
                    }
                } else {
                    let content = myIns;
                    if (alignMode === 'polish' && myIns.length > 0 && polishedCache.has(i) && polishedCache.get(i)!.has(mapIdx)) {
                        content = polishedCache.get(i)!.get(mapIdx)!;
                    }

                    for (const char of content) {
                        if (char === '-') {
                            finalSeq.push('-', '-', '-');
                        } else {
                            finalSeq.push(...getCodon());
                        }
                    }

                    const currentLen = content.length;
                    const targetLen = insertionWidths[mapIdx];
                    for (let k = currentLen; k < targetLen; k++) finalSeq.push('-', '-', '-');
                }
            };

            handleAAInsertion(0);

            for (let r = 0; r < refLen; r++) {
                if (alnPos < res.alignedRef.length) {
                    const char = res.alignedQuery[alnPos];
                    if (char === '-') finalSeq.push('-', '-', '-');
                    else finalSeq.push(...getCodon());
                    alnPos++;
                }
                handleAAInsertion(r + 1);
            }

            while (dnaIdx < cleanDNA.length) finalSeq.push(cleanDNA[dnaIdx++]);

            data.rawSequences[i].seq = finalSeq;
        }
    }
    recalc();
}

export function realignSelection() {
    if (!ui.selection) return;
    saveState();

    const { r1, r2, c1, c2 } = ui.selection;
    const isAA = (ui.mode === 'AA');

    const blockSeqs: { index: number; str: string }[] = [];

    for (let r = r1; r <= r2; r++) {
        if (r >= data.viewSequences.length) continue;
        const seqObj = data.viewSequences[r];
        const slice = seqObj.seq.slice(c1, c2 + 1).join('');
        const stripped = slice.replace(/-/g, '');
        blockSeqs.push({ index: r, str: stripped });
    }

    let templateStr = "";
    let templateRow = -1;

    if (ui.refIndex >= r1 && ui.refIndex <= r2) {
        templateRow = ui.refIndex;
        templateStr = blockSeqs.find(b => b.index === templateRow)!.str;
    } else {
        let maxLen = -1;
        blockSeqs.forEach(b => {
            if (b.str.length > maxLen) { maxLen = b.str.length; templateStr = b.str; templateRow = b.index; }
        });
    }

    if (!templateStr) return;

    const results = blockSeqs.map(b => {
        if (b.str === templateStr) return { alignedRef: templateStr, alignedQuery: templateStr };
        const [aRef, aQuery] = doubleDP_nwalign(templateStr, b.str);
        return { alignedRef: aRef, alignedQuery: aQuery };
    });

    const tLen = templateStr.length;
    const gapMap = new Int32Array(tLen + 1);

    results.forEach(res => {
        let tIdx = 0;
        let currentGap = 0;
        for (let i = 0; i < res.alignedRef.length; i++) {
            if (res.alignedRef[i] === '-') {
                currentGap++;
            } else {
                if (currentGap > gapMap[tIdx]) gapMap[tIdx] = currentGap;
                currentGap = 0;
                tIdx++;
            }
        }
        if (currentGap > gapMap[tLen]) gapMap[tLen] = currentGap;
    });

    const newBlockStrings = results.map(res => {
        let s = "";
        let pos = 0;

        let ins = "";
        while (pos < res.alignedRef.length && res.alignedRef[pos] === '-') {
            ins += res.alignedQuery[pos++];
        }
        s += ins.padEnd(gapMap[0], '-');

        for (let i = 0; i < tLen; i++) {
            if (pos < res.alignedRef.length) s += res.alignedQuery[pos++];
            ins = "";
            while (pos < res.alignedRef.length && res.alignedRef[pos] === '-') {
                ins += res.alignedQuery[pos++];
            }
            s += ins.padEnd(gapMap[i + 1], '-');
        }
        return s;
    });

    const newWidth = newBlockStrings[0].length;
    const diff = newWidth - (c2 - c1 + 1);

    if (diff > 0) {
        data.rawSequences.forEach(s => {
            const dna = s.seq;
            if (isAA) {
                const insIdx = (c2 + 1) * 3 + (ui.frame - 1);
                for (let k = 0; k < diff * 3; k++) dna.splice(insIdx, 0, '-');
            } else {
                for (let k = 0; k < diff; k++) dna.splice(c2 + 1, 0, '-');
            }
        });
        ui.selection = { ...ui.selection, c2: ui.selection.c2 + diff };
    }

    newBlockStrings.forEach((str, idx) => {
        const rowIdx = blockSeqs[idx].index;
        const dna = data.rawSequences[rowIdx].seq;

        if (isAA) {
            const off = ui.frame - 1;
            const rawSlice = data.rawSequences[rowIdx].seq.slice(c1 * 3 + off, (c1 * 3 + off) + ((c2 - c1 + 1 - diff) * 3));
            const codingDNA: string[][] = [];
            for (let i = 0; i < rawSlice.length; i += 3) {
                if (rawSlice[i] !== '-') codingDNA.push(rawSlice.slice(i, i + 3));
            }

            let codIdx = 0;
            let dPos = c1 * 3 + off;

            for (const char of str) {
                if (char === '-') {
                    dna[dPos] = '-'; dna[dPos + 1] = '-'; dna[dPos + 2] = '-';
                } else {
                    if (codIdx < codingDNA.length) {
                        const cod = codingDNA[codIdx++];
                        dna[dPos] = cod[0]; dna[dPos + 1] = cod[1]; dna[dPos + 2] = cod[2];
                    } else {
                        dna[dPos] = 'N'; dna[dPos + 1] = 'N'; dna[dPos + 2] = 'N';
                    }
                }
                dPos += 3;
            }
        } else {
            for (let k = 0; k < str.length; k++) {
                dna[c1 + k] = str[k];
            }
            for (let k = str.length; k < (c2 - c1 + 1); k++) {
                dna[c1 + k] = '-';
            }
        }
    });

    recalc();
}

export function runFrameCleanTask(refMode: string, pBackbone: number, pInsertion: number, startPenalty: number, extendPenalty: number) {
    if (!data.rawSequences.length) return;
    saveState();
    ui.overlayActive = true;
    ui.overlayMsg = "Cleaning reading frame...";
    ui.overlaySub = "Inferring frame with FrameClean";

    setTimeout(() => {
        try {
            const aln = data.rawSequences.map((s, i) => ({
                id: i.toString(),
                seq: s.seq.join('')
            }));

            const options: Record<string, any> = {
                columnModelOptions: { pBackbone, pInsertion },
                priorModelOptions: {
                    insertionStartPenalty: startPenalty,
                    insertionExtendPenalty: extendPenalty,
                    insertionEndResidPenalty: [0, -6, -6]
                }
            };

            if (refMode !== 'no') {
                options.reference = {
                    index: ui.refIndex,
                    mode: refMode,
                    frameOffset: (ui.frame - 1)
                };
            }

            const inferred = FrameClean.inferFrame(aln, options);
            const cleanedObj = FrameClean.cleanInFrame(aln, inferred);

            cleanedObj.alignment.forEach((s) => {
                const originalIdx = parseInt(s.id);
                data.rawSequences[originalIdx].seq = s.seq.split('');
            });

            ui.selection = null;
            recalc();
            ui.overlayActive = false;
        } catch (err: any) {
            console.error("FrameClean error:", err);
            ui.overlayActive = false;
        }
    }, 50);
}
