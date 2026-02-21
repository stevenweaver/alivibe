import { CONFIG, CODON_TABLE } from './config.js';

export interface SeqEntry {
    name: string;
    seq: string[];
}

export interface ViewEntry {
    name: string;
    seq: string[];
}

export interface Selection {
    r1: number;
    r2: number;
    c1: number;
    c2: number;
}

export interface TreeNode {
    children: TreeNode[];
    name: string | null;
    len: number;
    parent?: TreeNode;
    xDepth?: number;
    yRow?: number;
    hidden?: boolean;
    leafCount?: number;
}

export interface TreeData {
    root: TreeNode;
    maxDepth: number;
}

interface HistorySnapshot {
    seqs: SeqEntry[];
    sel: Selection | null;
    refIdx: number;
}

/** Heavy mutable data — not reactive, mutated directly */
export const data = {
    rawSequences: [] as SeqEntry[],
    viewSequences: [] as ViewEntry[],
    history: [] as HistorySnapshot[],
    refMap: new Int32Array(0),
};

/** UI-reactive state using Svelte 5 $state runes */
class UIState {
    mode: 'NT' | 'AA' = $state('NT');
    highlightMatches: boolean = $state(false);
    frame: number = $state(1);
    maxLength: number = $state(0);
    selection: Selection | null = $state(null);
    selectionAnchor: { r: number; c: number } | null = $state(null);
    tree: TreeData | null = $state(null);
    treeWidth: number = $state(0);
    refIndex: number = $state(0);
    mouse = $state({
        isDown: false,
        target: null as string | null,
        startR: 0,
        startC: 0,
        lastHoverC: 0
    });
    ctxTargetRow: number | null = $state(null);
    pastedNameCounter: number = $state(1);
    dragSaved: boolean = $state(false);
    overlayActive: boolean = $state(false);
    overlayMsg: string = $state('Processing...');
    overlaySub: string = $state('');
    helpVisible: boolean = $state(false);
    cleanOverlayVisible: boolean = $state(false);
    inferOverlayVisible: boolean = $state(false);
    historyLength: number = $state(0);
    seqCount: number = $state(0);
    // Aioli CLI reference
    aioliCLI: any = $state(null);
    // Temp name map for FastTree index->name mapping
    tempNameMap: string[] | null = $state(null);
}

export const ui = new UIState();

/** Recalculate view sequences and derived state from rawSequences */
export function recalc() {
    ui.historyLength = data.history.length;

    if (!data.rawSequences.length) {
        data.viewSequences = [];
        ui.seqCount = 0;
        return;
    }

    if (ui.mode === 'NT') {
        data.viewSequences = data.rawSequences.map(s => ({ name: s.name, seq: s.seq }));
    } else {
        const offset = ui.frame - 1;
        data.viewSequences = data.rawSequences.map(s => {
            const dna = s.seq;
            const aa: string[] = [];
            for (let i = offset; i < dna.length; i += 3) {
                if (i + 2 >= dna.length) break;
                const codon = dna.slice(i, i + 3).join('');
                if (codon.includes('-')) aa.push('-');
                else if (/[^ACGT]/i.test(codon)) aa.push('X');
                else aa.push(CODON_TABLE[codon] || 'X');
            }
            return { name: s.name, seq: aa };
        });
    }

    if (ui.refIndex >= data.viewSequences.length) ui.refIndex = 0;

    let max = 0;
    data.viewSequences.forEach(s => max = Math.max(max, s.seq.length));
    ui.maxLength = max;
    ui.seqCount = data.viewSequences.length;

    data.refMap = new Int32Array(max + 1);
    if (data.viewSequences[ui.refIndex]) {
        const refSeq = data.viewSequences[ui.refIndex].seq;
        let count = 0;
        for (let i = 0; i < max; i++) {
            const char = (i < refSeq.length) ? refSeq[i] : '-';
            if (char !== '-') count++;
            data.refMap[i] = count;
        }
    }
}

export function saveState() {
    const snapshot: HistorySnapshot = {
        seqs: JSON.parse(JSON.stringify(data.rawSequences)),
        sel: ui.selection ? { ...ui.selection } : null,
        refIdx: ui.refIndex
    };
    data.history.push(snapshot);
    if (data.history.length > CONFIG.maxHistory) data.history.shift();
    ui.historyLength = data.history.length;
}

export function undo() {
    if (data.history.length === 0) return;
    const prev = data.history.pop()!;
    data.rawSequences = prev.seqs;
    ui.selection = prev.sel;
    if (prev.refIdx < data.rawSequences.length) ui.refIndex = prev.refIdx;
    else ui.refIndex = 0;
    ui.historyLength = data.history.length;
    recalc();
}
