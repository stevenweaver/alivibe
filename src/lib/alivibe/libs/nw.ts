/**
 * Needleman-Wunsch Alignment Library
 * Converted to ES module from nw.js
 */

function findMax(arr: number[]): [number, number] {
    let maxVal = arr[0];
    let maxIndex = 1;
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] > maxVal) {
            maxVal = arr[i];
            maxIndex = i + 1;
        }
    }
    return [maxVal, maxIndex];
}

export function affineNWAlign(s1: string, s2: string, gapOpen = -10.0, gapExtend = -0.2, matchCost = 1.0, mismatchCost = -0.7, boundaryGapFactor = 10): [string, string] {
    const s1arr = s1.split('');
    const s1len = s1arr.length;
    const s2arr = s2.split('');
    const s2len = s2arr.length;
    const M = Array(s1len + 1).fill(null).map(() => Array(s2len + 1).fill(0));
    const IX = Array(s1len + 1).fill(null).map(() => Array(s2len + 1).fill(0));
    const IY = Array(s1len + 1).fill(null).map(() => Array(s2len + 1).fill(0));
    for (let i = 0; i <= s1len; i++) {
        IX[i][0] = gapOpen + gapExtend * i;
        IY[i][0] = -Infinity;
        M[i][0] = gapOpen + gapExtend * i;
    }
    for (let j = 0; j <= s2len; j++) {
        IX[0][j] = -Infinity;
        IY[0][j] = gapOpen + gapExtend * j;
        M[0][j] = gapOpen + gapExtend * j;
    }
    const traceM = Array(s1len + 1).fill(null).map(() => Array(s2len + 1).fill(0));
    const traceIX = Array(s1len + 1).fill(null).map(() => Array(s2len + 1).fill(0));
    const traceIY = Array(s1len + 1).fill(null).map(() => Array(s2len + 1).fill(0));
    traceM[0].fill(3);
    traceIX[0].fill(3);
    traceIY[0].fill(3);
    for (let i = 1; i <= s1len; i++) {
        traceM[i][0] = 2;
        traceIX[i][0] = 2;
        traceIY[i][0] = 2;
    }
    for (let i = 1; i <= s1len; i++) {
        for (let j = 1; j <= s2len; j++) {
            const diagCost = s1arr[i - 1] === s2arr[j - 1] ? matchCost : mismatchCost;
            const diagM = M[i - 1][j - 1] + diagCost;
            const IX2M = IX[i - 1][j - 1] + diagCost;
            const IY2M = IY[i - 1][j - 1] + diagCost;
            [M[i][j], traceM[i][j]] = findMax([diagM, IX2M, IY2M]);

            const boundaryGapExtendX = (i === s1len) ? gapExtend / boundaryGapFactor : gapExtend;
            const boundaryGapExtendY = (j === s2len) ? gapExtend / boundaryGapFactor : gapExtend;

            const M2IX = M[i - 1][j] + gapOpen;
            const IXextend = IX[i - 1][j] + boundaryGapExtendY;
            [IX[i][j], traceIX[i][j]] = findMax([M2IX, IXextend]);

            const M2IY = M[i][j - 1] + gapOpen;
            const IYextend = IY[i][j - 1] + boundaryGapExtendX;
            [IY[i][j], traceIY[i][j]] = findMax([M2IY, -Infinity, IYextend]);
        }
    }
    const revArr1: string[] = [];
    const revArr2: string[] = [];
    const mats = [traceM, traceIX, traceIY];
    let xI = s1len;
    let yI = s2len;
    let mI = findMax([M[xI][yI], IX[xI][yI], IY[xI][yI]])[1];
    while (xI > 0 && yI > 0) {
        const nextMI = mats[mI - 1][xI][yI];
        if (mI === 1) {
            revArr1.push(s1arr[xI - 1]);
            revArr2.push(s2arr[yI - 1]);
            xI--;
            yI--;
        } else if (mI === 2) {
            revArr1.push(s1arr[xI - 1]);
            revArr2.push('-');
            xI--;
        } else if (mI === 3) {
            revArr1.push('-');
            revArr2.push(s2arr[yI - 1]);
            yI--;
        }
        mI = nextMI;
    }
    while (xI > 0) {
        revArr1.push(s1arr[xI - 1]);
        revArr2.push('-');
        xI--;
    }
    while (yI > 0) {
        revArr1.push('-');
        revArr2.push(s2arr[yI - 1]);
        yI--;
    }
    return [revArr1.reverse().join(''), revArr2.reverse().join('')];
}

