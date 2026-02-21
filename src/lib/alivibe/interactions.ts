import { CONFIG } from './config.js';
import { data, ui, saveState } from './state.svelte.js';
import { insertGap, handleDeletion, overwriteBlock, attemptMoveSelection } from './state-ops.js';
import { handleClipboardPaste, getClipboardContent } from './io.js';

export function getCoords(e: MouseEvent, type: string, areaSeq: HTMLDivElement, areaNames: HTMLDivElement, areaRuler: HTMLDivElement) {
    let r = 0, c = 0;
    const el = type === 'SEQ' ? areaSeq : (type === 'NAMES' ? areaNames : areaRuler);
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (type === 'SEQ') {
        c = Math.floor((x + areaSeq.scrollLeft) / CONFIG.charWidth);
        r = Math.floor((y + areaSeq.scrollTop) / CONFIG.rowHeight);
    } else if (type === 'NAMES') {
        r = Math.floor((y + areaSeq.scrollTop) / CONFIG.rowHeight);
    } else if (type === 'RULER') {
        c = Math.floor((x + areaSeq.scrollLeft) / CONFIG.charWidth);
    }
    return { r, c };
}

export function onMouseDown(e: MouseEvent, type: string, areaSeq: HTMLDivElement, areaNames: HTMLDivElement, areaRuler: HTMLDivElement) {
    areaSeq.focus();

    const { r, c } = getCoords(e, type, areaSeq, areaNames, areaRuler);
    const maxR = Math.max(0, data.viewSequences.length - 1);
    const safeR = Math.min(r, maxR);
    const safeC = Math.max(0, c);

    ui.mouse.isDown = true;
    ui.mouse.startR = safeR;
    ui.mouse.startC = safeC;
    ui.mouse.lastHoverC = safeC;

    // Shift Click Logic
    if (e.shiftKey && ui.selectionAnchor) {
        ui.mouse.target = type;
        const anchor = ui.selectionAnchor;

        const newR1 = Math.min(anchor.r, safeR);
        const newR2 = Math.max(anchor.r, safeR);
        const newC1 = Math.min(anchor.c, safeC);
        const newC2 = Math.max(anchor.c, safeC);

        if (type === 'NAMES') {
            ui.selection = { r1: newR1, r2: newR2, c1: 0, c2: 99999999 };
        } else if (type === 'RULER') {
            ui.selection = { r1: 0, r2: maxR, c1: newC1, c2: newC2 };
        } else if (type === 'SEQ') {
            ui.selection = { r1: newR1, r2: newR2, c1: newC1, c2: newC2 };
        }
        return;
    }

    if (type === 'SEQ' && isInsideSelection(r, c) && !e.shiftKey) {
        ui.mouse.target = 'MOVE';
    } else if (ui.mouse.target === 'RESIZE_TREE') {
        // handled
    } else {
        ui.mouse.target = type;
        ui.selectionAnchor = { r: safeR, c: safeC };

        if (type === 'SEQ') {
            ui.selection = { r1: safeR, c1: safeC, r2: safeR, c2: safeC };
        } else if (type === 'NAMES') {
            ui.selection = { r1: safeR, r2: safeR, c1: 0, c2: 99999999 };
        } else if (type === 'RULER') {
            ui.selection = { r1: 0, r2: maxR, c1: safeC, c2: safeC };
        }
    }
}

export function onMouseMove(e: MouseEvent, areaSeq: HTMLDivElement, areaNames: HTMLDivElement, areaRuler: HTMLDivElement) {
    if (!ui.mouse.isDown) return;

    if (ui.mouse.target === 'RESIZE_TREE') {
        const x = e.clientX;
        ui.treeWidth = Math.max(20, Math.min(600, x));
        return;
    }

    const { r, c } = getCoords(e, 'SEQ', areaSeq, areaNames, areaRuler);
    const safeR = Math.max(0, Math.min(data.viewSequences.length - 1, r));
    const safeC = Math.max(0, c);

    if (ui.mouse.target === 'SEQ') {
        ui.selection = {
            r1: Math.min(ui.mouse.startR, safeR),
            r2: Math.max(ui.mouse.startR, safeR),
            c1: Math.min(ui.mouse.startC, safeC),
            c2: Math.max(ui.mouse.startC, safeC)
        };
    } else if (ui.mouse.target === 'NAMES') {
        ui.selection = {
            r1: Math.min(ui.mouse.startR, safeR),
            r2: Math.max(ui.mouse.startR, safeR),
            c1: 0, c2: 99999999
        };
    } else if (ui.mouse.target === 'RULER') {
        ui.selection = {
            c1: Math.min(ui.mouse.startC, safeC),
            c2: Math.max(ui.mouse.startC, safeC),
            r1: 0, r2: data.viewSequences.length - 1
        };
    } else if (ui.mouse.target === 'MOVE') {
        const delta = safeC - ui.mouse.lastHoverC;
        if (delta !== 0) {
            if (!ui.dragSaved) { saveState(); ui.dragSaved = true; }
            attemptMoveSelection(delta);
            ui.mouse.lastHoverC = safeC;
        }
    }
}

export function onMouseUp() {
    ui.mouse.isDown = false;
    ui.mouse.target = null;
    ui.dragSaved = false;
}

function isInsideSelection(r: number, c: number): boolean {
    const s = ui.selection;
    if (!s) return false;
    return r >= s.r1 && r <= s.r2 && c >= s.c1 && c <= s.c2;
}

export function onKeyDown(e: KeyboardEvent) {
    if (!ui.selection) return;
    if (e.ctrlKey || e.metaKey) return;

    if (e.key === ' ') { e.preventDefault(); saveState(); insertGap(); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); saveState(); handleDeletion(); }
    else if (ui.mode === 'NT') {
        const char = e.key.toUpperCase();
        if (/^[ACGTURYMKSWHBVDN-]$/.test(char)) { e.preventDefault(); saveState(); overwriteBlock(char); }
    }
}

export function onCopyEvent(e: ClipboardEvent, areaSeq: HTMLDivElement) {
    if (document.activeElement !== areaSeq) return;
    const content = getClipboardContent(true);
    if (!content) return;
    if (e.clipboardData) {
        e.clipboardData.setData('text/plain', content);
        e.preventDefault();
    }
}

export function onPasteEvent(e: ClipboardEvent, areaSeq: HTMLDivElement) {
    if (document.activeElement !== areaSeq) return;
    const clipData = e.clipboardData || (window as any).clipboardData;
    if (!clipData) return;
    const text = clipData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    handleClipboardPaste(text);
}
