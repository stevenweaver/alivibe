<script lang="ts">
    import { AliVibe } from '$lib/alivibe';
</script>

<svelte:head>
    <title>AliVibe - Alignment Viewer</title>
</svelte:head>

<AliVibe fastaUrl="/demo.fasta" treeUrl="/demo.tre" height="100vh" />

<style>
    :global(body, html) {
        margin: 0;
        padding: 0;
        height: 100%;
        width: 100%;
        overflow: hidden;
    }
</style>
