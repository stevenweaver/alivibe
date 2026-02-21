import { data, ui, saveState, recalc, type TreeNode } from './state.svelte.js';
import { PhyloTools } from './libs/phylotools.js';
import { CONFIG } from './config.js';

export function parseTree(newick: string, isIndexed = false) {
    if (!data.rawSequences.length) {
        ui.overlayActive = false;
        return;
    }

    saveState();

    let lines = newick.trim().split(/\r?\n/);
    let s = lines[lines.length - 1].trim();
    if (s.endsWith(';')) s = s.slice(0, -1);

    // Remove Newick comments
    s = s.replace(/\[[^\]]*\]/g, '');

    const tokens = s.split(/([(),:;])/).map(t => t.trim()).filter(t => t !== '');

    let stack: TreeNode[] = [];
    let root: TreeNode = { children: [], name: null, len: 0 };
    let current: TreeNode = root;

    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t === '(') {
            const node: TreeNode = { children: [], name: null, len: 0, parent: current };
            current.children.push(node);
            stack.push(current);
            current = node;
        } else if (t === ',') {
            if (stack.length > 0) {
                current = stack[stack.length - 1];
            } else {
                current = root;
            }
            const node: TreeNode = { children: [], name: null, len: 0, parent: current };
            current.children.push(node);
            current = node;
        } else if (t === ')') {
            if (stack.length > 0) {
                current = stack.pop()!;
            } else {
                current = root;
            }
        } else if (t === ':') {
            i++;
            const lenStr = tokens[i];
            const val = parseFloat(lenStr);
            if (current && !isNaN(val)) current.len = val;
        } else {
            if (!current) continue;
            let name = t.replace(/^['"]|['"]$/g, '');
            if (isIndexed && ui.tempNameMap) {
                const idx = parseInt(name);
                if (!isNaN(idx) && idx >= 0 && idx < ui.tempNameMap.length) {
                    name = ui.tempNameMap[idx];
                }
            }
            current.name = name;
        }
    }
    ui.tempNameMap = null;

    if (root.children.length === 1 && !root.name) {
        root = root.children[0];
        delete root.parent;
    }

    applyTreeOrder(root);

    let totalLen = 0;
    function checkLen(n: TreeNode) { totalLen += (n.len || 0); n.children.forEach(checkLen); }
    checkLen(root);

    const useCladogram = (totalLen === 0);
    let maxDepth = 0;

    function layoutX(node: TreeNode, currentDepth: number) {
        const dist = useCladogram ? (node === root ? 0 : 1) : (node.len || 0);
        node.xDepth = currentDepth + dist;
        if (node.xDepth! > maxDepth) maxDepth = node.xDepth!;
        node.children.forEach(c => layoutX(c, node.xDepth!));
    }

    root.len = 0;
    layoutX(root, 0);

    ui.tree = { root, maxDepth };
    ui.treeWidth = 200;
    recalc();
    ui.overlayActive = false;
}

function applyTreeOrder(root: TreeNode) {
    const leafOrder: string[] = [];
    function traverse(node: TreeNode) {
        if (!node.children || node.children.length === 0) {
            if (node.name) leafOrder.push(node.name);
        } else {
            node.children.forEach(traverse);
        }
    }
    traverse(root);

    const seqMap = new Map<string, typeof data.rawSequences[0]>();
    data.rawSequences.forEach(s => seqMap.set(s.name, s));

    const oldRefName = data.rawSequences[ui.refIndex]?.name;
    const newSeqList: typeof data.rawSequences = [];
    leafOrder.forEach(name => {
        if (seqMap.has(name)) {
            newSeqList.push(seqMap.get(name)!);
            seqMap.delete(name);
        }
    });
    for (const s of seqMap.values()) newSeqList.push(s);
    data.rawSequences = newSeqList;

    if (oldRefName) {
        const newIdx = data.rawSequences.findIndex(s => s.name === oldRefName);
        ui.refIndex = (newIdx !== -1) ? newIdx : 0;
    } else {
        ui.refIndex = 0;
    }
}

