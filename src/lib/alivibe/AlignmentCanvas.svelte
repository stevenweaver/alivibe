<script lang="ts">
    import { onMount } from 'svelte';
    import { CONFIG } from './config.js';
    import { data, ui, recalc } from './state.svelte.js';
    import { render, type CanvasRefs } from './render.js';
    import { onMouseDown, onMouseMove, onMouseUp, onKeyDown, onCopyEvent, onPasteEvent } from './interactions.js';
    import { computeTreeLayout } from './tree.js';

    let cvsSeq: HTMLCanvasElement;
    let cvsNames: HTMLCanvasElement;
    let cvsRuler: HTMLCanvasElement;
    let cvsTree: HTMLCanvasElement;
    let areaSeq: HTMLDivElement;
    let areaNames: HTMLDivElement;
    let areaRuler: HTMLDivElement;
    let areaTree: HTMLDivElement;
    let sizer: HTMLDivElement;
    let ctxMenu: HTMLDivElement;

    let refs: CanvasRefs;

    function doRender() {
        if (!refs) return;
        requestAnimationFrame(() => render(refs));
    }

    function onResize() {
        if (!cvsNames || !cvsRuler || !cvsSeq) return;
        cvsNames.width = areaNames.clientWidth;
        cvsNames.height = areaNames.clientHeight;
        cvsRuler.width = areaRuler.clientWidth;
        cvsRuler.height = areaRuler.clientHeight;
        cvsSeq.width = areaSeq.clientWidth;
        cvsSeq.height = areaSeq.clientHeight;
        if (ui.treeWidth > 0 && cvsTree) {
            cvsTree.width = areaTree.clientWidth;
            cvsTree.height = areaTree.clientHeight;
        }
        doRender();
    }

    // Expose doRender and onResize for parent
    export function triggerRender() { doRender(); }
    export function triggerResize() { onResize(); }

    function handleScroll() {
        doRender();
    }

    function handleSeqMouseDown(e: MouseEvent) {
        onMouseDown(e, 'SEQ', areaSeq, areaNames, areaRuler);
        doRender();
    }

    function handleNamesMouseDown(e: MouseEvent) {
        if (e.button === 2) return;
        e.preventDefault();
        onMouseDown(e, 'NAMES', areaSeq, areaNames, areaRuler);
        doRender();
    }

    function handleRulerMouseDown(e: MouseEvent) {
        e.preventDefault();
        onMouseDown(e, 'RULER', areaSeq, areaNames, areaRuler);
        doRender();
    }

    function handleCtxRef() {
        if (ui.ctxTargetRow !== null) {
            ui.refIndex = ui.ctxTargetRow;
            recalc();
            computeTreeLayout();
            doRender();
        }
        ctxMenu.style.display = 'none';
    }

    function handleWindowMouseMove(e: MouseEvent) {
        onMouseMove(e, areaSeq, areaNames, areaRuler);
        doRender();
    }

    function handleWindowMouseUp() {
        const wasGrabbing = ui.mouse.target === 'MOVE';
        onMouseUp();
        if (wasGrabbing && areaSeq) areaSeq.classList.remove('grabbing');
        doRender();
    }

    function handleKeyDown(e: KeyboardEvent) {
        onKeyDown(e);
        doRender();
    }

    function handleCopy(e: ClipboardEvent) {
        onCopyEvent(e, areaSeq);
    }

    function handlePaste(e: ClipboardEvent) {
        onPasteEvent(e, areaSeq);
        doRender();
    }

    function handleResizerMouseDown(e: MouseEvent) {
        e.preventDefault();
        ui.mouse.isDown = true;
        ui.mouse.target = 'RESIZE_TREE';
    }

    function handleGlobalMouseDown(e: MouseEvent) {
        if (ctxMenu && !ctxMenu.contains(e.target as Node)) {
            ctxMenu.style.display = 'none';
        }
    }

    onMount(() => {
        refs = { cvsSeq, cvsNames, cvsRuler, cvsTree, areaSeq };

        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);
        window.addEventListener('resize', onResize);
        window.addEventListener('mousedown', handleGlobalMouseDown);
        window.addEventListener('copy', handleCopy as EventListener);
        window.addEventListener('paste', handlePaste as EventListener);

        onResize();

        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('mousedown', handleGlobalMouseDown);
            window.removeEventListener('copy', handleCopy as EventListener);
            window.removeEventListener('paste', handlePaste as EventListener);
        };
    });

    // Re-render when reactive state changes
    $effect(() => {
        // Track reactive deps
        ui.selection;
        ui.mode;
        ui.highlightMatches;
        ui.maxLength;
        ui.seqCount;
        ui.refIndex;
        ui.tree;
        ui.treeWidth;

        // Update sizer
        if (sizer && data.viewSequences.length) {
            sizer.style.width = (ui.maxLength * CONFIG.charWidth + 200) + 'px';
            sizer.style.height = (data.viewSequences.length * CONFIG.rowHeight) + 'px';
        }

        computeTreeLayout();
        onResize();
    });