function constrainedNWAlign(s1: string, s2: string, gapOpen: number, gapExtend: number, matchCost: number, mismatchCost: number, boundaryGapFactor: number, isStart: boolean, isEnd: boolean): [string, string] {
    const s1arr = s1.split('');
    const s1len = s1arr.length;
    const s2arr = s2.split('');
    const s2len = s2arr.length;

    const useBoundaryFactor = isEnd ? boundaryGapFactor : 1;

    const M = Array(s1len + 1).fill(null).map(() => Array(s2len + 1).fill(0));
    const IX = Array(s1len + 1).fill(null).map(() => Array(s2len + 1).fill(0));
    const IY = Array(s1len + 1).fill(null).map(() => Array(s2len + 1).fill(0));

    M[0][0] = 0;
    IX[0][0] = -Infinity;
    IY[0][0] = -Infinity;

    for (let i = 1; i <= s1len; i++) {
        IX[i][0] = gapOpen + gapExtend * i;
        IY[i][0] = -Infinity;
        M[i][0] = gapOpen + gapExtend * i;
    }
    for (let j = 1; j <= s2len; j++) {
        IX[0][j] = -Infinity;
        IY[0][j] = gapOpen + gapExtend * j;
        M[0][j] = gapOpen + gapExtend * j;
    }

    const traceM = Array(s1len + 1).fill(null).map(() => Array(s2len + 1).fill(0));
    const traceIX = Array(s1len + 1).fill(null).map(() => Array(s2len + 1).fill(0));
    const traceIY = Array(s1len + 1).fill(null).map(() => Array(s2len + 1).fill(0));

    traceM[0].fill(3);
    traceIX[0].fill(3);
    traceIY[0].fill(3);
    for (let i = 1; i <= s1len; i++) {
        traceM[i][0] = 2;
        traceIX[i][0] = 2;
        traceIY[i][0] = 2;
    }

    for (let i = 1; i <= s1len; i++) {
        for (let j = 1; j <= s2len; j++) {
            const diagCost = s1arr[i - 1] === s2arr[j - 1] ? matchCost : mismatchCost;
            const diagM = M[i - 1][j - 1] + diagCost;
            const IX2M = IX[i - 1][j - 1] + diagCost;
            const IY2M = IY[i - 1][j - 1] + diagCost;
            [M[i][j], traceM[i][j]] = findMax([diagM, IX2M, IY2M]);

            const boundaryGapExtendX = (i === s1len) ? gapExtend / useBoundaryFactor : gapExtend;
            const boundaryGapExtendY = (j === s2len) ? gapExtend / useBoundaryFactor : gapExtend;

            const M2IX = M[i - 1][j] + gapOpen;
            const IXextend = IX[i - 1][j] + boundaryGapExtendY;
            [IX[i][j], traceIX[i][j]] = findMax([M2IX, IXextend]);

            const M2IY = M[i][j - 1] + gapOpen;
            const IYextend = IY[i][j - 1] + boundaryGapExtendX;
            [IY[i][j], traceIY[i][j]] = findMax([M2IY, -Infinity, IYextend]);
        }
    }

    const revArr1: string[] = [];
    const revArr2: string[] = [];
    const mats = [traceM, traceIX, traceIY];
    let xI = s1len;
    let yI = s2len;
    let mI = findMax([M[xI][yI], IX[xI][yI], IY[xI][yI]])[1];

    while (xI > 0 && yI > 0) {
        const nextMI = mats[mI - 1][xI][yI];
        if (mI === 1) {
            revArr1.push(s1arr[xI - 1]);
            revArr2.push(s2arr[yI - 1]);
            xI--;
            yI--;
        } else if (mI === 2) {
            revArr1.push(s1arr[xI - 1]);
            revArr2.push('-');
            xI--;
        } else if (mI === 3) {
            revArr1.push('-');
            revArr2.push(s2arr[yI - 1]);
            yI--;
        }
        mI = nextMI;
    }
    while (xI > 0) {
        revArr1.push(s1arr[xI - 1]);
        revArr2.push('-');
        xI--;
    }
    while (yI > 0) {
        revArr1.push('-');
        revArr2.push(s2arr[yI - 1]);
        yI--;
    }
    return [revArr1.reverse().join(''), revArr2.reverse().join('')];
}

function getLIS(matches: { i: number; j: number; len: number }[]) {
    if (matches.length === 0) return [];
    const tails: number[] = [];
    const parent = new Int32Array(matches.length).fill(-1);
    for (let i = 0; i < matches.length; i++) {
        const val = matches[i].j;
        let left = 0, right = tails.length;
        while (left < right) {
            const mid = (left + right) >>> 1;
            if (matches[tails[mid]].j < val) left = mid + 1;
            else right = mid;
        }
        if (left < tails.length) {
            tails[left] = i;
            parent[i] = (left > 0) ? tails[left - 1] : -1;
        } else {
            tails.push(i);
            parent[i] = (tails.length > 1) ? tails[tails.length - 2] : -1;
        }
    }
    const result: typeof matches = [];
    let curr = tails[tails.length - 1];
    while (curr !== -1) {
        result.push(matches[curr]);
        curr = parent[curr];
    }
    return result.reverse();
}

