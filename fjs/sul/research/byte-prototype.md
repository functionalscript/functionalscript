# Byte-alphabet experiment source

These experimental JavaScript files are archived for review and reproduction.
They are not installed as production FunctionalScript modules. The unchanged
ordered codec and arithmetic coder are included in `byte-prototype.zip`.

## sul-byte-experiment/levels.mjs

```javascript
// Experimental SUL word hierarchy with raw bit or byte leaves. This deliberately
// bypasses the native bit-specific literal pipeline; it is not a native SUL ID.
import { rawId } from '../sul-compression-research/vendor/fjs/sul/id/module.f.mjs';
import { vec } from '../sul-compression-research/vendor/fjs/types/bit_vec/module.f.mjs';
import { encode, emptyEncodeState } from '../sul-compression-research/vendor/fjs/sul/level/hash/module.f.mjs';
import { flatten } from '../sul-ordered-experiment/levels.mjs';

export function symbolTree(bits, width = 8) {
    if ((width !== 1 && width !== 8) || bits.length % width || /[^01]/.test(bits)) throw new Error('Expected complete bit or byte symbols');
    const leaves = Array.from({ length: 2 ** width }, (_, value) => ({
        key: `raw${width}:0:${value}`, value: rawId(vec(BigInt(width))(BigInt(value))),
        level: 0, length: width, bits: value.toString(2).padStart(width, '0'),
    }));
    const step = encode((_a, _b, _id, _symbol, storage) => storage);
    const levels = [], stats = [];
    const push = leaf => {
        let child = leaf;
        for (let index = 0; ; index++) {
            if (index > 63) throw new Error('Prototype hierarchy depth limit');
            const fresh = index === levels.length;
            if (fresh) {
                levels.push({ state: emptyEncodeState(null), pending: [], interned: new Map() });
                stats.push({ level: index, symbols: 0, ids: new Set() });
            }
            stats[index].symbols++; stats[index].ids.add(child.value);
            const level = levels[index];
            level.pending.push(child);
            const [value, state] = step(child.value, level.state); level.state = state;
            // The first symbol at a new highest level contains the entire
            // stream so far. Only finalization accepts it as the document root.
            if (fresh) return child;
            if (value === undefined) return undefined;
            let node = level.interned.get(value);
            if (!node) {
                node = { key: `raw${width}:${index + 1}:${value}`, value, level: index + 1,
                    length: level.pending.reduce((sum, node) => sum + node.length, 0), children: level.pending };
                level.interned.set(value, node);
            }
            child = node; level.pending = [];
        }
    };
    for (let offset = 0; offset < bits.length; offset += width) push(leaves[parseInt(bits.slice(offset, offset + width), 2)]);
    // Both variants append the same bit-level suffix 10*. For bytes the first
    // pad symbol is 0x80, and subsequent pad symbols are 0x00.
    const paddingLimit = Math.max(65536, 4 * bits.length);
    let paddingSymbols = 1, root = push(leaves[2 ** (width - 1)]);
    while (root === undefined) {
        if (++paddingSymbols * width > paddingLimit) throw new Error('Prototype finalization limit');
        root = push(leaves[0]);
    }
    const padded = bits + '1' + '0'.repeat(paddingSymbols * width - 1);
    if (flatten(root) !== padded) throw new Error('Hierarchy does not reconstruct the input and padding');
    return { root, paddedBits: padded.length, paddingSymbols,
        stats: stats.map(({ level, symbols, ids }) => ({ level, symbols, unique: ids.size })) };
}
```

## sul-byte-experiment/test.mjs

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { symbolTree } from './levels.mjs';
import { bytesToBits } from '../sul-compression-research/sul-graph.mjs';
import { flatten } from '../sul-ordered-experiment/levels.mjs';
import { encodeOrdered, decodeOrdered } from '../sul-ordered-experiment/ordered.mjs';

function verify(bits, width) {
    const tree = symbolTree(bits, width);
    assert.equal(flatten(tree.root), bits + '1' + '0'.repeat(tree.paddedBits - bits.length - 1));
    const visited = new Set();
    const visit = node => {
        if (visited.has(node.key)) return;
        visited.add(node.key);
        if (!node.children) { assert.equal(node.length, width); return; }
        assert.ok(node.children.length >= 2);
        for (let i = 1; i < node.children.length - 1; i++) assert.ok(node.children[i - 1].value > node.children[i].value);
        assert.ok(node.children.at(-1).value >= node.children.at(-2).value);
        for (const child of node.children) { assert.equal(child.level, node.level - 1); visit(child); }
    };
    visit(tree.root);
    for (const recursive of [false, true]) {
        const result = encodeOrdered(tree.root, bits.length, { recursive });
        assert.equal(decodeOrdered(result.encoded), bits);
        assert.ok(result.encoded.length <= 14 + Math.ceil(bits.length / 8));
    }
    return tree;
}

