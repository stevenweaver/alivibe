<script lang="ts">
    import { onMount } from 'svelte';
    import { ui, data, undo, recalc } from './state.svelte.js';
    import { loadFromURL } from './io.js';
    import ControlBar from './ControlBar.svelte';
    import AlignmentCanvas from './AlignmentCanvas.svelte';
    import Overlays from './Overlays.svelte';
    import { computeTreeLayout } from './tree.js';
    import { parseFasta } from './io.js';

    interface Props {
        fastaUrl?: string;
        treeUrl?: string;
        height?: string;
    }

    let { fastaUrl, treeUrl, height = '100vh' }: Props = $props();

    let canvasComponent: AlignmentCanvas;

    // Expose methods for programmatic use
    export function loadFasta(text: string) {
        parseFasta(text);
        computeTreeLayout();
    }

    export function getAlignment(): { name: string; seq: string }[] {
        return data.viewSequences.map(s => ({
            name: s.name,
            seq: s.seq.join('')
        }));
    }

    onMount(async () => {
        // Initialize Aioli for bioWASM
        try {
            const Aioli = (window as any).Aioli;
            if (Aioli) {
                ui.aioliCLI = await new Aioli(["kalign/3.3.1", "fasttree/2.1.11"]);
            }
        } catch (err) {
            console.error("Failed to initialize Aioli:", err);
        }

        // Load from props
        if (fastaUrl) {
            loadFromURL(fastaUrl, treeUrl);
        }

        // Global keyboard shortcut
        function handleGlobalKeyDown(e: KeyboardEvent) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                undo();
                computeTreeLayout();
            }
        }
        window.addEventListener('keydown', handleGlobalKeyDown);

        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
        };
    });
</script>

<svelte:head>
    <script src="https://biowasm.com/cdn/v3/aioli.js"></script>
</svelte:head>

<div id="alivibe-app" style="height: {height}">
    <ControlBar />
    <AlignmentCanvas bind:this={canvasComponent} />
    <Overlays />
</div>

<style>
    :global(:root) {
        --bg-color: #f8f9fa;
        --panel-bg: #ffffff;
        --border-color: #d1d5db;
        --primary: #2563eb;
        --header-height: 90px;
        --ruler-height: 60px;
        --names-width: 200px;
    }

    :global(*) { box-sizing: border-box; }

    #alivibe-app {
        display: flex; flex-direction: column;
        width: 100%; height: 100%;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        background-color: var(--bg-color);
        overflow: hidden;
        user-select: none;
        overscroll-behavior-x: none;
    }
</style>