function mergeAndErodeAnchors(matches: { i: number; j: number; len: number }[], margin: number) {
    if (matches.length === 0) return [];

    const merged: { i: number; j: number; len: number }[] = [];
    let curr = { ...matches[0] };

    for (let k = 1; k < matches.length; k++) {
        const next = matches[k];
        const diagCurr = curr.j - curr.i;
        const diagNext = next.j - next.i;
        const isConnected = next.i <= (curr.i + curr.len);

        if (diagCurr === diagNext && isConnected) {
            const newEnd = Math.max(curr.i + curr.len, next.i + next.len);
            curr.len = newEnd - curr.i;
        } else {
            merged.push(curr);
            curr = { ...next };
        }
    }
    merged.push(curr);

    const eroded: typeof merged = [];
    for (const m of merged) {
        const newLen = m.len - (2 * margin);
        if (newLen > 0) {
            eroded.push({
                i: m.i + margin,
                j: m.j + margin,
                len: newLen
            });
        }
    }
    return eroded;
}

function stitchAlignments(s1: string, s2: string, anchors: { i: number; j: number; len: number }[], nwParams: number[]): [string, string] {
    let finalS1 = "";
    let finalS2 = "";
    let idx1 = 0;
    let idx2 = 0;

    for (let k = 0; k < anchors.length; k++) {
        const anchor = anchors[k];
        const sub1 = s1.substring(idx1, anchor.i);
        const sub2 = s2.substring(idx2, anchor.j);

        const isStart = (k === 0 && idx1 === 0);
        const isEnd = false;

        if (sub1.length > 0 || sub2.length > 0) {
            const [aln1, aln2] = constrainedNWAlign(sub1, sub2, nwParams[0], nwParams[1], nwParams[2], nwParams[3], nwParams[4], isStart, isEnd);
            finalS1 += aln1;
            finalS2 += aln2;
        }

        const anchorSeq = s1.substring(anchor.i, anchor.i + anchor.len);
        finalS1 += anchorSeq;
        finalS2 += anchorSeq;

        idx1 = anchor.i + anchor.len;
        idx2 = anchor.j + anchor.len;
    }

    if (idx1 < s1.length || idx2 < s2.length) {
        const sub1 = s1.substring(idx1);
        const sub2 = s2.substring(idx2);
        const [aln1, aln2] = constrainedNWAlign(sub1, sub2, nwParams[0], nwParams[1], nwParams[2], nwParams[3], nwParams[4], false, true);
        finalS1 += aln1;
        finalS2 += aln2;
    }

    return [finalS1, finalS2];
}

export function kmer_seeded_nwalign(s1: string, s2: string, gapOpen = -10.0, gapExtend = -0.2, matchCost = 1.0, mismatchCost = -0.7, boundaryGapFactor = 10): [string, string] {
    const K = 25;
    const minLen = Math.min(s1.length, s2.length);

    if (minLen < 3 * K) {
        return affineNWAlign(s1, s2, gapOpen, gapExtend, matchCost, mismatchCost, boundaryGapFactor);
    }

    const getUniqueKmers = (str: string) => {
        const counts = new Map<string, number>();
        const indices = new Map<string, number>();
        for (let i = 0; i <= str.length - K; i++) {
            const sub = str.substring(i, i + K);
            counts.set(sub, (counts.get(sub) || 0) + 1);
            indices.set(sub, i);
        }
        return { counts, indices };
    };

    const map1 = getUniqueKmers(s1);
    const map2 = getUniqueKmers(s2);

    let matches: { i: number; j: number; len: number }[] = [];
    for (const [kmer, count] of map1.counts) {
        if (count === 1 && map2.counts.get(kmer) === 1) {
            matches.push({
                i: map1.indices.get(kmer)!,
                j: map2.indices.get(kmer)!,
                len: K
            });
        }
    }

    if (matches.length === 0) {
        return affineNWAlign(s1, s2, gapOpen, gapExtend, matchCost, mismatchCost, boundaryGapFactor);
    }

    matches.sort((a, b) => a.i - b.i);
    const lisMatches = getLIS(matches);
    const anchors = mergeAndErodeAnchors(lisMatches, K);

    return stitchAlignments(s1, s2, anchors, [gapOpen, gapExtend, matchCost, mismatchCost, boundaryGapFactor]);
}

