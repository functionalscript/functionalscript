# Ordered dictionary prototype source

Verbatim source from [ordered-prototype.zip](ordered-prototype.zip). See
[the experiment report](ordered-dictionaries.md) for the algorithm and results.
The supporting original codec and arithmetic coder are unchanged from the
[earlier source listing](prototype.md); only its benchmark exports shared fixtures
and guards its direct execution. The updated benchmark is listed last.

## sul-ordered-experiment/levels.mjs

```js
// Preserve actual SUL word generations, rather than Patricia binary depth.
import { level, emptyEncodeState as emptyLiteral } from '../sul-compression-research/vendor/fjs/sul/level/literal/module.f.mjs';
import { encode as hashEncode, emptyEncodeState as emptyHash } from '../sul-compression-research/vendor/fjs/sul/level/hash/module.f.mjs';
import { capture, buildGraph, flatten as flattenGraph } from '../sul-compression-research/sul-graph.mjs';

export function flatten(node) {
    if (node.bits === undefined) node.bits = node.children.map(flatten).join('');
    return node.bits;
}

// The previous experiment's expanded Patricia graph, cut by subtree height.
// A frontier may include shorter nodes; those carry through until their height
// is reached, preserving their order and content while larger nodes expand.
export function binaryTree(captured) {
    const graph = buildGraph(captured, true), memo = new Map();
    const visit = node => {
        if (memo.has(node.id)) return memo.get(node.id);
        const children = node.left ? [visit(node.left), visit(node.right)] : undefined;
        const result = { key: `binary:${node.id}`, level: children ? 1 + Math.max(...children.map(x => x.level)) : 0, length: node.length, bits: node.bits, children };
        memo.set(node.id, result); return result;
    };
    return visit(graph.root);
}

export function wordTree(bits) {
    const captured = capture(bits);
    const padded = flattenGraph(buildGraph(captured).root);
    const leaves = [0, 1].map(value => ({ key: `0:${value}`, value: BigInt(value), level: 0, length: 1, bits: String(value) }));
    let sequence = [...padded].map(bit => leaves[Number(bit)]), generation = 0;
    const stats = [];
    while (generation < 3 || sequence.length > 1) {
        const literal = generation < 3;
        const step = literal ? level([0n, 2n, 7n][generation]).encode : hashEncode((_a, _b, _id, _symbol, storage) => storage);
        let state = literal ? emptyLiteral : emptyHash(null), pending = [];
        const next = [], interned = new Map();
        for (const child of sequence) {
            pending.push(child);
            const [value, newState] = step(child.value, state); state = newState;
            if (value === undefined) continue;
            let node = interned.get(value);
            if (!node) {
                node = { key: `${generation + 1}:${value}`, value, level: generation + 1, length: pending.reduce((n, x) => n + x.length, 0), children: pending };
                interned.set(value, node);
            }
            next.push(node); pending = [];
        }
        if (pending.length || !next.length || next.length >= sequence.length) throw new Error('SUL level did not finish or shrink');
        generation++;
        stats.push({ level: generation, symbols: next.length, unique: interned.size });
        sequence = next;
    }
    const root = sequence[0];
    if (root.value !== captured.root || flatten(root) !== padded) throw new Error('Word hierarchy differs from native SUL root');
    return { root, stats, paddedBits: padded.length, captured };
}
```

## sul-ordered-experiment/ordered.mjs

