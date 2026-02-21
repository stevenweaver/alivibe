import { data, ui, recalc, saveState, type SeqEntry } from './state.svelte.js';
import { parseTree } from './tree.js';

export function parseFasta(text: string) {
    const lines = text.split(/\r?\n/);
    const seqs: SeqEntry[] = [];
    let name: string | null = null, buf: string[] = [];
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        if (line.startsWith('>')) {
            if (name) seqs.push({ name, seq: buf.join('').split('') });
            name = line.substring(1).trim();
            buf = [];
        } else {
            buf.push(line.toUpperCase().replace(/[^A-Z-]/g, ''));
        }
    }
    if (name) seqs.push({ name, seq: buf.join('').split('') });
    finalizeLoad(seqs);
}

export function parseFastq(text: string) {
    const lines = text.split(/\r?\n/);
    const seqs: SeqEntry[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (line.startsWith('@')) {
            const name = line.substring(1);
            if (i + 1 < lines.length) {
                const seqStr = lines[i + 1].trim().toUpperCase().replace(/[^A-Z-]/g, '');
                seqs.push({ name, seq: seqStr.split('') });
                i += 3;
            }
        }
    }
    finalizeLoad(seqs);
}

function finalizeLoad(seqs: SeqEntry[]) {
    data.rawSequences = seqs;
    ui.selection = null;
    data.history = [];
    ui.historyLength = 0;
    ui.tree = null;
    ui.refIndex = 0;
    ui.pastedNameCounter = data.rawSequences.length + 1;
    ui.treeWidth = 0;
    recalc();
    ui.overlayActive = false;
}

export function loadFile(file: File) {
    if (!file) return;
    ui.overlayActive = true;
    ui.overlayMsg = 'Loading...';
    const reader = new FileReader();
    const name = file.name.toLowerCase();
    const isFastq = name.endsWith('.fastq') || name.endsWith('.fq');

    reader.onload = e => {
        if (isFastq) parseFastq(e.target!.result as string);
        else parseFasta(e.target!.result as string);
    };
    reader.readAsText(file);
}

export function loadTreeFile(file: File) {
    if (!file) return;
    ui.overlayActive = true;
    ui.overlayMsg = 'Loading tree...';
    const reader = new FileReader();
    reader.onload = e => parseTree(e.target!.result as string);
    reader.readAsText(file);
}

export async function loadFromURL(alignmentURL: string, treeURL?: string) {
    ui.overlayActive = true;
    ui.overlayMsg = 'Loading alignment...';

    try {
        const response = await fetch(alignmentURL);
        if (!response.ok) throw new Error(`Failed to fetch alignment: ${response.status}`);
        const text = await response.text();
        const name = alignmentURL.toLowerCase();
        const isFastq = name.endsWith('.fastq') || name.endsWith('.fq');
        if (isFastq) parseFastq(text);
        else parseFasta(text);

        if (treeURL) {
            ui.overlayMsg = 'Loading tree...';
            const treeResponse = await fetch(treeURL);
            if (!treeResponse.ok) throw new Error(`Failed to fetch tree: ${treeResponse.status}`);
            const treeText = await treeResponse.text();
            parseTree(treeText);
        }
    } catch (err: any) {
        console.error("Error loading from URL:", err);
        ui.overlayActive = false;
    }
}

