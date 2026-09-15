# Brotli dictionary level-zero prototype source

These research files are archived for review and reproduction, not installed as
production FunctionalScript modules. The ordered codec and adaptive arithmetic
coder are unchanged and included in the archive.

## sul-brotli-experiment/dictionary.mjs

```javascript
import fs from 'node:fs';
import { createHash } from 'node:crypto';

export const manifest = JSON.parse(fs.readFileSync(new URL('./vendor/brotli/manifest.json', import.meta.url)));
const data = fs.readFileSync(new URL('./vendor/brotli/c/common/dictionary.bin', import.meta.url));
const metadata = fs.readFileSync(new URL('./vendor/brotli/metadata.json', import.meta.url));
const sha = data => createHash('sha256').update(data).digest('hex');
if (sha(data) !== manifest.dictionarySha256 || sha(metadata) !== manifest.metadataSha256) throw new Error('Static dictionary snapshot mismatch');
const table = JSON.parse(metadata);
const affixes = table.affixes.map(hex => Buffer.from(hex, 'hex'));
export const words = [];
for (let length = 4; length <= 24; length++) for (let index = 0; index < 2 ** table.sizeBits[length]; index++) {
    const offset = table.offsets[length] + index * length;
    words.push(data.subarray(offset, offset + length));
}
export const transformCount = table.transforms.length;

// Brotli's byte operations, including its specified non-Unicode casing rule.
function upper(bytes, offset) {
    if (bytes[offset] < 0xc0) {
        if (bytes[offset] >= 97 && bytes[offset] <= 122) bytes[offset] ^= 32;
        return 1;
    }
    if (bytes[offset] < 0xe0) { bytes[offset + 1] ^= 32; return 2; }
    bytes[offset + 2] ^= 5; return 3;
}
export function transform(wordIndex, transformIndex = 0) {
    if (!Number.isInteger(wordIndex) || !words[wordIndex] || !Number.isInteger(transformIndex) || !table.transforms[transformIndex]) throw new Error('Invalid static dictionary reference');
    const [prefix, type, suffix] = table.transforms[transformIndex];
    let word = words[wordIndex];
    if (type <= 9) word = word.subarray(0, Math.max(0, word.length - type));
    else if (type >= 12 && type <= 20) word = word.subarray(Math.min(word.length, type - 11));
    else if (type === 10 || type === 11) {
        word = Buffer.from(word);
        if (type === 10) upper(word, 0);
        else for (let offset = 0; offset < word.length;) offset += upper(word, offset);
    } else throw new Error('Unsupported transform');
    return Buffer.concat([affixes[prefix], word, affixes[suffix]]);
}

// Fixed IDs: 0..255 are literal bytes; dictionary IDs are transform-major.
// Base-word order follows the official length buckets and their entry order.
export const tokenWidth = transforms => transforms ? 21 : 14;
export function expand(id, transforms = true) {
    const limit = 256 + words.length * (transforms ? transformCount : 1);
    if (!Number.isInteger(id) || id < 0 || id >= limit) throw new Error('Invalid token ID');
    if (id < 256) return Buffer.from([id]);
    return transform((id - 256) % words.length, Math.floor((id - 256) / words.length));
}

const caches = new Map();
export function tokenIndex(transforms = true) {
    if (caches.has(transforms)) return caches.get(transforms);
    const map = new Map(); let maxLength = 1;
    for (let tr = 0; tr < (transforms ? transformCount : 1); tr++) for (let index = 0; index < words.length; index++) {
        const word = transform(index, tr);
        // Empty forms cannot advance a parse; one-byte aliases use literal IDs.
        if (word.length < 2) continue;
        const text = word.toString('latin1');
        if (!map.has(text)) map.set(text, 256 + tr * words.length + index);
        maxLength = Math.max(maxLength, word.length);
    }
    const result = { map, maxLength }; caches.set(transforms, result); return result;
}

// Minimum token count for fixed-width token IDs. Ties prefer longer matches,
// then the smallest ID for the same expansion. This is not an optimizer for
// the eventual adaptive arithmetic / hierarchical compressed size.
export function tokenize(bytes, transforms = true) {
    const { map, maxLength } = tokenIndex(transforms), text = bytes.toString('latin1');
    const costs = new Uint32Array(bytes.length + 1), ids = new Uint32Array(bytes.length), spans = new Uint8Array(bytes.length);
    for (let offset = bytes.length - 1; offset >= 0; offset--) {
        costs[offset] = 1 + costs[offset + 1]; ids[offset] = bytes[offset]; spans[offset] = 1;
        for (let size = 2; size <= Math.min(maxLength, bytes.length - offset); size++) {
            const id = map.get(text.slice(offset, offset + size));
            if (id !== undefined && 1 + costs[offset + size] <= costs[offset]) {
                costs[offset] = 1 + costs[offset + size]; ids[offset] = id; spans[offset] = size;
            }
        }
    }
    const tokens = []; let dictionaryBytes = 0, dictionaryTokens = 0, transformedTokens = 0;
    for (let offset = 0; offset < bytes.length; offset += spans[offset]) {
        const id = ids[offset]; tokens.push(id);
        if (id >= 256) { dictionaryTokens++; dictionaryBytes += spans[offset]; }
        if (id >= 256 + words.length) transformedTokens++;
    }
    return { tokens, dictionaryBytes, dictionaryTokens, transformedTokens, literalTokens: tokens.length - dictionaryTokens };
}

export const tokensToBits = (tokens, transforms = true) => tokens.map(id => id.toString(2).padStart(tokenWidth(transforms), '0')).join('');
export function restore(bits, transforms = true, maxBytes = 8 * 1024 * 1024) {
    const width = tokenWidth(transforms);
    if (bits.length % width) throw new Error('Incomplete token');
    const chunks = []; let length = 0;
    for (let offset = 0; offset < bits.length; offset += width) {
        const chunk = expand(parseInt(bits.slice(offset, offset + width), 2), transforms);
        if (!chunk.length || (length += chunk.length) > maxBytes) throw new Error('Invalid or excessive token expansion');
        chunks.push(chunk);
    }
    return Buffer.concat(chunks, length);
}
```