test('empty input and every single byte round-trip with complete byte leaves', () => {
    verify('', 8);
    for (let value = 0; value < 256; value++) verify(value.toString(2).padStart(8, '0'), 8);
});

test('matched raw-bit control accepts every bitstring of length zero to eight', () => {
    for (let length = 0; length <= 8; length++) for (let value = 0; value < 2 ** length; value++) {
        verify(length ? value.toString(2).padStart(length, '0') : '', 1);
    }
});

test('full alphabet, longest decreasing byte word, and boundary byte values', () => {
    const descending = Array.from({ length: 256 }, (_, i) => 255 - i);
    const bits = bytesToBits(Buffer.from([...descending, 0, ...descending.toReversed(), 255, 0, 128, 127]));
    const tree = verify(bits, 8);
    let first = tree.root;
    while (first.level > 1) first = first.children[0];
    assert.equal(first.children.length, 257);
    assert.deepEqual(first.children.map(node => parseInt(node.bits, 2)), [...descending, 0]);
});

test('repetition recursively compresses byte dictionaries and deterministic output', () => {
    const bits = bytesToBits(Buffer.from('The immutable document shares a repeated sentence.\n'.repeat(1024)));
    const a = symbolTree(bits, 8), b = symbolTree(bits, 8);
    assert.equal(a.root.value, b.root.value);
    const flat = encodeOrdered(a.root, bits.length, { recursive: false });
    const result = encodeOrdered(a.root, bits.length);
    assert.ok(result.layers.length > 1);
    assert.ok(result.encoded.length < flat.encoded.length);
    assert.deepEqual(result.encoded, encodeOrdered(b.root, bits.length).encoded);
    assert.equal(decodeOrdered(result.encoded), bits);
});

test('byte input refuses incomplete symbols, invalid digits, and unsupported widths', () => {
    assert.throws(() => symbolTree('101', 8));
    assert.throws(() => symbolTree('0000000x', 8));
    assert.throws(() => symbolTree('00', 2));
});
```

## sul-byte-experiment/benchmark.mjs

```javascript
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fixtures } from '../sul-ordered-experiment/benchmark.mjs';
import { bytesToBits } from '../sul-compression-research/sul-graph.mjs';
import { encodeOrdered, decodeOrdered } from '../sul-ordered-experiment/ordered.mjs';
import { symbolTree } from './levels.mjs';

const directory = new URL('./results/', import.meta.url); fs.mkdirSync(directory, { recursive: true });
const prior = JSON.parse(fs.readFileSync(new URL('../sul-ordered-experiment/results/results.json', import.meta.url)));
const report = { version: 3, node: process.version, sulCommit: prior.sulCommit,
    order: 'first occurrence', variants: ['native bit SUL (previous run)', 'raw-bit SUL control', 'raw-byte SUL experiment'],
    arithmetic: 'unchanged adaptive binary coder and contexts from ordered experiment', fixtures: [] };
