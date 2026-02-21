# AliVibe

An interactive sequence alignment viewer and editor built as a Svelte 5 component library. AliVibe provides canvas-based rendering of nucleotide and amino acid alignments with phylogenetic tree visualization, real-time editing, and multiple sequence alignment tools.

## Features

- **Canvas-based rendering** of nucleotide (NT) and amino acid (AA) sequences with IUPAC color coding
- **Phylogenetic tree panel** with Newick import/export, neighbor-joining inference, and ladderization
- **Alignment tools** — built-in MSA (POA + Needleman-Wunsch), Kalign via bioWASM, polish mode, and left-pile
- **Interactive editing** — select, insert gaps, delete, overwrite, drag-move blocks
- **Reading frame support** — 3-frame translation with FrameClean for cleaning out-of-frame insertions
- **Reference-anchored view** with per-column match highlighting
- **Undo history** with Ctrl+Z
- **Export** — download or copy alignments as FASTA

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` to see the demo with included example data.

## Usage

Import the component into any SvelteKit page:

```svelte
<script>
  import { AliVibe } from '$lib/alivibe';
</script>

<AliVibe fastaUrl="/sequences.fasta" treeUrl="/tree.tre" height="100vh" />
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `fastaUrl` | `string` | — | URL to a FASTA file to load on mount |
| `treeUrl` | `string` | — | URL to a Newick tree file to load on mount |
| `height` | `string` | `"100vh"` | CSS height of the component |

### Programmatic API

Bind the component to access methods directly:

```svelte
<script>
  import { AliVibe } from '$lib/alivibe';
  let viewer;

  function load() {
    viewer.loadFasta(">seq1\nATCG\n>seq2\nATCG");
  }
</script>

<AliVibe bind:this={viewer} />
```

- `loadFasta(text: string)` — parse and display a FASTA string
- `getAlignment()` — returns `{ name: string, seq: string }[]`

## Architecture

```
src/lib/alivibe/
├── AliVibe.svelte          # Main wrapper component
├── AlignmentCanvas.svelte  # 4-canvas grid (sequences, names, ruler, tree)
├── ControlBar.svelte       # Toolbar controls
├── Overlays.svelte         # Modal dialogs (help, clean frame, infer tree)
├── state.svelte.ts         # Reactive UI state ($state runes) + data store
├── config.ts               # Colors, fonts, codon table
├── render.ts               # Canvas draw logic
├── interactions.ts         # Mouse/keyboard handlers
├── alignment.ts            # MSA, Kalign, realign, frame clean
├── tree.ts                 # Newick parsing, NJ inference, layout
├── io.ts                   # FASTA/FASTQ parsing, file I/O, clipboard
├── state-ops.ts            # Gap insertion, deletion, block moves
└── libs/
    ├── nw.ts               # Needleman-Wunsch (affine, k-mer seeded, POA)
    ├── phylotools.ts       # JC69 distance + neighbor-joining
    └── frameclean.ts       # HMM-based reading frame correction
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Click | Select cell |
| Shift+Click | Extend selection |
| A-Z | Overwrite selected cell |
| Space | Insert gap |
| Backspace | Delete |
| Ctrl+Z | Undo |
| Right-click name | Set as reference |

## External Dependencies

AliVibe optionally loads [Aioli/bioWASM](https://biowasm.com) at runtime for:

- **Kalign 3.3.1** — fast multiple sequence alignment
- **FastTree 2.1.11** — maximum-likelihood tree inference

These load from the bioWASM CDN and require no local installation.

## License

MIT