## sul-brotli-experiment/codec.mjs

```javascript
import { ArithmeticEncoder, ArithmeticDecoder, Writer, Reader } from '../sul-compression-research/arithmetic.mjs';
import { bytesToBits, bitsToBytes } from '../sul-compression-research/sul-graph.mjs';
import { fixedSymbolTree } from '../sul-byte-experiment/levels.mjs';
import { encodeOrdered, decodeOrdered } from '../sul-ordered-experiment/ordered.mjs';
import { tokenize, tokenWidth, tokensToBits, restore } from './dictionary.mjs';

const HEADER = 14;
function frame(mode, payload, originalBytes) {
    const header = Buffer.alloc(HEADER); header.write('SULD'); header[4] = 1; header[5] = mode;
    header.writeUInt32BE(originalBytes, 6); header.writeUInt32BE(payload.length, 10);
    return Buffer.concat([header, payload]);
}

export function prepare(bytes, transforms = true) {
    const start = performance.now(), parsed = tokenize(bytes, transforms);
    const bits = tokensToBits(parsed.tokens, transforms), tokenizeMs = performance.now() - start;
    const treeStart = performance.now(), tree = fixedSymbolTree(bits, tokenWidth(transforms));
    return { parsed, bits, tree, tokenizeMs, treeMs: performance.now() - treeStart };
}

export function encodeDictionary(bytes, { transforms = true, kind = 'recursive', prepared = prepare(bytes, transforms) } = {}) {
    if (!['direct','flat','recursive'].includes(kind)) throw new Error('Unknown experiment mode');
    const { bits, tree } = prepared;
    const root = kind === 'direct' ? { key: 'direct', level: 0, length: bits.length, bits } : tree.root;
    const result = encodeOrdered(root, bits.length, { recursive: kind === 'recursive' });
    const candidate = frame(transforms ? 3 : 2, result.encoded, bytes.length);
    const coder = new ArithmeticEncoder(); new Writer(coder).literals(bytesToBits(bytes));
    let encoded = candidate, selected = 'dictionary';
    for (const [mode, payload, label] of [[0, bytes, 'raw'], [1, coder.finish(), 'arithmetic']]) {
        const fallback = frame(mode, payload, bytes.length);
        if (fallback.length < encoded.length) { encoded = fallback; selected = label; }
    }
    return { encoded, candidate, candidateBytes: candidate.length, selected, result };
}

export function decodeDictionary(buffer, { maxOutputBytes = 8 * 1024 * 1024 } = {}) {
    if (buffer.length < HEADER || buffer.subarray(0, 4).toString() !== 'SULD' || buffer[4] !== 1 || buffer[5] > 3) throw new Error('Bad dictionary frame');
    const length = buffer.readUInt32BE(6), payload = buffer.subarray(HEADER), mode = buffer[5];
    if (length > maxOutputBytes || buffer.readUInt32BE(10) !== payload.length) throw new Error('Frame length or output limit');
    let decoded;
    if (mode === 0) decoded = payload;
    else if (mode === 1) decoded = bitsToBytes(new Reader(new ArithmeticDecoder(payload)).literals(length * 8));
    else {
        // At most one token per input byte for valid streams; this also caps
        // intermediate expansion before converting IDs into dictionary strings.
        const tokenLimit = length * tokenWidth(mode === 3);
        // The builder can append up to max(65536, 4 * tokenBits) padding
        // bits. Allow that intermediate expansion, then bound unpadded IDs.
        const tokenBits = decodeOrdered(payload, { maxOutputBits: 5 * tokenLimit + 65536 });
        if (tokenBits.length > tokenLimit) throw new Error('Excessive token count');
        decoded = restore(tokenBits, mode === 3, length);
    }
    if (decoded.length !== length) throw new Error('Decoded document length mismatch');
    return decoded;
}
```

