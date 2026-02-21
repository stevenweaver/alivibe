<script lang="ts">
    import { ui, data, undo, recalc } from './state.svelte.js';
    import { setMode, stripGapsGlobal, clearAlignment, clearTreeOnly } from './state-ops.js';
    import { loadFile, loadTreeFile, exportAlignment, getClipboardContent } from './io.js';
    import { runAlignmentTask, realignSelection, runFrameCleanTask, setAlignModeGetter } from './alignment.js';
    import { inferTreeNJ, runFastTreeTask, exportTree, ladderizeTree } from './tree.js';
    import { computeTreeLayout } from './tree.js';

    let selAlignMode: HTMLSelectElement;
    let btnCopy: HTMLButtonElement;

    // Wire up the align mode getter
    $effect(() => {
        if (selAlignMode) {
            setAlignModeGetter(() => selAlignMode.value);
        }
    });

    // Clean frame overlay state
    let cleanRefMode = $state('hard');
    let cleanPBackbone = $state(0.9);
    let cleanPInsertion = $state(0.05);
    let cleanStartPenalty = $state(-2.0);
    let cleanExtendPenalty = $state(-0.2);

    // Infer tree overlay state
    let inferMethod = $state('nj');
    let ftNtModel = $state('-gtr');
    let ftAaModel = $state('-lg');
    let ftSpeed = $state('');

    function handleFileChange(e: Event) {
        const input = e.target as HTMLInputElement;
        if (input.files && input.files[0]) loadFile(input.files[0]);
    }

    function handleTreeFileChange(e: Event) {
        const input = e.target as HTMLInputElement;
        if (input.files && input.files[0]) loadTreeFile(input.files[0]);
    }

    function handleCopyButton() {
        const content = getClipboardContent(true);
        if (!content) return;
        if (!navigator.clipboard || !navigator.clipboard.writeText) return;
        const originalText = btnCopy.textContent;
        navigator.clipboard.writeText(content).then(() => {
            btnCopy.textContent = "Copied!";
            setTimeout(() => btnCopy.textContent = originalText, 1500);
        }).catch(err => {
            console.error("Copy failed:", err);
            btnCopy.textContent = originalText;
        });
    }

    function handleSetMode(m: 'NT' | 'AA') {
        setMode(m);
        computeTreeLayout();
    }

    function handleHighlight() {
        ui.highlightMatches = !ui.highlightMatches;
    }

    function handleFrameChange(e: Event) {
        ui.frame = +(e.target as HTMLSelectElement).value;
        recalc();
        computeTreeLayout();
    }

    function showCleanModal() {
        if (!data.rawSequences.length) return;
        ui.cleanOverlayVisible = true;
    }

    function runClean() {
        ui.cleanOverlayVisible = false;
        runFrameCleanTask(cleanRefMode, cleanPBackbone, cleanPInsertion, cleanStartPenalty, cleanExtendPenalty);
    }

    function showInferModal() {
        if (!data.rawSequences || data.rawSequences.length < 2) return;
        ui.inferOverlayVisible = true;
    }

    function runInfer() {
        ui.inferOverlayVisible = false;
        if (inferMethod === 'nj') {
            inferTreeNJ();
        } else {
            runFastTreeTask(ui.mode === 'AA', ftNtModel, ftAaModel, ftSpeed);
        }
    }

    function handleUndo() {
        undo();
        computeTreeLayout();
    }

    function handleClearAlignment() {
        if (!data.rawSequences.length) return;
        if (!confirm("Clear all sequences and the current tree?")) return;
        clearAlignment();
    }
</script>