export function doubleDP_nwalign(s1: string, s2: string, gapOpen = -10.0, gapExtend = -0.2, matchCost = 1.0, mismatchCost = -0.7, boundaryGapFactor = 10): [string, string] {
    const K = 11;
    const minLen = Math.min(s1.length, s2.length);

    if (minLen < 3 * K) {
        return affineNWAlign(s1, s2, gapOpen, gapExtend, matchCost, mismatchCost, boundaryGapFactor);
    }

    const s1Map = new Map<string, number[]>();
    for (let i = 0; i <= s1.length - K; i++) {
        const sub = s1.substring(i, i + K);
        if (!s1Map.has(sub)) s1Map.set(sub, []);
        s1Map.get(sub)!.push(i);
    }

    let matches: { i: number; j: number; len: number }[] = [];
    const maxHits = 25;

    for (let j = 0; j <= s2.length - K; j++) {
        const sub = s2.substring(j, j + K);
        const hits = s1Map.get(sub);
        if (hits && hits.length <= maxHits) {
            for (const i of hits) {
                matches.push({ i, j, len: K });
            }
        }
    }

    if (matches.length === 0) {
        return affineNWAlign(s1, s2, gapOpen, gapExtend, matchCost, mismatchCost, boundaryGapFactor);
    }

    matches.sort((a, b) => (a.i - b.i) || (a.j - b.j));

    const scores = new Float64Array(matches.length);
    const parents = new Int32Array(matches.length).fill(-1);
    const lookback = 80;

    for (let cur = 0; cur < matches.length; cur++) {
        const mCurr = matches[cur];
        let maxScore = mCurr.len;

        const startSearch = Math.max(0, cur - lookback);
        for (let prev = cur - 1; prev >= startSearch; prev--) {
            const mPrev = matches[prev];

            if (mPrev.i < mCurr.i && mPrev.j < mCurr.j) {
                const diagDiff = Math.abs((mCurr.j - mCurr.i) - (mPrev.j - mPrev.i));
                const gapI = mCurr.i - (mPrev.i + mPrev.len);
                const gapJ = mCurr.j - (mPrev.j + mPrev.len);
                const dist = Math.max(0, gapI) + Math.max(0, gapJ);
                const penalty = (diagDiff * 3.0) + (dist * 0.1);

                const newScore = scores[prev] + mCurr.len - penalty;
                if (newScore > maxScore) {
                    maxScore = newScore;
                    parents[cur] = prev;
                }
            }
        }
        scores[cur] = maxScore;
    }

    let bestIdx = 0;
    let maxS = scores[0];
    for (let i = 1; i < matches.length; i++) {
        if (scores[i] > maxS) {
            maxS = scores[i];
            bestIdx = i;
        }
    }

    const chain: typeof matches = [];
    let curr = bestIdx;
    while (curr !== -1) {
        chain.push(matches[curr]);
        curr = parents[curr];
    }
    chain.reverse();

    const anchors = mergeAndErodeAnchors(chain, K);

    return stitchAlignments(s1, s2, anchors, [gapOpen, gapExtend, matchCost, mismatchCost, boundaryGapFactor]);
}

// POA and MSA functions

class POANode {
    id: number;
    char: string;
    next: number[] = [];
    prev: number[] = [];
    seqs = new Set<number>();
    alignedTo: number | null = null;

    constructor(id: number, char: string) {
        this.id = id;
        this.char = char;
    }
}

class POAGraph {
    nodes: POANode[] = [];
    sequences: string[] = [];
    nodeCount = 0;

    createNode(char: string) {
        const node = new POANode(this.nodeCount++, char);
        this.nodes.push(node);
        return node;
    }

    addEdge(fromId: number, toId: number) {
        const from = this.nodes[fromId];
        const to = this.nodes[toId];
        if (!from.next.includes(toId)) from.next.push(toId);
        if (!to.prev.includes(fromId)) to.prev.push(fromId);
    }

    initFirstSequence(seq: string) {
        this.sequences.push(seq);
        let prevNode: POANode | null = null;
        for (let i = 0; i < seq.length; i++) {
            const node = this.createNode(seq[i]);
            node.seqs.add(0);
            if (prevNode) {
                this.addEdge(prevNode.id, node.id);
            }
            prevNode = node;
        }
    }

    getTopologicalSort() {
        const visited = new Array(this.nodeCount).fill(false);
        const stack: number[] = [];

        const visit = (u: number) => {
            visited[u] = true;
            for (const vId of this.nodes[u].next) {
                if (!visited[vId]) visit(vId);
            }
            stack.push(u);
        };

        for (let i = 0; i < this.nodeCount; i++) {
            if (!visited[i]) visit(i);
        }

        return stack.reverse();
    }