## sul-brotli-experiment/test.mjs

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { words, transformCount, transform, tokenize, tokensToBits, restore, expand, manifest } from './dictionary.mjs';
import { prepare, encodeDictionary, decodeDictionary } from './codec.mjs';
import { fixtures } from '../sul-ordered-experiment/benchmark.mjs';

test('all 1,633,984 base-word/transform combinations match the pinned C oracle', () => {
    assert.equal(words.length, 13504); assert.equal(transformCount, 121);
    const hash = createHash('sha256'); let bytes = 0;
    for (let tr = 0; tr < transformCount; tr++) for (let index = 0; index < words.length; index++) {
        const word = transform(index, tr); hash.update(Buffer.from([word.length])); hash.update(word); bytes += 1 + word.length;
    }
    assert.equal(bytes, manifest.oracleStreamBytes);
    assert.equal(hash.digest('hex'), manifest.oracleSha256);
});

test('base words, transformed forms, and arbitrary byte content tokenize losslessly', () => {
    const inputs = [Buffer.alloc(0), Buffer.from(Array.from({ length: 256 }, (_, i) => i)), Buffer.from('Time TIME time, the document contains information.\n'), Buffer.from('Привет 世界 café\0\xff', 'utf8')];
    for (const transforms of [false, true]) for (const bytes of inputs) {
        const parsed = tokenize(bytes, transforms);
        assert.deepEqual(restore(tokensToBits(parsed.tokens, transforms), transforms), bytes);
    }
    assert.deepEqual(expand(256, false), Buffer.from('time'));
    assert.equal(tokenize(Buffer.from('time'), false).tokens.length, 1);
    assert.ok(tokenize(Buffer.from('TIME '), true).transformedTokens > 0);
});

test('direct, flat, and recursive dictionary frames and their candidates decode exactly', () => {
    for (const bytes of [Buffer.alloc(0), Buffer.from([0,255,128]), Buffer.from('The immutable document shares a repeated sentence.\n'.repeat(128))]) {
        for (const transforms of [false, true]) {
            const prepared = prepare(bytes, transforms);
            const sizes = [];
            for (const kind of ['direct','flat','recursive']) {
                const result = encodeDictionary(bytes, { transforms, kind, prepared });
                assert.deepEqual(decodeDictionary(result.encoded), bytes);
                assert.deepEqual(decodeDictionary(result.candidate), bytes);
                assert.ok(result.encoded.length <= bytes.length + 14);
                sizes.push(result.encoded.length);
            }
            assert.ok(sizes[2] <= sizes[1]);
        }
    }
});