```js
// Research codec: first-occurrence dictionaries, jointly compressed below.
import { ArithmeticEncoder, ArithmeticDecoder, RawEncoder, RawDecoder, Writer, Reader } from '../sul-compression-research/arithmetic.mjs';
import { bitsToBytes, bytesToBits } from '../sul-compression-research/sul-graph.mjs';
import { flatten } from './levels.mjs';

const HEADER = 14;
const varint = n => {
    const bytes = [];
    do { const byte = n % 128; n = Math.floor(n / 128); bytes.push(byte + (n ? 128 : 0)); } while (n);
    return Buffer.from(bytes);
};

function literal(bits) {
    const coder = new ArithmeticEncoder(); new Writer(coder).literals(bits);
    const prefix = varint(bits.length);
    const candidates = [
        { encoded: Buffer.concat([Buffer.from([0]), prefix, bitsToBytes(bits)]), literalMode: 'raw' },
        { encoded: Buffer.concat([Buffer.from([1]), prefix, coder.finish()]), literalMode: 'arithmetic' },
    ];
    return { ...candidates.sort((a, b) => a.encoded.length - b.encoded.length)[0], layers: [], literalBits: bits.length };
}

// Binary decision-tree contexts model the reference alphabet directly. The
// first occurrence introduces the next ID implicitly; only old IDs need bits.
function writeReference(coder, value, count) {
    const width = Math.ceil(Math.log2(count));
    let prefix = 1;
    for (let bit = width - 1; bit >= 0; bit--) {
        const v = (value >>> bit) & 1;
        coder.bit(v, 2048 + prefix); prefix = prefix * 2 + v;
    }
}
function readReference(coder, count) {
    const width = Math.ceil(Math.log2(count));
    let value = 0, prefix = 1;
    for (let bit = width - 1; bit >= 0; bit--) {
        const v = coder.bit(2048 + prefix); value = value * 2 + v; prefix = prefix * 2 + v;
    }
    if (value >= count) throw new Error('Reference outside dictionary');
    return value;
}

export function dictionary(sequence) {
    const ids = new Map(), entries = [], references = [];
    for (const node of sequence) {
        if (!ids.has(node.key)) { ids.set(node.key, entries.length); entries.push(node); }
        references.push(ids.get(node.key));
    }
    return { entries, references };
}

const lower = (sequence, ceiling) => sequence.flatMap(node => node.level > ceiling ? node.children : [node]);

function recipe(entries, references, arithmetic) {
    const coder = arithmetic ? new ArithmeticEncoder() : new RawEncoder(), writer = new Writer(coder);
    writer.uint(references.length, 64); writer.uint(entries.length, 128);
    for (const node of entries) writer.uint(node.length, 256);
    let seen = 0;
    for (const id of references) {
        const fresh = id === seen;
        if (seen > 0 && seen < entries.length) coder.bit(Number(fresh), 0);
        if (fresh) seen++;
        else writeReference(coder, id, seen);
    }
    return coder.finish();
}

// A skip needs no stream marker: the lower-level recipe reconstructs the same
// bits. Both a level's recipe and its recursively compressed dictionary count
// toward the decision. Separate streams make these candidate costs additive.
export function encodeOrdered(root, originalLength, { recursive = true, recipeModes = [false, true] } = {}) {
    const memo = new Map(), trials = [];
    const compress = (source, ceiling) => {
        const key = `${ceiling}|${source.map(node => node.key).join(',')}`;
        if (memo.has(key)) return memo.get(key);
        const bits = source.map(flatten).join('');
        let best = literal(bits), sequence = source;
        if (ceiling >= 0) sequence = lower(source, ceiling);
        for (let generation = ceiling; generation >= 0; generation--) {
            if (sequence.some(node => node.level > generation)) throw new Error('Invalid hierarchy frontier');
            const { entries, references } = dictionary(sequence);
            if (entries.length < sequence.length) {
                const lower = recursive ? compress(entries, generation - 1) : literal(entries.map(flatten).join(''));
                for (const arithmetic of recipeModes) {
                    const data = recipe(entries, references, arithmetic);
                    const prefix = Buffer.concat([Buffer.from([arithmetic ? 3 : 2]), varint(data.length), data]);
                    const bytes = prefix.length + lower.encoded.length;
                    trials.push({ sourceCeiling: ceiling, level: generation, symbols: sequence.length, entries: entries.length, recipeMode: arithmetic ? 'arithmetic' : 'raw', recipeBytes: prefix.length, dictionaryBytes: lower.encoded.length, totalBytes: bytes });
                    if (bytes < best.encoded.length) best = {
                        encoded: Buffer.concat([prefix, lower.encoded]),
                        layers: [{ level: generation, symbols: sequence.length, entries: entries.length, recipeMode: arithmetic ? 'arithmetic' : 'raw', recipeBytes: prefix.length, dictionaryBits: entries.reduce((sum, node) => sum + node.length, 0), dictionaryBytes: lower.encoded.length }, ...lower.layers],
                        literalBits: lower.literalBits, literalMode: lower.literalMode,
                    };
                }
            }
            if (generation > 0) sequence = lower(sequence, generation - 1);
        }
        memo.set(key, best); return best;
    };
    if (!Number.isSafeInteger(originalLength) || originalLength < 0 || originalLength > root.length || originalLength >= 2 ** 32) throw new Error('Invalid original length');
    let result = compress([root], root.level);
    const hierarchicalBytes = HEADER + result.encoded.length;
    const header = Buffer.alloc(HEADER); header.write('SULO'); header[4] = 1; header[5] = Number(originalLength < root.length);
    const original = flatten(root).slice(0, originalLength);
    const coder = new ArithmeticEncoder(); new Writer(coder).literals(original);
    for (const [mode, payload, literalMode] of [[2, bitsToBytes(original), 'raw'], [3, coder.finish(), 'arithmetic']]) {
        if (payload.length < result.encoded.length) {
            header[5] = mode;
            result = { encoded: payload, layers: [], literalBits: originalLength, literalMode };
        }
    }
    header.writeUInt32BE(originalLength, 6); header.writeUInt32BE(result.encoded.length, 10);
    return { ...result, encoded: Buffer.concat([header, result.encoded]), trials, states: memo.size, recursive, hierarchicalBytes, container: header[5] >= 2 ? 'document' : 'layers' };
}

export function decodeOrdered(buffer, { maxOutputBits = 64 * 1024 * 1024 } = {}) {
    if (buffer.length < HEADER || buffer.subarray(0, 4).toString() !== 'SULO' || buffer[4] !== 1 || buffer[5] > 3) throw new Error('Bad ordered-codec frame');
    const originalLength = buffer.readUInt32BE(6), padded = buffer[5] === 1;
    if (originalLength > maxOutputBits || buffer.readUInt32BE(10) !== buffer.length - HEADER) throw new Error('Length limit or truncated frame');
    if (buffer[5] >= 2) {
        const payload = buffer.subarray(HEADER);
        if (buffer[5] === 3) return new Reader(new ArithmeticDecoder(payload)).literals(originalLength);
        if (payload.length !== Math.ceil(originalLength / 8)) throw new Error('Raw document length');
        return bytesToBits(payload).slice(0, originalLength);
    }
    const limit = Math.min(maxOutputBits + 65536, originalLength * 16 + 65536);
    let offset = HEADER;
    const integer = () => {
        let value = 0, factor = 1;
        for (let i = 0; i < 5; i++) {
            if (offset >= buffer.length) throw new Error('Truncated integer');
            const byte = buffer[offset++]; value += (byte & 127) * factor;
            if (value >= 2 ** 32) throw new Error('Integer limit');
            if (byte < 128) return value;
            factor *= 128;
        }
        throw new Error('Integer limit');
    };
    const visit = (depth = 0) => {
        if (depth > 64 || offset >= buffer.length) throw new Error('Invalid nesting');
        const mode = buffer[offset++];
        if (mode < 2) {
            const length = integer(); if (length > limit) throw new Error('Literal limit');
            const payload = buffer.subarray(offset); offset = buffer.length;
            if (mode === 0) {
                if (payload.length !== Math.ceil(length / 8)) throw new Error('Raw literal length');
                return bytesToBits(payload).slice(0, length);
            }
            return new Reader(new ArithmeticDecoder(payload)).literals(length);
        }
        if (mode > 3) throw new Error('Unknown ordered-codec mode');
        const size = integer(); if (size > buffer.length - offset) throw new Error('Truncated recipe');
        const payload = buffer.subarray(offset, offset + size); offset += size;
        const coder = mode === 3 ? new ArithmeticDecoder(payload) : new RawDecoder(payload), reader = new Reader(coder);
        const count = reader.uint(64), entries = reader.uint(128);
        if (!entries || entries >= count || count > limit) throw new Error('Invalid recipe counts');
        const lengths = []; let dictionaryBits = 0;
        for (let i = 0; i < entries; i++) {
            const length = reader.uint(256); if (!length || (dictionaryBits += length) > limit) throw new Error('Dictionary limit');
            lengths.push(length);
        }
        const refs = []; let seen = 0, outputBits = 0;
        for (let i = 0; i < count; i++) {
            const fresh = seen === 0 || (seen < entries && coder.bit(0) === 1);
            const id = fresh ? seen++ : readReference(coder, seen);
            outputBits += lengths[id]; if (outputBits > limit) throw new Error('Expansion limit');
            refs.push(id);
        }
        if (seen !== entries) throw new Error('Unused dictionary entry');
        const content = visit(depth + 1);
        if (content.length !== dictionaryBits) throw new Error('Dictionary length mismatch');
        const dictionary = []; let position = 0;
        for (const length of lengths) { dictionary.push(content.slice(position, position + length)); position += length; }
        return refs.map(id => dictionary[id]).join('');
    };
    const bits = visit();
    if (padded ? !/^10*$/.test(bits.slice(originalLength)) : bits.length !== originalLength) throw new Error('Invalid document length or SUL padding');
    return bits.slice(0, originalLength);
}
```