    getConsensusPath() {
        const sorted = this.getTopologicalSort();

        const pathScore = new Array(this.nodeCount).fill(0);
        const bestPrev = new Array(this.nodeCount).fill(-1);

        for (const u of sorted) {
            const w = this.nodes[u].seqs.size;
            let maxPrevScore = 0;
            let bp = -1;

            for (const p of this.nodes[u].prev) {
                if (pathScore[p] > maxPrevScore) {
                    maxPrevScore = pathScore[p];
                    bp = p;
                }
            }
            pathScore[u] = w + maxPrevScore;
            bestPrev[u] = bp;
        }

        let bestEnd = 0;
        for (let i = 0; i < this.nodeCount; i++) {
            if (pathScore[i] > pathScore[bestEnd]) bestEnd = i;
        }

        const resIds: number[] = [];
        let ptr: number = bestEnd;
        while (ptr !== -1) {
            resIds.push(ptr);
            ptr = bestPrev[ptr];
        }
        resIds.reverse();

        return {
            str: resIds.map(id => this.nodes[id].char).join(''),
            mapping: resIds
        };
    }
}

function findSeqToGraphAnchors(s1: string, s2: string) {
    const K = 15;
    if (s1.length < K || s2.length < K) return [];

    const getUniqueKmers = (str: string) => {
        const counts = new Map<string, number>();
        const indices = new Map<string, number>();
        for (let i = 0; i <= str.length - K; i++) {
            const sub = str.substring(i, i + K);
            counts.set(sub, (counts.get(sub) || 0) + 1);
            indices.set(sub, i);
        }
        return { counts, indices };
    };

    const map1 = getUniqueKmers(s1);
    const map2 = getUniqueKmers(s2);

    let matches: { i: number; j: number; len: number }[] = [];
    for (const [kmer, count] of map1.counts) {
        if (count === 1 && map2.counts.get(kmer) === 1) {
            matches.push({
                i: map1.indices.get(kmer)!,
                j: map2.indices.get(kmer)!,
                len: K
            });
        }
    }

    matches.sort((a, b) => a.i - b.i);
    const lis = getLIS(matches);
    return mergeAndErodeAnchors(lis, 2);
}

function getSubgraph(graph: POAGraph, startId: number, endId: number | null, topoOrder: number[], topoIndexMap: Int32Array) {
    const nodes: number[] = [];
    const startIndex = (startId === -1) ? -1 : topoIndexMap[startId];
    const endIndex = (endId === null) ? Infinity : topoIndexMap[endId];

    for (const u of topoOrder) {
        const idx = topoIndexMap[u];
        if (idx > startIndex && idx < endIndex) {
            nodes.push(u);
        }
    }
    return nodes;
}

interface AlignOp {
    type: 'MATCH' | 'INS' | 'DEL';
    char: string | null;
    nodeId: number | null;
}