test('malformed references, partial tokens, frames, and expansion limits are refused', () => {
    assert.throws(() => expand(256 + words.length, false));
    assert.throws(() => expand(-1));
    assert.throws(() => restore('1'));
    assert.throws(() => restore(tokensToBits([256]), true, 3));
    const result = encodeDictionary(Buffer.from('time time time'));
    assert.throws(() => decodeDictionary(result.encoded.subarray(0, -1)));
    assert.throws(() => decodeDictionary(result.encoded, { maxOutputBytes: 1 }));
    const bad = Buffer.from(result.encoded); bad[4] = 2;
    assert.throws(() => decodeDictionary(bad));
});

test('intermediate token padding may exceed the original token-count budget', () => {
    const bytes = fixtures.find(([name]) => name === 'repeated_random_block')[1];
    const prepared = prepare(bytes, false);
    assert.ok(prepared.tree.paddedBits > bytes.length * 14 + 65536);
    const result = encodeDictionary(bytes, { transforms: false, prepared });
    assert.deepEqual(decodeDictionary(result.candidate), bytes);
});
```

## sul-brotli-experiment/benchmark.mjs

```javascript
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync, brotliCompressSync, brotliDecompressSync, zstdCompressSync, zstdDecompressSync, constants } from 'node:zlib';
import { fixtures as previousFixtures } from '../sul-ordered-experiment/benchmark.mjs';
import { bytesToBits } from '../sul-compression-research/sul-graph.mjs';
import { symbolTree } from '../sul-byte-experiment/levels.mjs';
import { encodeOrdered, decodeOrdered } from '../sul-ordered-experiment/ordered.mjs';
import { tokenIndex, manifest } from './dictionary.mjs';
import { prepare, encodeDictionary, decodeDictionary } from './codec.mjs';

const prior = JSON.parse(fs.readFileSync(new URL('../sul-byte-experiment/results/results.json', import.meta.url)));
const fixtures = [...previousFixtures,
    ['short_text', Buffer.from('The document contains information about the project. Please contact the development team for additional information and support. All rights reserved.\n'), 'One short English document, designed to exercise preexisting dictionary entries.'],
    ['short_html', Buffer.from('<!DOCTYPE html><html><head><title>Example document</title></head><body><h1>Information</h1><p>Welcome to the website.</p></body></html>\n'), 'One short HTML document with common markup.'],
];
const directory = new URL('./results/', import.meta.url); fs.mkdirSync(directory, { recursive: true });
const report = { version: 4, node: process.version, sulCommit: prior.sulCommit, brotli: manifest,
    tokenizer: 'minimum fixed-width token count; tie longer span then lowest ID',
    leafWidths: { base: 14, full: 21 }, sharedDictionary: 'pinned decoder resource; not sent per file', indexes: {}, fixtures: [] };