## sul-ordered-experiment/test.mjs

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { wordTree, binaryTree, flatten } from './levels.mjs';
import { encodeOrdered, decodeOrdered, dictionary } from './ordered.mjs';

test('every short bitstring preserves native SUL identity and round-trips', () => {
    for (let length = 0; length <= 8; length++) for (let value = 0; value < 2 ** length; value++) {
        const bits = length ? value.toString(2).padStart(length, '0') : '';
        const { root } = wordTree(bits);
        for (const recursive of [false, true]) {
            const result = encodeOrdered(root, bits.length, { recursive });
            assert.equal(decodeOrdered(result.encoded), bits);
            assert.ok(result.encoded.length <= 14 + Math.ceil(bits.length / 8));
        }
    }
});

const fixtureTree = () => {
    let seed = 123456789;
    const random = n => Array.from({ length: n }, () => {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        return String((seed >>> 0) & 1);
    }).join('');
    const a = { key: 'a', level: 0, length: 512, bits: random(512) };
    const b = { key: 'b', level: 0, length: 512, bits: random(512) };
    const c = { key: 'c', level: 0, length: 512, bits: random(512) };
    const parents = [[a, b, a, c], [b, c, a, b], [c, a, b, a]].map((children, i) => ({ key: `p${i}`, level: 1, length: 2048, children }));
    const sequence = Array.from({ length: 256 }, (_, i) => parents[(i * 7 + (i >> 2)) % 3]);
    return { root: { key: 'root', level: 2, length: sequence.length * 2048, children: sequence }, parents, sequence };
};