function runSeqToGraphDP(seq: string, graphNodes: number[], fullGraph: POAGraph, nwParams: number[]): AlignOp[] {
    const [gapOpen, gapExtend, matchCost, mismatchCost] = nwParams;
    const seqLen = seq.length;
    const subNodeCount = graphNodes.length;

    const realIdToSubIdx = new Map<number, number>();
    graphNodes.forEach((id, idx) => realIdToSubIdx.set(id, idx));

    const scoreMat = new Float32Array((seqLen + 1) * subNodeCount).fill(-1e9);
    const traceMat = new Int8Array((seqLen + 1) * subNodeCount).fill(0);
    const tracePred = new Int32Array((seqLen + 1) * subNodeCount).fill(-1);

    const idx = (i: number, j: number) => i * subNodeCount + j;

    for (let u = 0; u < subNodeCount; u++) {
        const uId = graphNodes[u];
        const preds = fullGraph.nodes[uId].prev;

        let maxPrev = -1e9;
        let bestP = -1;

        const isStartConnected = preds.some(p => !realIdToSubIdx.has(p));

        if (isStartConnected) {
            maxPrev = gapOpen;
        }

        for (const pId of preds) {
            if (realIdToSubIdx.has(pId)) {
                const pIdx = realIdToSubIdx.get(pId)!;
                const s = scoreMat[idx(0, pIdx)];
                if (s > -1e9) {
                    const val = s + gapExtend;
                    if (val > maxPrev) {
                        maxPrev = val;
                        bestP = pIdx;
                    }
                }
            }
        }

        scoreMat[idx(0, u)] = maxPrev;
        traceMat[idx(0, u)] = 3;
        tracePred[idx(0, u)] = bestP;
    }

    for (let i = 1; i <= seqLen; i++) {
        const char = seq[i-1];

        for (let u = 0; u < subNodeCount; u++) {
            const uId = graphNodes[u];
            const nodeChar = fullGraph.nodes[uId].char;
            const match = (char === nodeChar) ? matchCost : mismatchCost;
            const preds = fullGraph.nodes[uId].prev;

            let maxDiag = -1e9;
            let bestDiagP = -1;

            const isStartConnected = preds.some(p => !realIdToSubIdx.has(p));
            if (isStartConnected) {
                if (i === 1) maxDiag = match;
            }

            for (const pId of preds) {
                if (realIdToSubIdx.has(pId)) {
                    const pIdx = realIdToSubIdx.get(pId)!;
                    const s = scoreMat[idx(i-1, pIdx)];
                    if (s > -1e9) {
                        if (s + match > maxDiag) {
                            maxDiag = s + match;
                            bestDiagP = pIdx;
                        }
                    }
                }
            }

            let maxIns = scoreMat[idx(i-1, u)] + gapExtend;

            let maxDel = -1e9;
            let bestDelP = -1;

            for (const pId of preds) {
                if (realIdToSubIdx.has(pId)) {
                    const pIdx = realIdToSubIdx.get(pId)!;
                    const s = scoreMat[idx(i, pIdx)];
                    if (s > -1e9) {
                        if (s + gapExtend > maxDel) {
                            maxDel = s + gapExtend;
                            bestDelP = pIdx;
                        }
                    }
                }
            }

            let bestScore = maxDiag;
            let type = 1;
            let pred = bestDiagP;

            if (maxDel > bestScore) {
                bestScore = maxDel;
                type = 3;
                pred = bestDelP;
            }
            if (maxIns > bestScore) {
                bestScore = maxIns;
                type = 2;
                pred = u;
            }

            scoreMat[idx(i, u)] = bestScore;
            traceMat[idx(i, u)] = type;
            tracePred[idx(i, u)] = pred;
        }
    }

    let maxEndScore = -1e9;
    let currU = -1;
    for (let u = 0; u < subNodeCount; u++) {
        if (scoreMat[idx(seqLen, u)] > maxEndScore) {
            maxEndScore = scoreMat[idx(seqLen, u)];
            currU = u;
        }
    }

    const path: AlignOp[] = [];
    let currI = seqLen;

    while (currI > 0 || currU !== -1) {
        if (currI === 0 && currU === -1) break;

        if (currU === -1) {
            path.push({ type: 'INS', char: seq[currI-1], nodeId: null });
            currI--;
            continue;
        }

        const type = traceMat[idx(currI, currU)];
        const pred = tracePred[idx(currI, currU)];

        if (currI === 0) {
            if (scoreMat[idx(currI, currU)] <= -1e8) break;
        }

        if (type === 1) {
            path.push({ type: 'MATCH', char: seq[currI-1], nodeId: graphNodes[currU] });
            currI--;
            currU = pred;
        } else if (type === 2) {
            path.push({ type: 'INS', char: seq[currI-1], nodeId: graphNodes[currU] });
            currI--;
        } else if (type === 3) {
            path.push({ type: 'DEL', char: null, nodeId: graphNodes[currU] });
            currU = pred;
        } else {
            if (currI > 0) {
                path.push({ type: 'INS', char: seq[currI-1], nodeId: null });
                currI--;
            } else {
                break;
            }
        }
    }

    return path.reverse();
}

function applyAlignmentToGraph(graph: POAGraph, alignPath: AlignOp[], subSeq: string, startNodeId: number, seqIdx: number): number {
    let currNodeId = startNodeId;

    for (const op of alignPath) {
        if (op.type === 'MATCH') {
            const node = graph.nodes[op.nodeId!];
            if (node.char === op.char) {
                node.seqs.add(seqIdx);
                if (currNodeId !== -1 && currNodeId !== op.nodeId) {
                    graph.addEdge(currNodeId, op.nodeId!);
                }
                currNodeId = op.nodeId!;
            } else {
                const newNode = graph.createNode(op.char!);
                newNode.seqs.add(seqIdx);
                if (currNodeId !== -1) graph.addEdge(currNodeId, newNode.id);
                currNodeId = newNode.id;
            }
        } else if (op.type === 'INS') {
            const newNode = graph.createNode(op.char!);
            newNode.seqs.add(seqIdx);
            if (currNodeId !== -1) graph.addEdge(currNodeId, newNode.id);
            currNodeId = newNode.id;
        }
    }
    return currNodeId;
}