for (const [label, transforms] of [['base', false], ['full', true]]) {
    const start = performance.now(), index = tokenIndex(transforms);
    report.indexes[label] = { buildMs: performance.now() - start, distinctMultiByteExpansions: index.map.size, maxLength: index.maxLength };
}
for (const [name, bytes, description] of fixtures) {
    const start = performance.now(), sha256 = createHash('sha256').update(bytes).digest('hex');
    const old = prior.fixtures.find(row => row.name === name);
    if (old) assert.equal(old.sha256, sha256);
    const bits = bytesToBits(bytes), byteStart = performance.now(), { root } = symbolTree(bits, 8);
    const byteResult = encodeOrdered(root, bits.length); assert.equal(decodeOrdered(byteResult.encoded), bits);
    // Recomputing this control also verifies the shared builder generalization.
    if (old) assert.equal(byteResult.encoded.length, old.rawByteRecursive.bytes);
    const row = { name, description, inputBytes: bytes.length, sha256, byteRecursiveBytes: byteResult.encoded.length, byteControlMs: performance.now() - byteStart };
    if (old) {
        row.nativeBitRecursiveBytes = old.nativeBitRecursiveBytes;
        for (const k of ['gzip9Bytes','brotli11Bytes','zstd19Bytes']) row[k] = old[k];
    } else for (const [label, compress, decompress] of [
        ['gzip9', b => gzipSync(b, { level: 9 }), gunzipSync],
        ['brotli11', b => brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }), brotliDecompressSync],
        ['zstd19', b => zstdCompressSync(b, { params: { [constants.ZSTD_c_compressionLevel]: 19 } }), zstdDecompressSync],
    ]) { const encoded = compress(bytes); assert.deepEqual(decompress(encoded), bytes); row[label + 'Bytes'] = encoded.length; }
    for (const [label, transforms] of [['base', false], ['full', true]]) {
        const prepared = prepare(bytes, transforms), { tokens, ...coverage } = prepared.parsed;
        row[label + 'Tree'] = { ...coverage, tokens: tokens.length, tokenBits: prepared.bits.length, tokenizeMs: prepared.tokenizeMs,
            treeMs: prepared.treeMs, paddedBits: prepared.tree.paddedBits, levels: prepared.tree.stats };
        for (const kind of ['direct','flat','recursive']) {
            const start = performance.now(), result = encodeDictionary(bytes, { transforms, kind, prepared });
            const encodeMs = performance.now() - start, decodeStart = performance.now();
            assert.deepEqual(decodeDictionary(result.encoded), bytes);
            // Verify dictionary candidates even when the document fallback wins.
            assert.deepEqual(decodeDictionary(result.candidate), bytes);
            const key = label + kind[0].toUpperCase() + kind.slice(1), r = result.result;
            row[key] = { bytes: result.encoded.length, candidateBytes: result.candidateBytes, selected: result.selected, encodeMs,
                decodeMs: performance.now() - decodeStart, candidateLayers: r.layers, candidateLiteralBits: r.literalBits, candidateLiteralMode: r.literalMode, states: r.states, trials: r.trials };
            fs.writeFileSync(new URL(`${name}-${key}.suld`, directory), result.encoded);
        }
    }
    row.totalMs = performance.now() - start; report.fixtures.push(row);
    fs.writeFileSync(new URL('results.json', directory), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ name, input: bytes.length, byte: row.byteRecursiveBytes, base: row.baseRecursive.bytes, full: row.fullRecursive.bytes,
        baseDirect: row.baseDirect.bytes, fullDirect: row.fullDirect.bytes, fullFlat: row.fullFlat.bytes,
        coverage: +(row.fullTree.dictionaryBytes / bytes.length).toFixed(3), seconds: +(row.totalMs / 1000).toFixed(2) }));
}
const fields = ['name','inputBytes','byteRecursiveBytes','baseDirectBytes','baseFlatBytes','baseRecursiveBytes','fullDirectBytes','fullFlatBytes','fullRecursiveBytes','gzip9Bytes','brotli11Bytes','zstd19Bytes'];
const rows = report.fixtures.map(row => ({ ...row, ...Object.fromEntries(['base','full'].flatMap(label => ['Direct','Flat','Recursive'].map(kind => [label + kind + 'Bytes', row[label + kind].bytes]))) }));
fs.writeFileSync(new URL('summary.csv', directory), fields.join(',') + '\n' + rows.map(row => fields.map(key => row[key]).join(',')).join('\n') + '\n');
console.log('All 72 final encodings, 72 dictionary candidates, and 12 byte controls decoded exactly; all 10 prior hashes and byte-control sizes matched.');
```

## sul-brotli-experiment/cli.mjs

```javascript
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { encodeDictionary, decodeDictionary } from './codec.mjs';

const [command, input, output, profile = 'full'] = process.argv.slice(2);
if (!input || !output || !['compress','decompress'].includes(command) || !['base','full'].includes(profile)) throw new Error('Usage: node cli.mjs compress|decompress INPUT OUTPUT [base|full]');
const bytes = fs.readFileSync(input);
if (command === 'compress') {
    const result = encodeDictionary(bytes, { transforms: profile === 'full' });
    assert.deepEqual(decodeDictionary(result.encoded), bytes);
    fs.writeFileSync(output, result.encoded);
    console.log(JSON.stringify({ inputBytes: bytes.length, outputBytes: result.encoded.length, profile, selected: result.selected, candidateBytes: result.candidateBytes }));
} else fs.writeFileSync(output, decodeDictionary(bytes));
```

## sul-brotli-experiment/oracle.c

```c
/* Research extraction/verification helper, linked to the pinned MIT Brotli source. */
#include <stdio.h>
#include "dictionary.h"
#include "transform.h"

