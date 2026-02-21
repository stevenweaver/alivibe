import { CONFIG } from './config.js';
import { data, ui } from './state.svelte.js';

export interface CanvasRefs {
    cvsSeq: HTMLCanvasElement;
    cvsNames: HTMLCanvasElement;
    cvsRuler: HTMLCanvasElement;
    cvsTree: HTMLCanvasElement;
    areaSeq: HTMLDivElement;
}

export function render(refs: CanvasRefs) {
    const { cvsSeq, cvsNames, cvsRuler, cvsTree, areaSeq } = refs;

    const ctxSeq = cvsSeq.getContext('2d', { alpha: false })!;
    const ctxNames = cvsNames.getContext('2d')!;
    const ctxRuler = cvsRuler.getContext('2d')!;
    const ctxTree = cvsTree.getContext('2d')!;

    if (!data.viewSequences.length && data.rawSequences.length === 0) {
        ctxSeq.clearRect(0, 0, cvsSeq.width, cvsSeq.height);
        return;
    }

    const vW = cvsSeq.width, vH = cvsSeq.height;
    const scrollLeft = areaSeq.scrollLeft, scrollTop = areaSeq.scrollTop;

    const startRow = Math.floor(scrollTop / CONFIG.rowHeight);
    const endRow = Math.min(data.viewSequences.length, Math.ceil((scrollTop + vH) / CONFIG.rowHeight));
    const startCol = Math.floor(scrollLeft / CONFIG.charWidth);
    const endCol = Math.ceil((scrollLeft + vW) / CONFIG.charWidth);

    // Sequence canvas
    ctxSeq.fillStyle = '#ffffff';
    ctxSeq.fillRect(0, 0, vW, vH);
    ctxSeq.font = CONFIG.font;
    ctxSeq.textBaseline = 'middle';
    ctxSeq.textAlign = 'center';
    const colors = ui.mode === 'NT' ? CONFIG.colors.NT : CONFIG.colors.AA;
    const refSeq = data.viewSequences[ui.refIndex] ? data.viewSequences[ui.refIndex].seq : null;

    for (let r = startRow; r < endRow; r++) {
        const seq = data.viewSequences[r].seq;
        const y = (r * CONFIG.rowHeight) - scrollTop;
        for (let c = startCol; c < endCol; c++) {
            if (c >= seq.length) break;
            const char = seq[c];
            const x = (c * CONFIG.charWidth) - scrollLeft;
            let fillColor = colors[char] || colors['default'];

            if (ui.highlightMatches && refSeq) {
                const refChar = (c < refSeq.length) ? refSeq[c] : '-';
                if (refChar !== '-') {
                    if (char === refChar) {
                        fillColor = CONFIG.highlightMatchColor;
                    } else if (char === '-') {
                        fillColor = CONFIG.highlightGapColor;
                    }
                }
            }

            ctxSeq.fillStyle = fillColor;
            ctxSeq.fillRect(x, y, CONFIG.charWidth, CONFIG.rowHeight);
            if (char !== '-') {
                ctxSeq.fillStyle = '#000';
                ctxSeq.fillText(char, x + CONFIG.charWidth / 2, y + CONFIG.rowHeight / 2);
            }
        }
    }

    // Selection overlay
    if (ui.selection) {
        const { r1, r2, c1, c2 } = ui.selection;
        const visC2 = Math.min(c2, ui.maxLength + 20);
        const sx = (c1 * CONFIG.charWidth) - scrollLeft;
        const sy = (r1 * CONFIG.rowHeight) - scrollTop;
        const w = Math.max(4, (visC2 - c1 + 1) * CONFIG.charWidth);
        const h = (r2 - r1 + 1) * CONFIG.rowHeight;

        ctxSeq.fillStyle = 'rgba(37, 99, 235, 0.2)';
        ctxSeq.fillRect(sx, sy, w, h);
        ctxSeq.strokeStyle = 'rgba(37, 99, 235, 0.8)';
        ctxSeq.lineWidth = 1;
        ctxSeq.strokeRect(sx, sy, w, h);
    }

    // Names canvas
    ctxNames.fillStyle = '#fff';
    ctxNames.fillRect(0, 0, cvsNames.width, cvsNames.height);
    ctxNames.font = CONFIG.labelFont;
    ctxNames.textBaseline = 'middle';
    ctxNames.textAlign = 'left';
    for (let r = startRow; r < endRow; r++) {
        const y = (r * CONFIG.rowHeight) - scrollTop;
        const isSel = ui.selection && (r >= ui.selection.r1 && r <= ui.selection.r2);

        if (r === ui.refIndex) ctxNames.fillStyle = '#eff6ff';
        else ctxNames.fillStyle = isSel ? '#eff6ff' : (r % 2 === 0 ? '#f9fafb' : '#fff');

        ctxNames.fillRect(0, y, cvsNames.width, CONFIG.rowHeight);

        if (r === ui.refIndex) {
            ctxNames.fillStyle = '#2563eb';
            ctxNames.font = "bold " + CONFIG.labelFont;
        } else {
            ctxNames.fillStyle = isSel ? '#1e40af' : '#374151';
            ctxNames.font = CONFIG.labelFont;
        }

        let label = data.viewSequences[r].name;
        if (r === ui.refIndex) label += " [Ref]";
        ctxNames.fillText(label, 10, y + CONFIG.rowHeight / 2);
    }

    // Ruler canvas
    ctxRuler.fillStyle = '#f3f4f6';
    ctxRuler.fillRect(0, 0, cvsRuler.width, cvsRuler.height);
    ctxRuler.font = "10px sans-serif";
    ctxRuler.textAlign = "center";

    const h = cvsRuler.height;
    const mid = h / 2;

    ctxRuler.strokeStyle = '#e5e7eb';
    ctxRuler.beginPath();
    ctxRuler.moveTo(0, mid);
    ctxRuler.lineTo(cvsRuler.width, mid);
    ctxRuler.stroke();

    ctxRuler.strokeStyle = "#9ca3af";

    for (let c = startCol; c < endCol; c++) {
        const x = (c * CONFIG.charWidth) - scrollLeft + (CONFIG.charWidth / 2);
        const isSel = ui.selection && (c >= ui.selection.c1 && c <= ui.selection.c2);

        if (isSel) {
            ctxRuler.fillStyle = "rgba(37, 99, 235, 0.2)";
            ctxRuler.fillRect((c * CONFIG.charWidth) - scrollLeft, 0, CONFIG.charWidth, h);
        }

        const alnIdx = c + 1;
        ctxRuler.fillStyle = "#6b7280";
        if (alnIdx === 1 || alnIdx % CONFIG.rulerTickStep === 0) {
            ctxRuler.moveTo(x, mid + 15);
            ctxRuler.lineTo(x, h);
            ctxRuler.fillText(String(alnIdx), x, mid + 12);
        } else if (alnIdx % (CONFIG.rulerTickStep / 2) === 0) {
            ctxRuler.moveTo(x, mid + 22);
            ctxRuler.lineTo(x, h);
        }

        const refIdx = data.refMap[c];
        const prevRefIdx = (c > 0) ? data.refMap[c - 1] : 0;

        if (refIdx !== prevRefIdx) {
            ctxRuler.fillStyle = "#2563eb";
            if (refIdx === 1 || refIdx % CONFIG.rulerTickStep === 0) {
                ctxRuler.moveTo(x, 0);
                ctxRuler.lineTo(x, 15);
                ctxRuler.fillText(String(refIdx), x, 25);
            } else if (refIdx % (CONFIG.rulerTickStep / 2) === 0) {
                ctxRuler.moveTo(x, 0);
                ctxRuler.lineTo(x, 8);
            }
        }
    }
    ctxRuler.stroke();

    ctxRuler.fillStyle = "#2563eb";
    ctxRuler.font = "9px sans-serif";
    ctxRuler.textAlign = "left";
    ctxRuler.fillText("Ref", 2, 12);
    ctxRuler.fillStyle = "#6b7280";
    ctxRuler.fillText("Aln", 2, mid + 12);

    // Tree canvas
    if (ui.treeWidth > 0 && ui.tree) {
        ctxTree.clearRect(0, 0, cvsTree.width, cvsTree.height);
        ctxTree.save();
        ctxTree.translate(0, -scrollTop);
        ctxTree.strokeStyle = '#374151';
        ctxTree.lineWidth = 1;

        const padding = 15;
        const availableW = cvsTree.width - padding;
        const xScale = ui.tree.maxDepth > 0 ? (availableW / ui.tree.maxDepth) : 1;

        const drawNode = (node: any) => {
            if (node.hidden) return;
            const x = (node.xDepth * xScale) + 5;
            const y = (node.yRow * CONFIG.rowHeight) + (CONFIG.rowHeight / 2);

            if (node.children && node.children.length > 0) {
                let minY = Infinity, maxY = -Infinity;
                node.children.forEach((c: any) => {
                    if (c.hidden) return;
                    drawNode(c);
                    const cx = (c.xDepth * xScale) + 5;
                    const cy = (c.yRow * CONFIG.rowHeight) + (CONFIG.rowHeight / 2);

                    ctxTree.beginPath();
                    ctxTree.moveTo(x, cy);
                    ctxTree.lineTo(cx, cy);
                    ctxTree.stroke();

                    if (cy < minY) minY = cy;
                    if (cy > maxY) maxY = cy;
                });

                if (minY !== Infinity) {
                    ctxTree.beginPath();
                    ctxTree.moveTo(x, minY);
                    ctxTree.lineTo(x, maxY);
                    ctxTree.stroke();
                }
            } else {
                ctxTree.save();
                ctxTree.setLineDash([2, 4]);
                ctxTree.strokeStyle = '#d1d5db';
                ctxTree.beginPath();
                ctxTree.moveTo(x, y);
                ctxTree.lineTo(cvsTree.width, y);
                ctxTree.stroke();
                ctxTree.restore();
            }
        };

        drawNode(ui.tree.root);
        ctxTree.restore();
    }
}