function addSequenceToGraph(graph: POAGraph, sequence: string, nwParams: number[]) {
    const seqIdx = graph.sequences.length;
    graph.sequences.push(sequence);

    const consensus = graph.getConsensusPath();
    const anchors = findSeqToGraphAnchors(sequence, consensus.str);

    const constraints = anchors.map(a => ({
        seqStart: a.i,
        seqEnd: a.i + a.len,
        nodeStart: consensus.mapping[a.j],
        nodeEnd: consensus.mapping[a.j + a.len - 1]
    }));

    let currSeqPos = 0;
    let prevNodeId = -1;

    const topoOrder = graph.getTopologicalSort();
    const topoIndexMap = new Int32Array(graph.nodeCount).fill(-1);
    for (let i = 0; i < topoOrder.length; i++) topoIndexMap[topoOrder[i]] = i;

    for (let k = 0; k <= constraints.length; k++) {
        let blockSeqEnd: number;
        let blockNodeTarget: number | null;

        if (k < constraints.length) {
            blockSeqEnd = constraints[k].seqStart;
            blockNodeTarget = constraints[k].nodeStart;
        } else {
            blockSeqEnd = sequence.length;
            blockNodeTarget = null;
        }

        if (currSeqPos < blockSeqEnd || (prevNodeId !== -1 && blockNodeTarget !== null)) {
            const subSeq = sequence.substring(currSeqPos, blockSeqEnd);
            const subgraphNodes = getSubgraph(graph, prevNodeId, blockNodeTarget, topoOrder, topoIndexMap);

            if (subSeq.length > 0 || subgraphNodes.length > 0) {
                const alignPath = runSeqToGraphDP(subSeq, subgraphNodes, graph, nwParams);
                prevNodeId = applyAlignmentToGraph(graph, alignPath, subSeq, prevNodeId, seqIdx);
            }
        }

        if (k < constraints.length) {
            const constr = constraints[k];
            const len = constr.seqEnd - constr.seqStart;
            const startIdxInCons = consensus.mapping.indexOf(constr.nodeStart);

            for (let i = 0; i < len; i++) {
                const targetNodeId = consensus.mapping[startIdxInCons + i];
                const node = graph.nodes[targetNodeId];
                node.seqs.add(seqIdx);

                if (prevNodeId !== -1 && prevNodeId !== targetNodeId) {
                    graph.addEdge(prevNodeId, targetNodeId);
                }
                prevNodeId = targetNodeId;
            }
            currSeqPos = constr.seqEnd;
        }
    }
}

function generateMSAFromGraph(graph: POAGraph): string[] {
    const topo = graph.getTopologicalSort();

    const columns: Set<number>[] = [];
    const nodeToCol = new Int32Array(graph.nodeCount).fill(-1);

    for (const u of topo) {
        const node = graph.nodes[u];
        let validCol = 0;

        for (const p of node.prev) {
            if (nodeToCol[p] >= validCol) {
                validCol = nodeToCol[p] + 1;
            }
        }

        while (true) {
            if (validCol >= columns.length) {
                columns.push(new Set());
                break;
            }

            const colNodes = columns[validCol];
            let conflict = false;
            for (const existingId of colNodes) {
                const existing = graph.nodes[existingId];
                for (const s of node.seqs) {
                    if (existing.seqs.has(s)) {
                        conflict = true;
                        break;
                    }
                }
                if (conflict) break;
            }

            if (!conflict) break;
            validCol++;
        }

        columns[validCol].add(u);
        nodeToCol[u] = validCol;
    }

    const numCols = columns.length;
    const resultStrs = graph.sequences.map(() => new Array(numCols).fill('-'));

    for (let u = 0; u < graph.nodeCount; u++) {
        const col = nodeToCol[u];
        const char = graph.nodes[u].char;
        for (const s of graph.nodes[u].seqs) {
            resultStrs[s][col] = char;
        }
    }

    return resultStrs.map(arr => arr.join(''));
}

export function multiSequenceAlign(sequences: string[]): string[] {
    if (!sequences || sequences.length === 0) return [];
    if (sequences.length === 1) return [sequences[0]];

    const graph = new POAGraph();
    const nwParams = [-10.0, -1.0, 1.0, -1.0, 10];

    graph.initFirstSequence(sequences[0]);

    for (let i = 1; i < sequences.length; i++) {
        addSequenceToGraph(graph, sequences[i], nwParams);
    }

    return generateMSAFromGraph(graph);
}

function removeGapOnlyColumns(msa: string[]): string[] {
    if (msa.length === 0) return [];
    const len = msa[0].length;
    const keepCol = new Uint8Array(len).fill(0);

    for (let j = 0; j < len; j++) {
        for (let i = 0; i < msa.length; i++) {
            if (msa[i][j] !== '-') {
                keepCol[j] = 1;
                break;
            }
        }
    }

    const newMSA = msa.map(() => "");
    for (let j = 0; j < len; j++) {
        if (keepCol[j]) {
            for (let i = 0; i < msa.length; i++) {
                newMSA[i] += msa[i][j];
            }
        }
    }
    return newMSA;
}

