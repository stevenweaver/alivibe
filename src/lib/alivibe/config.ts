export const CONFIG = {
    font: "14px 'Courier New', monospace",
    labelFont: "12px system-ui, sans-serif",
    charWidth: 12,
    rowHeight: 24,
    highlightMatchColor: '#ffffff',
    highlightGapColor: '#d1d5db',
    rulerTickStep: 10,
    maxHistory: 30,
    colors: {
        NT: {
            'A': '#81d4fa', 'G': '#fff176', 'C': '#a5d6a7', 'T': '#ff8a80', 'U': '#ff8a80',
            'R': '#e6ee9c', 'Y': '#80cbc4', 'M': '#a5d6a7', 'K': '#ef9a9a', 'S': '#c5e1a5',
            'W': '#ce93d8', 'H': '#81d4fa', 'B': '#ef9a9a', 'V': '#fff59d', 'D': '#ffcc80',
            'N': '#eeeeee',
            '-': '#ffffff', 'default': '#f5f5f5'
        } as Record<string, string>,
        AA: {
            'A': '#80a0f0', 'R': '#f01505', 'N': '#00ff00', 'D': '#c048c0', 'C': '#f08080',
            'Q': '#00ff00', 'E': '#c048c0', 'G': '#f09048', 'H': '#15a4a4', 'I': '#80a0f0',
            'L': '#80a0f0', 'K': '#f01505', 'M': '#80a0f0', 'F': '#80a0f0', 'P': '#ffff00',
            'S': '#00ff00', 'T': '#00ff00', 'W': '#80a0f0', 'Y': '#15a4a4', 'V': '#80a0f0',
            '*': '#999999', '-': '#ffffff', 'default': '#ffffff'
        } as Record<string, string>
    }
};

export const CODON_TABLE: Record<string, string> = {
    'ATA':'I', 'ATC':'I', 'ATT':'I', 'ATG':'M', 'ACA':'T', 'ACC':'T', 'ACG':'T', 'ACT':'T',
    'AAC':'N', 'AAT':'N', 'AAA':'K', 'AAG':'K', 'AGC':'S', 'AGT':'S', 'AGA':'R', 'AGG':'R',
    'CTA':'L', 'CTC':'L', 'CTG':'L', 'CTT':'L', 'CCA':'P', 'CCC':'P', 'CCG':'P', 'CCT':'P',
    'CAC':'H', 'CAT':'H', 'CAA':'Q', 'CAG':'Q', 'CGA':'R', 'CGC':'R', 'CGG':'R', 'CGT':'R',
    'GTA':'V', 'GTC':'V', 'GTG':'V', 'GTT':'V', 'GCA':'A', 'GCC':'A', 'GCG':'A', 'GCT':'A',
    'GAC':'D', 'GAT':'D', 'GAA':'E', 'GAG':'E', 'GGA':'G', 'GGC':'G', 'GGG':'G', 'GGT':'G',
    'TCA':'S', 'TCC':'S', 'TCG':'S', 'TCT':'S', 'TTC':'F', 'TTT':'F', 'TTA':'L', 'TTG':'L',
    'TAC':'Y', 'TAT':'Y', 'TAA':'*', 'TAG':'*', 'TGC':'C', 'TGT':'C', 'TGA':'*', 'TGG':'W',
};