test('dictionary follows first occurrence and recursively compresses shared child contents', () => {
    const { root, parents, sequence } = fixtureTree();
    const d = dictionary(sequence);
    assert.deepEqual(d.entries, [parents[0], parents[1], parents[2]]);
    assert.deepEqual(d.references.slice(0, 4), [0, 1, 2, 0]);
    const flat = encodeOrdered(root, root.length, { recursive: false });
    const recursive = encodeOrdered(root, root.length);
    assert.equal(decodeOrdered(flat.encoded), flatten(root));
    assert.equal(decodeOrdered(recursive.encoded), flatten(root));
    assert.ok(recursive.encoded.length < flat.encoded.length);
    assert.deepEqual(recursive.layers.map(layer => layer.level), [1, 0]);
});

test('unique upper-level entries do not prevent deduplication at a lower level', () => {
    const { parents } = fixtureTree();
    const root = { key: 'unique-root', level: 2, length: 6144, children: parents };
    const result = encodeOrdered(root, root.length);
    assert.equal(decodeOrdered(result.encoded), flatten(root));
    assert.deepEqual(result.layers.map(layer => layer.level), [0]);
});

test('raw recipe streams also decode nested dictionaries', () => {
    const { root } = fixtureTree();
    const result = encodeOrdered(root, root.length, { recipeModes: [false] });
    assert.equal(decodeOrdered(result.encoded), flatten(root));
    assert.ok(result.layers.length > 1);
    assert.ok(result.layers.every(layer => layer.recipeMode === 'raw'));
});

test('large SUL input with a non-byte-aligned ending round-trips', () => {
    const bits = '001001110101101'.repeat(1024) + '101';
    const { root } = wordTree(bits);
    const result = encodeOrdered(root, bits.length);
    assert.equal(decodeOrdered(result.encoded), bits);
    assert.throws(() => decodeOrdered(result.encoded.subarray(0, -1)));
    assert.throws(() => decodeOrdered(result.encoded, { maxOutputBits: bits.length - 1 }));
});

