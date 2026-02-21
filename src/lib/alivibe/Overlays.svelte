<script lang="ts">
    import { ui, data } from './state.svelte.js';
    import { runFrameCleanTask } from './alignment.js';
    import { inferTreeNJ, runFastTreeTask } from './tree.js';

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

    function runClean() {
        ui.cleanOverlayVisible = false;
        runFrameCleanTask(cleanRefMode, cleanPBackbone, cleanPInsertion, cleanStartPenalty, cleanExtendPenalty);
    }

    function runInfer() {
        ui.inferOverlayVisible = false;
        if (inferMethod === 'nj') {
            inferTreeNJ();
        } else {
            runFastTreeTask(ui.mode === 'AA', ftNtModel, ftAaModel, ftSpeed);
        }
    }

    let refName = $derived(
        data.rawSequences[ui.refIndex] ? data.rawSequences[ui.refIndex].name : "None"
    );
</script>

<!-- Loading Spinner Overlay -->
{#if ui.overlayActive}
<div class="overlay active">
    <div class="spinner"></div>
    <div class="overlay-msg">{ui.overlayMsg}</div>
    {#if ui.overlaySub}
    <div class="overlay-sub">{ui.overlaySub}</div>
    {/if}
</div>
{/if}

<!-- Help Overlay -->
{#if ui.helpVisible}
<div class="help-overlay active" onclick={() => ui.helpVisible = false}>
    <div class="help-box" onclick={(e) => e.stopPropagation()}>
        <h2>FastAlign Help</h2>
        <div class="help-row"><span class="help-key">Selection</span> <span>Click to select. Shift+Click to extend selection.</span></div>
        <div class="help-row"><span class="help-key">Editing</span> <span>Type [A-Z] to overwrite. Space to insert gap. Backspace to delete.</span></div>
        <div class="help-row"><span class="help-key">Align Selection</span> <span>Aligns rows inside selection box. Uses Ref if selected, else longest seq.</span></div>
        <div class="help-row"><span class="help-key">Set Reference</span> <span>Right-click a sequence name.</span></div>
        <div class="help-row"><span class="help-key">Move Block</span> <span>Drag selection horizontally to shift sequences.</span></div>
        <div class="help-row"><span class="help-key">Align</span> <span>Aligns all sequences. Supports Left, Polish, or Discard insertions modes.</span></div>
        <div class="help-row"><span class="help-key">IUPAC</span> <span>Full IUPAC ambiguity codes supported in Nucleotide view.</span></div>
        <div class="help-row"><span class="help-key">Export</span> <span>Download or Copy current view (NT or AA) as FASTA.</span></div>
        <button class="close-help" onclick={() => ui.helpVisible = false}>Close</button>
    </div>
</div>
{/if}

<!-- Clean Frame Overlay -->
{#if ui.cleanOverlayVisible}
<div class="modal-overlay" onclick={() => ui.cleanOverlayVisible = false}>
    <div class="help-box" style="width: 450px;" onclick={(e) => e.stopPropagation()}>
        <h2>Clean Reading Frame</h2>
        <div class="help-row" style="flex-direction: column; align-items: flex-start; gap: 5px;">
            <label style="text-transform: none; font-size: 13px; color: #374151;">Reference Mode</label>
            <select bind:value={cleanRefMode} style="width: 100%;">
                <option value="no">No reference (occupancy only)</option>
                <option value="hard">Trusted Reference (Hard: mod 3)</option>
                <option value="soft">Trusted Reference (Soft: penalized)</option>
            </select>
        </div>
        <div class="help-row">
            <span style="font-size: 13px; color: #374151;">Using current reference:</span>
            <span style="font-style: italic; font-size: 13px; color: #2563eb;">{refName}</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
            <div class="control-group">
                <label>pBackbone</label>
                <input type="number" bind:value={cleanPBackbone} step="0.05" min="0" max="1">
            </div>
            <div class="control-group">
                <label>pInsertion</label>
                <input type="number" bind:value={cleanPInsertion} step="0.01" min="0" max="1">
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="control-group">
                <label>Start Penalty</label>
                <input type="number" bind:value={cleanStartPenalty} step="0.1">
            </div>
            <div class="control-group">
                <label>Extend Penalty</label>
                <input type="number" bind:value={cleanExtendPenalty} step="0.1">
            </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
            <button onclick={() => ui.cleanOverlayVisible = false}>Cancel</button>
            <button class="active" onclick={runClean}>Clean Alignment</button>
        </div>
    </div>
</div>
{/if}

<!-- Infer Tree Overlay -->
{#if ui.inferOverlayVisible}
<div class="modal-overlay" onclick={() => ui.inferOverlayVisible = false}>
    <div class="help-box" style="width: 450px;" onclick={(e) => e.stopPropagation()}>
        <h2>Infer Phylogeny</h2>
        <div class="help-row" style="flex-direction: column; align-items: flex-start; gap: 5px;">
            <label style="text-transform: none; font-size: 13px; color: #374151;">Method</label>
            <select bind:value={inferMethod} style="width: 100%;">
                <option value="nj">Neighbor-Joining (Internal)</option>
                <option value="fasttree">FastTree (bioWASM)</option>
            </select>
        </div>

        {#if inferMethod === 'fasttree'}
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;">
            <div class="help-row">
                <span style="font-size: 13px; color: #374151;">Model (NT):</span>
                <select bind:value={ftNtModel}>
                    <option value="-gtr">-gtr (GTR+CAT)</option>
                    <option value="">Default (Jukes-Cantor)</option>
                </select>
            </div>
            <div class="help-row">
                <span style="font-size: 13px; color: #374151;">Model (AA):</span>
                <select bind:value={ftAaModel}>
                    <option value="-lg">-lg (Le-Gascuel)</option>
                    <option value="-wag">-wag (Whelan-And-Goldman)</option>
                    <option value="">Default (JTT)</option>
                </select>
            </div>
            <div class="help-row">
                <span style="font-size: 13px; color: #374151;">Speed:</span>
                <select bind:value={ftSpeed}>
                    <option value="">Default</option>
                    <option value="-fastest">-fastest</option>
                </select>
            </div>
        </div>
        {/if}

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
            <button onclick={() => ui.inferOverlayVisible = false}>Cancel</button>
            <button class="active" onclick={runInfer}>Run Inference</button>
        </div>
    </div>
</div>
{/if}

<style>
    .overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(255,255,255,0.75);
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        z-index: 9999;
    }
    .overlay.active { opacity: 1; pointer-events: all; }

    .overlay-msg { margin-top: 10px; font-weight: 500; }
    .overlay-sub { margin-top: 5px; font-size: 12px; color: #666; }

    .spinner {
        width: 30px; height: 30px;
        border: 3px solid #e5e7eb; border-top: 3px solid var(--primary, #2563eb);
        border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    .help-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        z-index: 9999;
    }
    .help-overlay.active { opacity: 1; pointer-events: all; }

    .modal-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center;
        z-index: 10000;
    }

    .help-box {
        background: white; width: 600px; max-width: 90%;
        padding: 20px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        display: flex; flex-direction: column; gap: 10px;
    }
    .help-box h2 { margin: 0 0 10px 0; font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
    .help-row { display: flex; justify-content: space-between; font-size: 13px; color: #374151; padding: 4px 0; border-bottom: 1px solid #f3f4f6; }
    .help-key { font-weight: bold; color: #111; }
    .close-help { align-self: flex-end; margin-top: 10px; }

    .control-group { display: flex; flex-direction: column; gap: 4px; }
    label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6b7280; }
    button, select, input[type="number"] {
        padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px;
        background: white; font-size: 13px; cursor: pointer;
    }
    button:hover { background-color: #f3f4f6; }
    button.active { background-color: var(--primary, #2563eb); color: white; border-color: var(--primary, #2563eb); }
</style>