<div id="controls">
    <div class="control-group">
        <label>Sequences</label>
        <input type="file" accept=".fasta,.fa,.fastq,.fq,.txt" onchange={handleFileChange}>
    </div>
    <div class="control-group">
        <label>Phylogeny</label>
        <div style="display:flex; gap:5px; align-items:center;">
            <button onclick={showInferModal} title="Infer NJ tree from sequences">Infer</button>
            <input type="file" onchange={handleTreeFileChange}>
            <button onclick={() => exportTree()} title="Export current tree as Newick">Export</button>
            <button onclick={() => ladderizeTree()} title="Ladderize tree and reorder sequences">Ladderize</button>
        </div>
    </div>
    <div class="control-group">
        <label>Reset</label>
        <div style="display:flex; gap:5px;">
            <button onclick={handleClearAlignment} title="Remove all sequences">Clear Alignment</button>
            <button onclick={() => clearTreeOnly()} title="Remove current tree">Clear Tree</button>
        </div>
    </div>
    <div class="separator"></div>
    <div class="control-group">
        <label>History</label>
        <button onclick={handleUndo} title="Ctrl+Z" disabled={ui.historyLength === 0} style:opacity={ui.historyLength === 0 ? '0.5' : '1'}>⟲ Undo</button>
    </div>

    <div class="separator"></div>
    <div class="control-group">
        <label>Export</label>
        <div style="display:flex; gap:5px;">
            <button onclick={() => exportAlignment('download')} title="Download Current View">Download</button>
            <button bind:this={btnCopy} onclick={handleCopyButton} title="Copy to Clipboard">Copy</button>
        </div>
    </div>

    <div class="separator"></div>
    <div class="control-group">
        <label>View Mode</label>
        <div style="display:flex;">
            <button class:active={ui.mode === 'NT'} onclick={() => handleSetMode('NT')} style="border-top-right-radius:0; border-bottom-right-radius:0;">NT</button>
            <button class:active={ui.mode === 'AA'} onclick={() => handleSetMode('AA')} style="border-top-left-radius:0; border-bottom-left-radius:0; border-left:none;">AA</button>
        </div>
    </div>

    <div class="control-group">
        <label>Highlighter</label>
        <button class:active={ui.highlightMatches} onclick={handleHighlight}>Highlighter</button>
    </div>

    <div class="control-group">
        <label>Alignment</label>
        <div style="display:flex; gap:5px;">
            <button onclick={() => runAlignmentTask()}>Align</button>
            <select bind:this={selAlignMode}>
                <option value="msa">MSA</option>
                <option value="kalign">Kalign</option>
                <option value="polish">Polish</option>
                <option value="left">Left Pile</option>
                <option value="discard">Discard Ins</option>
            </select>
            <button onclick={() => realignSelection()} title="Realign within selection">Align Sel</button>
            <button onclick={() => stripGapsGlobal()} title="Strip all gaps from alignment">Strip Gaps</button>
            <button onclick={showCleanModal} title="Clean out-of-frame insertions">Clean Frame</button>
        </div>
    </div>

    <div class="separator"></div>

    <div class="control-group" style:opacity={ui.mode === 'AA' ? '1' : '0.4'} style:pointer-events={ui.mode === 'AA' ? 'auto' : 'none'}>
        <label>Frame</label>
        <select value={String(ui.frame)} onchange={handleFrameChange}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
        </select>
    </div>

    <div class="control-group">
        <label>Info</label>
        <button class="btn-icon" onclick={() => ui.helpVisible = true}>?</button>
    </div>
</div>

<style>
    #controls {
        height: var(--header-height, 90px);
        background: var(--panel-bg, #ffffff);
        border-bottom: 1px solid var(--border-color, #d1d5db);
        display: flex; align-items: center;
        padding: 0 20px; gap: 15px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        flex-shrink: 0; z-index: 20;
        overflow-x: auto;
    }

    .control-group { display: flex; flex-direction: column; gap: 4px; }
    label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6b7280; }
    button, select, input[type="file"] {
        padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px;
        background: white; font-size: 13px; cursor: pointer;
        white-space: nowrap;
    }
    button:hover { background-color: #f3f4f6; }
    button.active { background-color: var(--primary, #2563eb); color: white; border-color: var(--primary, #2563eb); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-icon { padding: 6px 8px; font-weight: bold; }
    .separator { width: 1px; height: 30px; background: #e5e7eb; margin: 0 10px; }
</style>