test('expanded Patricia frontiers carry shorter subtrees and preserve bits', () => {
    const bits = '010110001101'.repeat(2048) + '11001';
    const { captured } = wordTree(bits), root = binaryTree(captured);
    for (const recursive of [false, true]) {
        const result = encodeOrdered(root, bits.length, { recursive });
        assert.equal(decodeOrdered(result.encoded), bits);
    }
});
```

## sul-ordered-experiment/benchmark.mjs

```js
import fs from 'node:fs';
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
const fixtures = [...originalFixtures,
    ['repeated_sentences', repeatedSentences, '768 sentences drawn from 16 distinct sentences in deterministic mixed order; common phrases across sentence definitions.'],
    ['unique_sentences', uniqueSentences, '768 unique sentences with changing sensor numbers and common phrases; no identical full sentence.'],
];
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
```

## sul-ordered-experiment/cli.mjs

```js
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { bytesToBits, bitsToBytes } from '../sul-compression-research/sul-graph.mjs';
import { wordTree, binaryTree } from './levels.mjs';
import { encodeOrdered, decodeOrdered } from './ordered.mjs';

const [action, input, output] = process.argv.slice(2);
if (!input || !output || !['compress', 'decompress'].includes(action)) throw new Error('Usage: node cli.mjs compress|decompress INPUT OUTPUT');
if (action === 'compress') {
    const bits = bytesToBits(fs.readFileSync(input)), { root, captured } = wordTree(bits);
    const candidates = [['word', root], ['binary', binaryTree(captured)]].map(([family, tree]) => ({ ...encodeOrdered(tree, bits.length), family }));
    const result = candidates.sort((a, b) => a.encoded.length - b.encoded.length)[0];
    assert.equal(decodeOrdered(result.encoded), bits);
    fs.writeFileSync(output, result.encoded);
    console.log(JSON.stringify({ bytes: result.encoded.length, family: result.family, levels: result.layers.map(x=>x.level), literalMode: result.literalMode }));
} else fs.writeFileSync(output, bitsToBytes(decodeOrdered(fs.readFileSync(input))));
```

## sul-compression-research/benchmark.mjs

```js
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync, brotliCompressSync, brotliDecompressSync, zstdCompressSync, zstdDecompressSync, constants } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { capture, buildGraph, bytesToBits, reachable } from './sul-graph.mjs';
import { arithmeticDocument, rawDocument, encodeGraph, decodeDocument } from './codec.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(directory, 'results'); fs.mkdirSync(output, { recursive: true });
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en')).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const randomBytes = (length, initial) => {
    let seed = initial; const result = Buffer.alloc(length);
    for (let i = 0; i < length; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; result[i] = (seed >>> 0) & 255; }
    return result;
};
const repeatTo = (buffer, size) => Buffer.concat(Array.from({ length: Math.ceil(size / buffer.length) }, () => buffer)).subarray(0, size);
const sourcePaths = walk(path.join(directory, 'vendor')).filter(p => p.endsWith('.mjs'));
const source = Buffer.concat(sourcePaths.map(p => fs.readFileSync(p))).subarray(0, 65536);
const recordRows = Array.from({ length: 640 }, (_, i) => JSON.stringify({ id: i, type: 'measurement', sensor: i % 16, timestamp: 1700000000 + i, value: (i * 37) % 1000, status: i % 9 ? 'ok' : 'retry' }) + '\n');
const exactBlock = randomBytes(4096, 91234);
const versions = [];
for (let i = 0; i < 32; i++) { const v = Buffer.from(exactBlock); v[(i * 113) % v.length] ^= (i + 1); versions.push(v); }
const biased = Buffer.alloc(65536), noise = randomBytes(65536, 7890);
for (let i = 0; i < biased.length; i++) if (noise[i] < 20) biased[i] = 1 << (noise[i] & 7);
let recursive = '0'; for (let i = 0; i < 16; i++) recursive += [...recursive].map(x => x === '0' ? '1' : '0').join('');
export const fixtures = [
    ['source_code', source, 'First 64 KiB of sorted concatenated vendored FunctionalScript modules, including proofs.'],
    ['json_records', Buffer.from(recordRows.join('')), '640 generated JSON records with changing numeric fields.'],
    ['repeated_phrase', repeatTo(Buffer.from('Immutable documents share identical subtrees. Arithmetic coding represents frequent events with fewer bits.\n'), 65536), 'One 108-byte phrase repeated and truncated.'],
    ['repeated_random_block', repeatTo(exactBlock, 131072), 'A generated 4 KiB pseudorandom block repeated 32 times.'],
    ['edited_versions', Buffer.concat(versions), '32 versions of that 4 KiB block; each has one independent byte substitution.'],
    ['recursive_sequence', Buffer.from(recursive), '16 Thue-Morse expansion rounds, stored as ASCII 0/1.'],
    ['biased_bits', biased, 'Generated sparse bytes: approximately 1% of bits are set.'],
    ['uniform_random', randomBytes(65536, 123456789), 'Xorshift32 pseudorandom byte stream; incompressibility control.'],
];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const report = { version: 1, node: process.version, sulCommit: 'd16a9ebf39b30a42e1b795bc329774d867196841', minRuleBits: [16, 32, 64, 128, 256], fixtures: [] };
for (const [name, bytes, description] of fixtures) {
    const bits = bytesToBits(bytes), start = performance.now(), captured = capture(bits), captureMs = performance.now() - start;
    const row = { name, description, inputBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), captureMs, candidates: [] };
    const plain = arithmeticDocument(bits); assert.equal(decodeDocument(plain), bits); row.arithmeticOnlyBytes = plain.length;
    for (const [family, expanded] of [['native', false], ['expanded', true]]) {
        const graphStart = performance.now(), { root } = buildGraph(captured, expanded);
        row[family + 'GraphMs'] = performance.now() - graphStart;
        row[family + 'UniqueNodes'] = reachable(root).length;
        for (const minimumBits of report.minRuleBits) {
            for (const arithmetic of [false, true]) {
                const before = performance.now();
                const { encoded, stats } = encodeGraph(root, bits.length, { minimumBits, arithmetic });
                const encodeMs = performance.now() - before, decodeStart = performance.now();
                assert.equal(decodeDocument(encoded), bits);
                const candidate = { family, minimumBits, arithmetic, bytes: encoded.length, encodeMs, decodeMs: performance.now() - decodeStart, ...stats };
                row.candidates.push(candidate);
                fs.writeFileSync(path.join(output, `${name}-${family}-${minimumBits}-${arithmetic ? 'arith' : 'raw'}.sulc`), encoded);
            }
        }
    }
    for (const [label, compress, decompress] of [
        ['gzip9', b => gzipSync(b, { level: 9 }), gunzipSync],
        ['brotli5', b => brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }), brotliDecompressSync],
        ['brotli11', b => brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }), brotliDecompressSync],
        ['zstd3', b => zstdCompressSync(b, { params: { [constants.ZSTD_c_compressionLevel]: 3 } }), zstdDecompressSync],
        ['zstd19', b => zstdCompressSync(b, { params: { [constants.ZSTD_c_compressionLevel]: 19 } }), zstdDecompressSync]
    ]) {
        const before = performance.now(), compressed = compress(bytes);
        row[label + 'Bytes'] = compressed.length; row[label + 'Ms'] = performance.now() - before;
        assert.deepEqual(decompress(compressed), bytes);
    }
    const best = (family, arithmetic) => row.candidates.filter(c => c.family === family && c.arithmetic === arithmetic).sort((a, b) => a.bytes - b.bytes)[0];
    row.nativeRaw = best('native', false); row.nativeArithmetic = best('native', true);
    row.expandedRaw = best('expanded', false); row.expandedArithmetic = best('expanded', true);
    row.bestGrammarBytes = Math.min(row.nativeArithmetic.bytes, row.expandedArithmetic.bytes);
    row.hybridBytes = Math.min(row.bestGrammarBytes, row.nativeRaw.bytes, row.expandedRaw.bytes, plain.length, rawDocument(bits).length);
    row.totalMs = performance.now() - start;
    report.fixtures.push(row);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ name, input: bytes.length, native: row.nativeArithmetic.bytes, expanded: row.expandedArithmetic.bytes, arithmetic: plain.length, hybrid: row.hybridBytes, gzip: row.gzip9Bytes, brotli11: row.brotli11Bytes, zstd19: row.zstd19Bytes, seconds: +(row.totalMs / 1000).toFixed(2) }));
}
const fields = ['name', 'inputBytes', 'arithmeticOnlyBytes', 'bestGrammarBytes', 'hybridBytes', 'gzip9Bytes', 'brotli5Bytes', 'brotli11Bytes', 'zstd3Bytes', 'zstd19Bytes', 'captureMs', 'totalMs'];
fs.writeFileSync(path.join(output, 'summary.csv'), fields.join(',') + '\n' + report.fixtures.map(r => fields.map(k => r[k]).join(',')).join('\n') + '\n');
console.log('All compressed candidates and baseline outputs reconstructed the original inputs.');
}
```
