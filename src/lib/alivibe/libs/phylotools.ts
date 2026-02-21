/**
 * Phylogenetic Analysis Tools (JC69 + Neighbor Joining)
 * Converted to ES module from phylotools.js
 */

export const PhyloTools = {
    calculateJC69(seq1: string, seq2: string): number {
        if (seq1.length !== seq2.length) {
            throw new Error("Sequences must be of equal length (aligned).");
        }

        const validBases = new Set(['A', 'C', 'G', 'T', 'U', 'a', 'c', 'g', 't', 'u']);
        let differences = 0;
        let validSites = 0;

        for (let i = 0; i < seq1.length; i++) {
            const n1 = seq1[i];
            const n2 = seq2[i];

            if (validBases.has(n1) && validBases.has(n2)) {
                validSites++;
                if (n1.toUpperCase() !== n2.toUpperCase()) {
                    differences++;
                }
            }
        }

        if (validSites === 0) return 0;

        const p = differences / validSites;

        if (p >= 0.75) {
            return Infinity;
        }

        return -0.75 * Math.log(1 - (4 / 3) * p);
    },

    computeDistanceMatrix(sequences: string[]): number[][] {
        const n = sequences.length;
        const matrix = Array.from({ length: n }, () => new Array(n).fill(0));

        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const dist = this.calculateJC69(sequences[i], sequences[j]);
                matrix[i][j] = dist;
                matrix[j][i] = dist;
            }
        }
        return matrix;
    },

    buildNeighborJoiningTree(distMatrix: number[][], labels: string[]): string {
        let D = distMatrix.map(row => [...row]);
        let clusters = labels.map((label, i) => ({
            newick: label,
            id: i
        }));

        while (clusters.length > 2) {
            const N = clusters.length;

            const R = new Array(N).fill(0);
            for (let i = 0; i < N; i++) {
                for (let j = 0; j < N; j++) {
                    if (i !== j) R[i] += D[i][j];
                }
            }

            let minQ = Infinity;
            let pair = [-1, -1];

            for (let i = 0; i < N; i++) {
                for (let j = i + 1; j < N; j++) {
                    const qVal = (N - 2) * D[i][j] - R[i] - R[j];
                    if (qVal < minQ) {
                        minQ = qVal;
                        pair = [i, j];
                    }
                }
            }

            const [i, j] = pair;

            const dist_ij = D[i][j];
            const val_i_u = 0.5 * dist_ij + (1 / (2 * (N - 2))) * (R[i] - R[j]);
            const val_j_u = dist_ij - val_i_u;

            const newNodeName = `(${clusters[i].newick}:${val_i_u.toFixed(5)},${clusters[j].newick}:${val_j_u.toFixed(5)})`;

            const newDistRow: number[] = [];
            for (let k = 0; k < N; k++) {
                if (k !== i && k !== j) {
                    const d_uk = 0.5 * (D[i][k] + D[j][k] - dist_ij);
                    newDistRow.push(d_uk);
                }
            }

            const nextClusters = clusters.filter((_, idx) => idx !== i && idx !== j);
            nextClusters.push({ newick: newNodeName, id: -1 });
            clusters = nextClusters;

            let nextD = D.filter((_, idx) => idx !== i && idx !== j);
            nextD = nextD.map(row => row.filter((_, idx) => idx !== i && idx !== j));

            for (let k = 0; k < nextD.length; k++) {
                nextD[k].push(newDistRow[k]);
            }
            newDistRow.push(0);
            nextD.push(newDistRow);

            D = nextD;
        }

        const distFinal = D[0][1];
        return `(${clusters[0].newick}:${(distFinal/2).toFixed(5)},${clusters[1].newick}:${(distFinal/2).toFixed(5)});`;
    },

    generatePhylogeny(sequences: string[], labels: string[]): string {
        if (!sequences || !labels || sequences.length !== labels.length) {
            throw new Error("Mismatch between sequences and labels.");
        }

        const distMatrix = this.computeDistanceMatrix(sequences);
        const newick = this.buildNeighborJoiningTree(distMatrix, labels);

        return newick;
    }
};