export function treeToNewick(node: TreeNode): string {
    if (!node.children || node.children.length === 0) {
        const name = node.name || '';
        const len = (node.len !== undefined && node.len !== 0) ? `:${node.len.toFixed(5)}` : '';
        return name + len;
    } else {
        const childStrs = node.children.map(c => treeToNewick(c));
        const name = node.name || '';
        const len = (node.len !== undefined && node.len !== 0) ? `:${node.len.toFixed(5)}` : '';
        return `(${childStrs.join(',')})${name}${len}`;
    }
}

export function inferTreeNJ() {
    ui.overlayActive = true;
    ui.overlayMsg = "Inferring phylogeny...";
    ui.overlaySub = "Calculating distances and building NJ tree";

    setTimeout(() => {
        try {
            const labels = data.rawSequences.map(s => s.name);
            const seqs = data.rawSequences.map(s => s.seq.join(''));
            const newick = PhyloTools.generatePhylogeny(seqs, labels);
            parseTree(newick);
        } catch (err: any) {
            console.error("Error inferring tree:", err);
            ui.overlayActive = false;
        }
    }, 50);
}

export async function runFastTreeTask(isAA: boolean, ntModel: string, aaModel: string, speed: string) {
    if (!ui.aioliCLI) {
        ui.overlayActive = false;
        return;
    }

    ui.overlayActive = true;
    ui.overlayMsg = "Inferring phylogeny with FastTree...";
    ui.overlaySub = "via bioWASM";

    try {
        const fastaInput = data.rawSequences.map((s, idx) => {
            return `>${idx}\n${s.seq.join('')}`;
        }).join('\n');

        await ui.aioliCLI.mount({
            name: "input_tree.fa",
            data: fastaInput
        });

        let flags = isAA ? "" : "-nt";
        if (isAA) {
            flags += " " + aaModel;
        } else {
            flags += " " + ntModel;
        }
        flags += " " + speed;

        const command = `fasttree ${flags.trim()} input_tree.fa`;
        const newick = await ui.aioliCLI.exec(command);

        if (newick && newick.includes('(')) {
            ui.tempNameMap = data.rawSequences.map(s => s.name);
            parseTree(newick, true);
        } else {
            throw new Error("Invalid Newick output from FastTree.");
        }
    } catch (err: any) {
        console.error("FastTree error:", err);
        ui.overlayActive = false;
    }
}

export function ladderizeTree() {
    if (!ui.tree || !ui.tree.root) return;

    saveState();

    function countLeaves(node: TreeNode): number {
        if (!node.children || node.children.length === 0) {
            node.leafCount = 1;
            return 1;
        }
        let count = 0;
        for (const child of node.children) {
            count += countLeaves(child);
        }
        node.leafCount = count;
        return count;
    }

    function sortChildren(node: TreeNode) {
        if (!node.children || node.children.length <= 1) return;
        node.children.sort((a, b) => (a.leafCount || 0) - (b.leafCount || 0));
        for (const child of node.children) {
            sortChildren(child);
        }
    }

    countLeaves(ui.tree.root);
    sortChildren(ui.tree.root);

    applyTreeOrder(ui.tree.root);
    recalc();
}

export function exportTree() {
    if (!ui.tree || !ui.tree.root) return;

    const newick = treeToNewick(ui.tree.root) + ';';
    const blob = new Blob([newick], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tree.nwk";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/** Recompute tree Y positions after recalc */
export function computeTreeLayout() {
    if (!ui.tree) return;

    const nameToRow = new Map<string, number>();
    data.viewSequences.forEach((s, i) => nameToRow.set(s.name, i));

    function computeY(node: TreeNode) {
        if (!node.children || node.children.length === 0) {
            if (node.name && nameToRow.has(node.name)) {
                node.yRow = nameToRow.get(node.name)!;
                node.hidden = false;
            } else {
                node.yRow = 0;
                node.hidden = true;
            }
        } else {
            let sumY = 0, count = 0;
            let minC = Infinity, maxC = -Infinity;
            let allHidden = true;

            node.children.forEach(c => {
                computeY(c);
                if (!c.hidden) {
                    sumY += c.yRow!;
                    if (c.yRow! < minC) minC = c.yRow!;
                    if (c.yRow! > maxC) maxC = c.yRow!;
                    count++;
                    allHidden = false;
                }
            });
            node.hidden = allHidden;
            node.yRow = count ? (minC + maxC) / 2 : 0;
        }
    }
    computeY(ui.tree.root);
}