</script>

<div
    id="viewer-grid"
    style="--tree-width: {ui.treeWidth}px;"
>
    <div id="area-corner-tree"></div>
    <div id="resizer-tree" onmousedown={handleResizerMouseDown}>
        <span></span>
    </div>
    <div id="area-corner-names"></div>

    <div id="area-tree" bind:this={areaTree}><canvas bind:this={cvsTree}></canvas></div>
    <div id="area-ruler" bind:this={areaRuler} onmousedown={handleRulerMouseDown}><canvas bind:this={cvsRuler}></canvas></div>
    <div id="area-names" bind:this={areaNames} onmousedown={handleNamesMouseDown} oncontextmenu={(e) => {
        e.preventDefault();
        import('./interactions.js').then(mod => {
            const { r } = mod.getCoords(e, 'NAMES', areaSeq, areaNames, areaRuler);
            if (r >= 0 && r < data.viewSequences.length) {
                ui.ctxTargetRow = r;
                ctxMenu.style.display = 'block';
                ctxMenu.style.left = e.clientX + 'px';
                ctxMenu.style.top = e.clientY + 'px';
            }
        });
    }}>
        <canvas bind:this={cvsNames}></canvas>
    </div>
    <div id="area-seq" bind:this={areaSeq} tabindex="0" onscroll={handleScroll} onmousedown={handleSeqMouseDown} onkeydown={handleKeyDown}>
        <div id="scroll-sizer" bind:this={sizer}></div>
        <canvas bind:this={cvsSeq}></canvas>
    </div>
</div>

<!-- Context Menu -->
<div id="ctx-menu" bind:this={ctxMenu}>
    <div class="item" onclick={handleCtxRef}>Set as Reference</div>
</div>

<style>
    #viewer-grid {
        flex: 1; display: grid;
        grid-template-columns: var(--tree-width) 5px var(--names-width, 200px) minmax(0, 1fr);
        grid-template-rows: var(--ruler-height, 60px) minmax(0, 1fr);
        grid-template-areas:
            "corner-tree resizer corner-names ruler"
            "tree        resizer names        seq";
        overflow: hidden; position: relative;
        background: #fff;
    }

    #area-corner-tree { grid-area: corner-tree; background: #f3f4f6; border-bottom: 1px solid var(--border-color, #d1d5db); }
    #area-corner-names { grid-area: corner-names; background: #f3f4f6; border-right: 1px solid var(--border-color, #d1d5db); border-bottom: 1px solid var(--border-color, #d1d5db); }

    #area-ruler {
        grid-area: ruler; background: #f3f4f6;
        border-bottom: 1px solid var(--border-color, #d1d5db);
        position: relative; overflow: hidden; cursor: s-resize;
    }

    #area-tree {
        grid-area: tree; background: #fff;
        position: relative; overflow: hidden;
        border-right: 1px solid #e5e7eb;
    }

    #resizer-tree {
        grid-area: resizer; background: #f3f4f6;
        border-right: 1px solid var(--border-color, #d1d5db);
        cursor: col-resize; z-index: 15;
        display: flex; align-items: center; justify-content: center;
    }
    #resizer-tree:hover { background: #d1d5db; }
    #resizer-tree span { width: 1px; height: 20px; background: #9ca3af; display: block; }

    #area-names {
        grid-area: names; background: #fff;
        border-right: 1px solid var(--border-color, #d1d5db);
        position: relative; overflow: hidden; z-index: 5;
        box-shadow: 2px 0 5px rgba(0,0,0,0.05); cursor: e-resize;
    }

    #area-seq {
        grid-area: seq; overflow: auto; position: relative;
        background: #fff; outline: none; cursor: text;
    }
    #area-seq :global(.grabbing) { cursor: grabbing; }

    canvas { display: block; }
    #scroll-sizer { position: absolute; top: 0; left: 0; width: 1px; height: 1px; z-index: -1; }

    #ctx-menu {
        position: fixed;
        background: white;
        border: 1px solid #d1d5db;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        border-radius: 4px;
        padding: 4px 0;
        z-index: 10000;
        display: none;
        min-width: 150px;
    }
    #ctx-menu .item {
        padding: 8px 12px;
        font-size: 13px;
        cursor: pointer;
        color: #374151;
    }
    #ctx-menu .item:hover { background-color: #f3f4f6; color: var(--primary, #2563eb); }
</style>