export function exportAlignment(target: 'download' | 'clipboard') {
    if (!data.viewSequences.length) return;

    const rows = data.viewSequences.map((_, idx) => idx);
    const content = buildFastaContent(rows, 0, null);
    if (!content) return;

    if (target === 'clipboard') {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(content).catch(err => {
                console.error("Copy failed:", err);
            });
        }
    } else {
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `alignment_${ui.mode}.fasta`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export function getSelectionBounds() {
    if (!ui.selection || !data.viewSequences.length) return null;
    const totalRows = data.viewSequences.length;
    const rowStart = Math.max(0, Math.min(ui.selection.r1, totalRows - 1));
    const rowEnd = Math.max(0, Math.min(ui.selection.r2, totalRows - 1));
    if (rowEnd < rowStart) return null;
    const rows: number[] = [];
    for (let r = rowStart; r <= rowEnd; r++) rows.push(r);
    if (!rows.length) return null;
    const isFullRow = ui.selection.c2 >= 99999999;
    const colStart = isFullRow ? 0 : Math.max(0, ui.selection.c1);
    const colEnd = isFullRow ? null : Math.max(colStart, ui.selection.c2);
    return { rows, colStart, colEnd };
}

export function buildFastaContent(rows: number[], colStart = 0, colEnd: number | null = null): string {
    if (!rows || !rows.length) return "";
    const lines: string[] = [];
    rows.forEach(r => {
        const entry = data.viewSequences[r];
        if (!entry) return;
        const seq = entry.seq;
        const start = Math.min(colStart, seq.length);
        const end = (colEnd === null || colEnd === undefined) ? seq.length : Math.min(seq.length, colEnd + 1);
        const fragment = seq.slice(start, end).join('');
        lines.push(`>${entry.name}`);
        lines.push(fragment);
    });
    return lines.join('\n') + (lines.length ? '\n' : '');
}

export function getClipboardContent(preferSelection = true): string {
    if (!data.viewSequences.length) return "";
    let bounds = preferSelection ? getSelectionBounds() : null;
    if (!bounds) {
        const rows = data.viewSequences.map((_, idx) => idx);
        bounds = { rows, colStart: 0, colEnd: null };
    }
    return buildFastaContent(bounds.rows, bounds.colStart, bounds.colEnd);
}

export function handleClipboardPaste(text: string) {
    if (!text) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const fastaEntries = parseClipboardFasta(trimmed);
    if (fastaEntries.length) {
        appendSequencesFromClipboard(fastaEntries);
        return;
    }

    const lines = trimmed.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 1) {
        const seqStr = lines[0].replace(/\s+/g, '').toUpperCase().replace(/[^A-Z-]/g, '');
        if (seqStr.length) {
            appendSequencesFromClipboard([{ name: null, seq: seqStr.split('') }]);
            return;
        }
    }
}

function parseClipboardFasta(text: string) {
    const lines = text.split(/\r?\n/);
    const seqs: { name: string | null; seq: string[] }[] = [];
    let currentName: string | null = null;
    let buffer: string[] = [];
    let sawHeader = false;

    for (let rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line.startsWith('>')) {
            sawHeader = true;
            if (currentName !== null) {
                const seqStr = buffer.join('');
                if (seqStr.length) seqs.push({ name: currentName, seq: seqStr.split('') });
            }
            currentName = line.substring(1).trim() || null;
            buffer = [];
        } else if (currentName !== null) {
            buffer.push(line.toUpperCase().replace(/[^A-Z-]/g, ''));
        }
    }

    if (currentName !== null) {
        const seqStr = buffer.join('');
        if (seqStr.length) seqs.push({ name: currentName, seq: seqStr.split('') });
    }

    if (!sawHeader) return [];
    return seqs;
}

function appendSequencesFromClipboard(entries: { name: string | null; seq: string[] }[]) {
    const payload = entries.filter(e => e.seq && e.seq.length);
    if (!payload.length) return;
    saveState();
    const existingNames = new Set(data.rawSequences.map(s => s.name));
    payload.forEach(entry => {
        let name = entry.name && entry.name.trim().length ? entry.name.trim() : '';
        if (!name) name = `Pasted_${ui.pastedNameCounter++}`;
        while (existingNames.has(name)) {
            name = `Pasted_${ui.pastedNameCounter++}`;
        }
        existingNames.add(name);
        data.rawSequences.push({ name, seq: entry.seq.slice() });
    });
    ui.selection = null;
    recalc();
}