int main(int argc, char** argv) {
    const BrotliDictionary* d = BrotliGetDictionary();
    const BrotliTransforms* t = BrotliGetTransforms();
    (void)argv;
    if (argc > 1) {
        /* Exhaustive oracle stream: one byte of length, then transformed bytes,
           in transform-major, word-length-major, dictionary-index order. */
        unsigned tr, len, index;
        unsigned char out[256];
        for (tr = 0; tr < t->num_transforms; tr++) for (len = 4; len <= 24; len++) {
            for (index = 0; index < (1u << d->size_bits_by_length[len]); index++) {
                int n = BrotliTransformDictionaryWord(out, d->data + d->offsets_by_length[len] + index * len, len, t, tr);
                if (n < 0 || n > 255) return 2;
                putchar(n); fwrite(out, 1, n, stdout);
            }
        }
        return ferror(stdout) ? 1 : 0;
    }
    printf("{\"sizeBits\":[");
    for (int i = 0; i < 32; i++) printf("%s%u", i ? "," : "", d->size_bits_by_length[i]);
    printf("],\"offsets\":[");
    for (int i = 0; i < 32; i++) printf("%s%u", i ? "," : "", d->offsets_by_length[i]);
    printf("],\"affixes\":[");
    for (int i = 0; i < 50; i++) {
        const unsigned char* p = t->prefix_suffix + t->prefix_suffix_map[i];
        printf("%s\"", i ? "," : "");
        for (int j = 1; j <= p[0]; j++) printf("%02x", p[j]);
        printf("\"");
    }
    printf("],\"transforms\":[");
    for (unsigned i = 0; i < t->num_transforms; i++) printf("%s[%u,%u,%u]", i ? "," : "", t->transforms[3*i], t->transforms[3*i+1], t->transforms[3*i+2]);
    printf("]}\n");
    return 0;
}
```

## sul-byte-experiment/levels.mjs

```javascript
// Experimental SUL word hierarchy with raw bit or byte leaves. This deliberately
// bypasses the native bit-specific literal pipeline; it is not a native SUL ID.
import { rawId } from '../sul-compression-research/vendor/fjs/sul/id/module.f.mjs';
import { vec } from '../sul-compression-research/vendor/fjs/types/bit_vec/module.f.mjs';
import { encode, emptyEncodeState } from '../sul-compression-research/vendor/fjs/sul/level/hash/module.f.mjs';
import { flatten } from '../sul-ordered-experiment/levels.mjs';

export function symbolTree(bits, width = 8) {
    if (width !== 1 && width !== 8) throw new Error('Expected complete bit or byte symbols');
    return fixedSymbolTree(bits, width);
}

// Also supports the fixed-width IDs used by the Brotli dictionary experiment.
export function fixedSymbolTree(bits, width) {
    if (!Number.isInteger(width) || width < 1 || width > 24 || bits.length % width || /[^01]/.test(bits)) throw new Error('Expected complete fixed-width symbols');
    const leaves = new Map();
    const leaf = value => {
        if (!leaves.has(value)) leaves.set(value, {
            key: `raw${width}:0:${value}`, value: rawId(vec(BigInt(width))(BigInt(value))),
            level: 0, length: width, bits: value.toString(2).padStart(width, '0'),
        });
        return leaves.get(value);
    };
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
    for (let offset = 0; offset < bits.length; offset += width) push(leaf(parseInt(bits.slice(offset, offset + width), 2)));
    // Both variants append the same bit-level suffix 10*. For bytes the first
    // pad symbol is 0x80, and subsequent pad symbols are 0x00.
    const paddingLimit = Math.max(65536, 4 * bits.length);
    let paddingSymbols = 1, root = push(leaf(2 ** (width - 1)));
    while (root === undefined) {
        if (++paddingSymbols * width > paddingLimit) throw new Error('Prototype finalization limit');
        root = push(leaf(0));
    }
    const padded = bits + '1' + '0'.repeat(paddingSymbols * width - 1);
    if (flatten(root) !== padded) throw new Error('Hierarchy does not reconstruct the input and padding');
    return { root, paddedBits: padded.length, paddingSymbols,
        stats: stats.map(({ level, symbols, ids }) => ({ level, symbols, unique: ids.size })) };
}
```