function identifyRefinementBlocks(msa: string[], flankSize: number) {
    const len = msa[0].length;
    const isUnstable = new Uint8Array(len).fill(0);

    for (let j = 0; j < len; j++) {
        for (let i = 0; i < msa.length; i++) {
            if (msa[i][j] === '-') {
                isUnstable[j] = 1;
                break;
            }
        }
    }

    const mask = new Uint8Array(len).fill(0);
    for (let j = 0; j < len; j++) {
        if (isUnstable[j]) {
            const start = Math.max(0, j - flankSize);
            const end = Math.min(len, j + flankSize + 1);
            for (let k = start; k < end; k++) {
                mask[k] = 1;
            }
        }
    }

    const blocks: { start: number; end: number; type: 'refine' | 'stable' }[] = [];
    let currentStart = 0;
    let inRefineBlock = (mask[0] === 1);

    for (let j = 1; j < len; j++) {
        const isRefine = (mask[j] === 1);
        if (isRefine !== inRefineBlock) {
            blocks.push({
                start: currentStart,
                end: j,
                type: inRefineBlock ? 'refine' : 'stable'
            });
            currentStart = j;
            inRefineBlock = isRefine;
        }
    }
    blocks.push({
        start: currentStart,
        end: len,
        type: inRefineBlock ? 'refine' : 'stable'
    });

    return blocks;
}

function refineBlockSlice(msaSlice: string[]): string[] {
    const numSeqs = msaSlice.length;
    const rawSeqs = msaSlice.map(s => s.split('-').join(''));

    if (rawSeqs.every(s => s.length === 0)) return msaSlice;

    let bestIdx = 0;
    let maxLen = -1;
    for (let i = 0; i < numSeqs; i++) {
        if (rawSeqs[i].length > maxLen) {
            maxLen = rawSeqs[i].length;
            bestIdx = i;
        }
    }
    const refSeq = rawSeqs[bestIdx];

    const refLen = refSeq.length;
    const refMatches = Array(refLen).fill(null).map(() => Array(numSeqs).fill('-'));
    const insertions = Array(refLen + 1).fill(null).map(() => Array(numSeqs).fill(''));

    const nwParams: [number, number, number, number, number] = [-10.0, -0.2, 1.0, -0.7, 10];

    for (let i = 0; i < numSeqs; i++) {
        if (i === bestIdx) {
            for (let k = 0; k < refLen; k++) refMatches[k][i] = refSeq[k];
            continue;
        }

        const query = rawSeqs[i];
        if (query.length === 0) continue;

        const [alnRef, alnQuery] = doubleDP_nwalign(refSeq, query, ...nwParams);

        let refPos = 0;
        let activeIns = "";

        for (let k = 0; k < alnRef.length; k++) {
            const rChar = alnRef[k];
            const qChar = alnQuery[k];

            if (rChar !== '-') {
                if (activeIns.length > 0) {
                    insertions[refPos][i] = activeIns;
                    activeIns = "";
                }
                refMatches[refPos][i] = qChar;
                refPos++;
            } else {
                if (qChar !== '-') {
                    activeIns += qChar;
                }
            }
        }
        if (activeIns.length > 0) {
            insertions[refPos][i] = activeIns;
        }
    }

    const finalCols: string[] = [];

    for (let k = 0; k <= refLen; k++) {
        let maxInsLen = 0;
        for (let i = 0; i < numSeqs; i++) {
            if (insertions[k][i].length > maxInsLen) maxInsLen = insertions[k][i].length;
        }

        if (maxInsLen > 0) {
            for (let pos = 0; pos < maxInsLen; pos++) {
                let colStr = "";
                for (let i = 0; i < numSeqs; i++) {
                    const insStr = insertions[k][i];
                    const char = (pos < insStr.length) ? insStr[pos] : '-';
                    colStr += char;
                }
                finalCols.push(colStr);
            }
        }

        if (k < refLen) {
            let colStr = "";
            for (let i = 0; i < numSeqs; i++) {
                colStr += refMatches[k][i];
            }
            finalCols.push(colStr);
        }
    }

    const newSlice = Array(numSeqs).fill("");
    for (const col of finalCols) {
        for (let i = 0; i < numSeqs; i++) {
            newSlice[i] += col[i];
        }
    }

    return newSlice;
}

export function refinedMSA(sequences: string[], iterations = 3): string[] {
    let currentMSA = multiSequenceAlign(sequences);

    if (!currentMSA || currentMSA.length === 0) return [];
    if (currentMSA.length === 1) return currentMSA;

    for (let iter = 0; iter < iterations; iter++) {
        currentMSA = removeGapOnlyColumns(currentMSA);
        const blocks = identifyRefinementBlocks(currentMSA, 20);

        const nextMSA = currentMSA.map(() => "");

        for (const block of blocks) {
            const blockSlice = currentMSA.map(seq => seq.substring(block.start, block.end));

            if (block.type === 'stable') {
                for (let i = 0; i < nextMSA.length; i++) {
                    nextMSA[i] += blockSlice[i];
                }
            } else {
                const refinedSlice = refineBlockSlice(blockSlice);
                for (let i = 0; i < nextMSA.length; i++) {
                    nextMSA[i] += refinedSlice[i];
                }
            }
        }

        currentMSA = nextMSA;
    }

    return removeGapOnlyColumns(currentMSA);
}
