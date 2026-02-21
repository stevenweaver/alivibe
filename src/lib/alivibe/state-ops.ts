import { data, ui, saveState, recalc, type Selection } from './state.svelte.js';

export function insertGap() {
    const sel = ui.selection;
    if (!sel) return;
    const { r1, r2, c1 } = sel;
    for (let r = r1; r <= r2; r++) {
        if (!data.rawSequences[r]) continue;
        const dna = data.rawSequences[r].seq;
        if (ui.mode === 'NT') dna.splice(c1, 0, '-');
        else {
            const idx = (c1 * 3) + (ui.frame - 1);
            dna.splice(idx, 0, '-', '-', '-');
        }
    }
    recalc();
}

export function handleDeletion() {
    const sel = ui.selection;
    if (!sel) return;
    const { r1, r2, c1, c2 } = sel;
    const allRows = data.viewSequences.length;

    if (c1 === 0 && c2 >= 99999) {
        data.rawSequences.splice(r1, r2 - r1 + 1);
        ui.selection = null;
        recalc();
        return;
    }
    if (r1 === 0 && r2 >= allRows - 1) {
        const count = c2 - c1 + 1;
        data.rawSequences.forEach(s => {
            const dna = s.seq;
            if (ui.mode === 'NT') {
                if (c1 < dna.length) dna.splice(c1, count);
            } else {
                const off = ui.frame - 1;
                const idx = (c1 * 3) + off;
                if (idx < dna.length) dna.splice(idx, count * 3);
            }
        });
        ui.selection = null;
        recalc();
        return;
    }
    deleteBlock();
}

export function deleteBlock() {
    const sel = ui.selection;
    if (!sel) return;
    const { r1, r2, c1, c2 } = sel;
    const safeC2 = (c2 > 99999) ? ui.maxLength + 10 : c2;
    const safeCount = safeC2 - c1 + 1;

    for (let r = r1; r <= r2; r++) {
        if (!data.rawSequences[r]) continue;
        const dna = data.rawSequences[r].seq;
        if (ui.mode === 'NT') dna.splice(c1, safeCount);
        else {
            const off = ui.frame - 1;
            const idx = (c1 * 3) + off;
            if (idx < dna.length) dna.splice(idx, safeCount * 3);
        }
    }
    ui.selection = { r1, r2, c1, c2: c1 };
    recalc();
}

export function overwriteBlock(char: string) {
    const sel = ui.selection;
    if (!sel) return;
    const { r1, r2, c1, c2 } = sel;
    for (let r = r1; r <= r2; r++) {
        if (!data.rawSequences[r]) continue;
        const dna = data.rawSequences[r].seq;
        const effectiveC2 = Math.min(c2, dna.length + 50);
        for (let c = c1; c <= effectiveC2; c++) {
            if (c < dna.length) dna[c] = char;
            else dna.push(char);
        }
    }
    recalc();
}

export function attemptMoveSelection(dir: number) {
    if (dir === 0) return;
    const sel = ui.selection;
    if (!sel) return;
    const { r1, r2, c1, c2 } = sel;
    let canMove = true;
    for (let r = r1; r <= r2; r++) {
        if (!data.rawSequences[r]) continue;
        const dna = data.rawSequences[r].seq;
        let start: number, end: number, step: number;
        if (ui.mode === 'NT') { start = c1; end = c2; step = 1; }
        else { const off = ui.frame - 1; start = c1 * 3 + off; end = c2 * 3 + off + 2; step = 3; }
        const checkEnd = Math.min(end, dna.length - 1);

        if (dir > 0) {
            for (let k = 1; k <= step; k++) if (checkEnd + k < dna.length && dna[checkEnd + k] !== '-') { canMove = false; break; }
        } else {
            if (start - step < 0) { canMove = false; break; }
            for (let k = 1; k <= step; k++) if (dna[start - k] !== '-') { canMove = false; break; }
        }
        if (!canMove) break;
    }
    if (!canMove) return;

    for (let r = r1; r <= r2; r++) {
        if (!data.rawSequences[r]) continue;
        const dna = data.rawSequences[r].seq;
        let start: number, end: number, step: number;
        if (ui.mode === 'NT') { start = c1; end = c2; step = 1; }
        else { const off = ui.frame - 1; start = c1 * 3 + off; end = c2 * 3 + off + 2; step = 3; }
        const effectiveEnd = Math.min(end, dna.length - 1);

        if (dir > 0) {
            while (dna.length <= effectiveEnd + step) dna.push('-');
            for (let i = effectiveEnd; i >= start; i--) { dna[i + step] = dna[i]; dna[i] = '-'; }
        } else {
            for (let i = start; i <= effectiveEnd; i++) { dna[i - step] = dna[i]; dna[i] = '-'; }
        }
    }
    ui.selection = { ...sel, c1: sel.c1 + (dir > 0 ? 1 : -1), c2: sel.c2 + (dir > 0 ? 1 : -1) };
    recalc();
}

export function stripGapsGlobal() {
    saveState();
    data.rawSequences.forEach(s => {
        s.seq = s.seq.filter(c => c !== '-');
    });
    ui.selection = null;
    recalc();
}

export function clearAlignment() {
    saveState();
    data.rawSequences = [];
    data.viewSequences = [];
    ui.selection = null;
    ui.tree = null;
    ui.refIndex = 0;
    ui.maxLength = 0;
    data.refMap = new Int32Array(0);
    ui.pastedNameCounter = 1;
    ui.treeWidth = 0;
    recalc();
}

export function clearTreeOnly() {
    ui.tree = null;
    ui.treeWidth = 0;
}

export function setMode(m: 'NT' | 'AA') {
    ui.mode = m;
    ui.selection = null;
    recalc();
}