for (const [name, bytes, description] of fixtures) {
    const start = performance.now(), bits = bytesToBits(bytes), sha256 = createHash('sha256').update(bytes).digest('hex');
    const previous = prior.fixtures.find(row => row.name === name); assert.equal(previous.sha256, sha256);
    const row = { name, description, inputBytes: bytes.length, sha256,
        nativeBitFlatBytes: previous.flat.bytes, nativeBitRecursiveBytes: previous.recursive.bytes,
        previousHybridBytes: previous.previousHybridBytes, arithmeticOnlyBytes: previous.arithmeticOnlyBytes,
        gzip9Bytes: previous.gzip9Bytes, brotli11Bytes: previous.brotli11Bytes, zstd19Bytes: previous.zstd19Bytes };
    for (const [label, width] of [['rawBit', 1], ['rawByte', 8]]) {
        const beforeTree = performance.now(), tree = symbolTree(bits, width);
        row[label + 'Tree'] = { width, treeMs: performance.now() - beforeTree, paddedBits: tree.paddedBits, paddingSymbols: tree.paddingSymbols, levels: tree.stats };
        for (const recursive of [false, true]) {
            const before = performance.now(), result = encodeOrdered(tree.root, bits.length, { recursive });
            const encodeMs = performance.now() - before;
            const decodeStart = performance.now(); assert.equal(decodeOrdered(result.encoded), bits);
            const key = label + (recursive ? 'Recursive' : 'Flat');
            row[key] = { bytes: result.encoded.length, hierarchicalBytes: result.hierarchicalBytes, encodeMs,
                decodeMs: performance.now() - decodeStart, states: result.states, layers: result.layers,
                literalBits: result.literalBits, literalMode: result.literalMode, container: result.container, trials: result.trials };
            fs.writeFileSync(new URL(`${name}-${key}.sulo`, directory), result.encoded);
        }
    }
    row.totalMs = performance.now() - start; report.fixtures.push(row);
    fs.writeFileSync(new URL('results.json', directory), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ name, input: bytes.length, nativeBit: row.nativeBitRecursiveBytes,
        rawBit: row.rawBitRecursive.bytes, rawByteFlat: row.rawByteFlat.bytes, rawByte: row.rawByteRecursive.bytes,
        byteLayers: row.rawByteRecursive.layers.map(layer => layer.level), seconds: +(row.totalMs / 1000).toFixed(2) }));
}
const fields = ['name','inputBytes','nativeBitFlatBytes','nativeBitRecursiveBytes','rawBitFlatBytes','rawBitRecursiveBytes','rawByteFlatBytes','rawByteRecursiveBytes','previousHybridBytes','arithmeticOnlyBytes','gzip9Bytes','brotli11Bytes','zstd19Bytes'];
const rows = report.fixtures.map(row => ({ ...row, rawBitFlatBytes: row.rawBitFlat.bytes, rawBitRecursiveBytes: row.rawBitRecursive.bytes, rawByteFlatBytes: row.rawByteFlat.bytes, rawByteRecursiveBytes: row.rawByteRecursive.bytes }));
fs.writeFileSync(new URL('summary.csv', directory), fields.join(',') + '\n' + rows.map(row => fields.map(key => row[key]).join(',')).join('\n') + '\n');
console.log('All 40 new encodings decoded exactly; all 10 reused fixture hashes matched.');
```

## sul-byte-experiment/cli.mjs

```javascript
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { symbolTree } from './levels.mjs';
import { bytesToBits, bitsToBytes } from '../sul-compression-research/sul-graph.mjs';
import { encodeOrdered, decodeOrdered } from '../sul-ordered-experiment/ordered.mjs';

const [command, input, output, width = '8'] = process.argv.slice(2);
if (!input || !output || !['compress', 'decompress'].includes(command)) throw new Error('Usage: node cli.mjs compress|decompress INPUT OUTPUT [1|8]');
const source = fs.readFileSync(input);
if (command === 'compress') {
    const bits = bytesToBits(source), { root } = symbolTree(bits, Number(width));
    const result = encodeOrdered(root, bits.length);
    assert.equal(decodeOrdered(result.encoded), bits);
    fs.writeFileSync(output, result.encoded);
    console.log(JSON.stringify({ inputBytes: source.length, outputBytes: result.encoded.length, width: Number(width), layers: result.layers }));
} else fs.writeFileSync(output, bitsToBytes(decodeOrdered(source)));
```

## sul-ordered-experiment/benchmark.mjs

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync, brotliCompressSync, brotliDecompressSync, zstdCompressSync, zstdDecompressSync, constants } from 'node:zlib';
import { fixtures as originalFixtures } from '../sul-compression-research/benchmark.mjs';
import { bytesToBits, buildGraph } from '../sul-compression-research/sul-graph.mjs';
import { encodeGraph, decodeDocument, arithmeticDocument, rawDocument } from '../sul-compression-research/codec.mjs';
import { wordTree, binaryTree } from './levels.mjs';
import { encodeOrdered, decodeOrdered } from './ordered.mjs';

const directory = new URL('./results/', import.meta.url); fs.mkdirSync(directory, { recursive: true });
const prior = JSON.parse(fs.readFileSync(new URL('../sul-compression-research/results/results.json', import.meta.url)));
const sentences = Array.from({ length: 16 }, (_, i) => `The immutable document from sensor ${i} shares a repeated sentence with the next revision.\n`);
const repeatedSentences = Buffer.from(Array.from({ length: 768 }, (_, i) => sentences[(i * 7 + (i >> 3)) % sentences.length]).join(''));
const uniqueSentences = Buffer.from(Array.from({ length: 768 }, (_, i) => `The immutable document from sensor ${i} shares a repeated phrase with the next revision.\n`).join(''));
export const fixtures = [...originalFixtures,
    ['repeated_sentences', repeatedSentences, '768 sentences drawn from 16 distinct sentences in deterministic mixed order; common phrases across sentence definitions.'],
    ['unique_sentences', uniqueSentences, '768 unique sentences with changing sensor numbers and common phrases; no identical full sentence.'],
];
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const report = { version: 2, node: process.version, sulCommit: prior.sulCommit, order: 'first occurrence', hierarchies: ['native SUL word generations', 'expanded Patricia subtree heights'], fixtures: [] };

for (const [name, bytes, description] of fixtures) {
    const start = performance.now(), bits = bytesToBits(bytes), sha256 = createHash('sha256').update(bytes).digest('hex');
    const beforeTree = performance.now(), { root, stats: wordLevels, paddedBits, captured } = wordTree(bits);
    const treeMs = performance.now() - beforeTree;
    const row = { name, description, inputBytes: bytes.length, sha256, treeMs, wordLevels, paddedBits };
    const binaryRoot = binaryTree(captured);
    row.binaryHeight = binaryRoot.level;
    for (const [family, tree] of [['word', root], ['binary', binaryRoot]]) for (const recursive of [false, true]) {
        const before = performance.now(), result = encodeOrdered(tree, bits.length, { recursive });
        const encodeMs = performance.now() - before;
        const decodeStart = performance.now(); assert.equal(decodeOrdered(result.encoded), bits);
        const label = (family === 'word' ? '' : 'binary') + (family === 'word' ? (recursive ? 'recursive' : 'flat') : (recursive ? 'Recursive' : 'Flat'));
        row[label] = { bytes: result.encoded.length, hierarchicalBytes: result.hierarchicalBytes, encodeMs, decodeMs: performance.now() - decodeStart, states: result.states, layers: result.layers, literalBits: result.literalBits, literalMode: result.literalMode, container: result.container, trials: result.trials };
        fs.writeFileSync(new URL(`${name}-${label}.sulo`, directory), result.encoded);
    }
    const previous = prior.fixtures.find(f => f.name === name);
    if (previous) {
        assert.equal(previous.sha256, sha256);
        row.previousGrammarBytes = previous.bestGrammarBytes;
        row.previousHybridBytes = previous.hybridBytes;
        row.arithmeticOnlyBytes = previous.arithmeticOnlyBytes;
        row.gzip9Bytes = previous.gzip9Bytes; row.brotli11Bytes = previous.brotli11Bytes; row.zstd19Bytes = previous.zstd19Bytes;
    } else {
        const plain = arithmeticDocument(bits); assert.equal(decodeDocument(plain), bits);
        row.arithmeticOnlyBytes = plain.length;
        let bestGrammar = Infinity, bestHybrid = Math.min(plain.length, rawDocument(bits).length);
        for (const expanded of [false, true]) {
            const { root: graph } = buildGraph(captured, expanded);
            for (const minimumBits of [16, 32, 64, 128, 256]) for (const arithmetic of [false, true]) {
                const { encoded } = encodeGraph(graph, bits.length, { minimumBits, arithmetic });
                assert.equal(decodeDocument(encoded), bits);
                if (arithmetic) bestGrammar = Math.min(bestGrammar, encoded.length);
                bestHybrid = Math.min(bestHybrid, encoded.length);
            }
        }
        row.previousGrammarBytes = bestGrammar; row.previousHybridBytes = bestHybrid;
        for (const [label, compress, decompress] of [
            ['gzip9', b => gzipSync(b, { level: 9 }), gunzipSync],
            ['brotli11', b => brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }), brotliDecompressSync],
            ['zstd19', b => zstdCompressSync(b, { params: { [constants.ZSTD_c_compressionLevel]: 19 } }), zstdDecompressSync],
        ]) {
            const encoded = compress(bytes); assert.deepEqual(decompress(encoded), bytes); row[label + 'Bytes'] = encoded.length;
        }
    }
    row.totalMs = performance.now() - start;
    report.fixtures.push(row);
    fs.writeFileSync(new URL('results.json', directory), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({name,input:bytes.length,old:row.previousHybridBytes,flat:row.flat.bytes,recursive:row.recursive.bytes,binaryFlat:row.binaryFlat.bytes,binaryRecursive:row.binaryRecursive.bytes,layers:row.recursive.layers.map(x=>x.level),literalBits:row.recursive.literalBits,seconds:+(row.totalMs/1000).toFixed(2)}));
}
const fields = ['name','inputBytes','previousGrammarBytes','previousHybridBytes','flatBytes','recursiveBytes','binaryFlatBytes','binaryRecursiveBytes','arithmeticOnlyBytes','gzip9Bytes','brotli11Bytes','zstd19Bytes'];
const rows = report.fixtures.map(r => ({...r,flatBytes:r.flat.bytes,recursiveBytes:r.recursive.bytes,binaryFlatBytes:r.binaryFlat.bytes,binaryRecursiveBytes:r.binaryRecursive.bytes}));
fs.writeFileSync(new URL('summary.csv', directory), fields.join(',')+'\n'+rows.map(r=>fields.map(k=>r[k]).join(',')).join('\n')+'\n');
console.log('All ordered outputs and newly computed baselines decoded exactly; prior fixture hashes matched.');
}
```
