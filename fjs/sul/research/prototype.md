# Prototype source listing

This is a verbatim listing of the six experimental JavaScript files in
[prototype.zip](prototype.zip), included so the implementation can be reviewed
without extracting an archive. It is an experimental host-JavaScript codec,
not a FunctionalScript module or a proposed public API. The archive also holds
the original vendored SUL dependency snapshot, its license, and the recorded
metrics. See [compression.md](compression.md) for design and reproduction.

## arithmetic.mjs

```js
// Adaptive binary arithmetic coder. 32-bit intervals; products remain exact
// within JavaScript's 53-bit integer precision because totals are <= 16384.
const HALF = 0x80000000, QUARTER = 0x40000000, THREE_QUARTERS = 0xc0000000;

class BitsOut {
    bytes = []; byte = 0; count = 0;
    push(bit) {
        this.byte = this.byte * 2 + bit;
        if (++this.count === 8) { this.bytes.push(this.byte); this.byte = 0; this.count = 0; }
    }
    finish() {
        if (this.count) this.bytes.push(this.byte * 2 ** (8 - this.count));
        return Buffer.from(this.bytes);
    }
}

class Models {
    models = new Map();
    get(context) {
        let model = this.models.get(context);
        if (!model) { model = [1, 1]; this.models.set(context, model); }
        return model;
    }
    update(model, bit) {
        model[bit]++;
        if (model[0] + model[1] >= 16384) {
            model[0] = Math.ceil(model[0] / 2);
            model[1] = Math.ceil(model[1] / 2);
        }
    }
}

export class ArithmeticEncoder extends Models {
    low = 0; high = 0xffffffff; pending = 0; output = new BitsOut();
    emit(bit) {
        this.output.push(bit);
        while (this.pending) { this.output.push(1 - bit); this.pending--; }
    }
    bit(bit, context) {
        const model = this.get(context), range = this.high - this.low + 1;
        const split = this.low + Math.floor(range * model[0] / (model[0] + model[1]));
        if (bit === 0) this.high = split - 1; else this.low = split;
        for (;;) {
            if (this.high < HALF) this.emit(0);
            else if (this.low >= HALF) { this.emit(1); this.low -= HALF; this.high -= HALF; }
            else if (this.low >= QUARTER && this.high < THREE_QUARTERS) {
                this.pending++; this.low -= QUARTER; this.high -= QUARTER;
            } else break;
            this.low *= 2; this.high = this.high * 2 + 1;
        }
        this.update(model, bit);
    }
    finish() { this.pending++; this.emit(this.low < QUARTER ? 0 : 1); return this.output.finish(); }
}

export class ArithmeticDecoder extends Models {
    low = 0; high = 0xffffffff; value = 0; position = 0;
    constructor(bytes) { super(); this.bytes = bytes; for (let i = 0; i < 32; i++) this.value = this.value * 2 + this.read(); }
    read() {
        const p = this.position++;
        return p >= this.bytes.length * 8 ? 0 : (this.bytes[p >> 3] >> (7 - (p & 7))) & 1;
    }
    bit(context) {
        const model = this.get(context), range = this.high - this.low + 1;
        const split = this.low + Math.floor(range * model[0] / (model[0] + model[1]));
        const bit = this.value >= split ? 1 : 0;
        if (bit === 0) this.high = split - 1; else this.low = split;
        for (;;) {
            if (this.high < HALF) { /* no translation */ }
            else if (this.low >= HALF) { this.value -= HALF; this.low -= HALF; this.high -= HALF; }
            else if (this.low >= QUARTER && this.high < THREE_QUARTERS) {
                this.value -= QUARTER; this.low -= QUARTER; this.high -= QUARTER;
            } else break;
            this.low *= 2; this.high = this.high * 2 + 1; this.value = this.value * 2 + this.read();
        }
        this.update(model, bit);
        return bit;
    }
}

export class RawEncoder { output = new BitsOut(); bit(bit) { this.output.push(bit); } finish() { return this.output.finish(); } }
export class RawDecoder {
    position = 0;
    constructor(bytes) { this.bytes = bytes; }
    bit() { const p = this.position++; if (p >= this.bytes.length * 8) throw new Error('Truncated raw stream'); return (this.bytes[p >> 3] >> (7 - (p & 7))) & 1; }
}

// Separate adaptive models for syntax, integer prefixes, reference distances,
// and literal bits. Literal context is the previous eight transmitted bits.
export class Writer {
    history = 0;
    constructor(coder) { this.coder = coder; }
    tag(tag) { this.coder.bit(tag >> 1, 0); this.coder.bit(tag & 1, 1 + (tag >> 1)); }
    uint(value, context) {
        const bits = (value + 1).toString(2), n = bits.length - 1;
        for (let i = 0; i < n; i++) this.coder.bit(1, context + Math.min(i, 31));
        this.coder.bit(0, context + Math.min(n, 31));
        for (let i = 1; i < bits.length; i++) this.coder.bit(Number(bits[i]), context + 32 + Math.min(i - 1, 31));
    }
    literals(bits) {
        for (const char of bits) { const bit = Number(char); this.coder.bit(bit, 1024 + this.history); this.history = ((this.history << 1) | bit) & 255; }
    }
}

export class Reader {
    history = 0;
    constructor(coder) { this.coder = coder; }
    tag() { const hi = this.coder.bit(0); return hi * 2 + this.coder.bit(1 + hi); }
    uint(context) {
        let n = 0;
        while (this.coder.bit(context + Math.min(n, 31))) { if (++n > 31) throw new Error('Integer limit exceeded'); }
        let value = 1;
        for (let i = 0; i < n; i++) value = value * 2 + this.coder.bit(context + 32 + i);
        return value - 1;
    }
    literals(length) {
        let out = '';
        for (let i = 0; i < length; i++) { const bit = this.coder.bit(1024 + this.history); this.history = ((this.history << 1) | bit) & 255; out += bit; }
        return out;
    }
}
```

## sul-graph.mjs

```js
import { encode, emptyEncodeState } from './vendor/fjs/sul/module.f.mjs';
import { isHash, isRaw } from './vendor/fjs/sul/id/module.f.mjs';
import { literal3ToVec, level } from './vendor/fjs/sul/level/literal/module.f.mjs';
import { unpack } from './vendor/fjs/types/bit_vec/module.f.mjs';
import { toArray } from './vendor/fjs/types/list/module.f.mjs';
import { patriciaTrie } from './vendor/fjs/types/patricia_trie/module.f.mjs';

export const bytesToBits = bytes => [...bytes].map(x => x.toString(2).padStart(8, '0')).join('');
export const bitsToBytes = bits => {
    const out = Buffer.alloc(Math.ceil(bits.length / 8));
    for (let i = 0; i < bits.length; i++) if (bits[i] === '1') out[i >> 3] |= 1 << (7 - (i & 7));
    return out;
};
const literalBits = id => {
    if (isRaw(id)) return (id ^ (1n << 254n)).toString(2).slice(1);
    const { length, uint } = unpack(literal3ToVec(id));
    return uint.toString(2).padStart(Number(length), '0');
};

export function capture(bits) {
    const merges = new Map();
    const enc = encode((a, b, id, _symbol, storage) => {
        // Raw IDs can have several decompositions, all with identical bits.
        // Retain the first encountered derivation; every child is shorter.
        if (!merges.has(id)) merges.set(id, [a, b]);
        return storage;
    });
    let state = emptyEncodeState(null);
    for (const bit of bits) state = enc.push(BigInt(bit), state);
    return { root: enc.end(state), merges };
}

class Graph {
    nodes = []; interned = new Map();
    literal(bits) {
        const key = 'b:' + bits;
        if (this.interned.has(key)) return this.interned.get(key);
        const node = { id: this.nodes.length, length: bits.length, bits };
        this.nodes.push(node); this.interned.set(key, node); return node;
    }
    pair(left, right) {
        const length = left.length + right.length;
        const bits = length <= 253 ? flatten(left) + flatten(right) : undefined;
        const key = bits === undefined ? `p:${left.id}:${right.id}` : 'b:' + bits;
        if (this.interned.has(key)) return this.interned.get(key);
        const node = { id: this.nodes.length, length, bits, left, right };
        this.nodes.push(node); this.interned.set(key, node); return node;
    }
}

export function flatten(node) {
    if (node.bits !== undefined) return node.bits;
    return flatten(node.left) + flatten(node.right);
}

export function buildGraph(captured, expanded = false) {
    const graph = new Graph(), memo = new Map(), literals = new Map();
    const levels = [null, level(0n), level(2n), level(7n)];
    const literal = (depth, value) => {
        if (depth === 0) return graph.literal(String(value));
        const key = `${depth}:${value}`;
        if (literals.has(key)) return literals.get(key);
        const word = toArray(levels[depth].decode(value));
        // Use the same sorted-prefix Patricia construction as SUL hash levels
        // to expose structure inside the exact literal codes for this experiment.
        const trie = patriciaTrie((a, b, storage) => [graph.pair(a, b), storage]);
        let state = [null, []];
        for (const value of word.slice(0, -1)) state = trie.push([value, literal(depth - 1, value)], state);
        const result = graph.pair(trie.end(state)[0], literal(depth - 1, word.at(-1)));
        literals.set(key, result); return result;
    };
    const visit = id => {
        if (memo.has(id)) return memo.get(id);
        let node;
        if (isHash(id) || (expanded && isRaw(id))) {
            const children = captured.merges.get(id);
            if (!children) throw new Error('Missing captured SUL merge');
            node = graph.pair(visit(children[0]), visit(children[1]));
        } else if (expanded) node = literal(3, id);
        else node = graph.literal(literalBits(id));
        memo.set(id, node); return node;
    };
    return { root: visit(captured.root), nodes: graph.nodes };
}

export function reachable(root) {
    const seen = new Set(), postorder = [];
    const visit = node => {
        if (seen.has(node.id)) return;
        seen.add(node.id);
        if (node.left) { visit(node.left); visit(node.right); }
        postorder.push(node);
    };
    visit(root); return postorder;
}

export function selectRules(root, minimumBits) {
    const nodes = reachable(root), counts = new Map([[root.id, 1]]);
    for (const node of [...nodes].reverse()) if (node.left) {
        const n = counts.get(node.id) ?? 0;
        for (const child of [node.left, node.right]) counts.set(child.id, (counts.get(child.id) ?? 0) + n);
    }
    const chosen = new Set(nodes.filter(n => n.length >= minimumBits && counts.get(n.id) > 1).map(n => n.id));
    // A repeated parent is emitted only once. Recount after this pruning so
    // descendants hidden inside that parent are not credited with false savings.
    for (;;) {
        const uses = new Map(), descended = new Set();
        const visit = node => {
            if (chosen.has(node.id)) {
                uses.set(node.id, (uses.get(node.id) ?? 0) + 1);
                if (descended.has(node.id)) return;
                descended.add(node.id);
            }
            if (node.left) { visit(node.left); visit(node.right); }
        };
        visit(root);
        let removed = 0;
        for (const id of chosen) if ((uses.get(id) ?? 0) < 2) { chosen.delete(id); removed++; }
        if (!removed) return chosen;
    }
}
```

## codec.mjs

```js
import { ArithmeticEncoder, ArithmeticDecoder, RawEncoder, RawDecoder, Writer, Reader } from './arithmetic.mjs';
import { flatten, selectRules, bitsToBytes, bytesToBits } from './sul-graph.mjs';

const MAGIC = Buffer.from('SULC'), HEADER = 14;
const CONCAT = 0, LITERAL = 1, DEFINE = 2, REFERENCE = 3;

function envelope(mode, length, payload) {
    if (length >= 2 ** 32 || payload.length >= 2 ** 32) throw new Error('Prototype size limit');
    const header = Buffer.alloc(HEADER); MAGIC.copy(header); header[4] = 1; header[5] = mode;
    header.writeUInt32BE(length, 6); header.writeUInt32BE(payload.length, 10);
    return Buffer.concat([header, payload]);
}

export const rawDocument = bits => envelope(0, bits.length, bitsToBytes(bits));

export function arithmeticDocument(bits) {
    const coder = new ArithmeticEncoder(), writer = new Writer(coder);
    writer.literals(bits);
    return envelope(3, bits.length, coder.finish());
}

export function encodeGraph(root, originalLength, { minimumBits = 64, arithmetic = true, chosen = selectRules(root, minimumBits) } = {}) {
    const coder = arithmetic ? new ArithmeticEncoder() : new RawEncoder();
    const writer = new Writer(coder), dictionary = new Map(), hasChosen = new Map();
    const stats = { definitions: 0, references: 0, concatenations: 0, literalRuns: 0, literalBits: 0, minimumBits, arithmetic };
    const contains = node => {
        if (hasChosen.has(node.id)) return hasChosen.get(node.id);
        const result = chosen.has(node.id) || !!(node.left && (contains(node.left) || contains(node.right)));
        hasChosen.set(node.id, result); return result;
    };
    const body = node => {
        if (node.left && (contains(node.left) || contains(node.right))) {
            stats.concatenations++; writer.tag(CONCAT); visit(node.left); visit(node.right);
        } else {
            const bits = flatten(node);
            stats.literalRuns++; stats.literalBits += bits.length;
            writer.tag(LITERAL); writer.uint(bits.length, 64); writer.literals(bits);
        }
    };
    const visit = node => {
        if (!chosen.has(node.id)) return body(node);
        if (dictionary.has(node.id)) {
            stats.references++; writer.tag(REFERENCE);
            writer.uint(dictionary.size - 1 - dictionary.get(node.id), 128); return;
        }
        stats.definitions++; writer.tag(DEFINE);
        dictionary.set(node.id, dictionary.size); body(node);
    };
    visit(root);
    const encoded = envelope(arithmetic ? 2 : 1, originalLength, coder.finish());
    return { encoded, stats };
}

export function decodeDocument(buffer, { maxOutputBits = 64 * 1024 * 1024 } = {}) {
    if (buffer.length < HEADER || !buffer.subarray(0, 4).equals(MAGIC) || buffer[4] !== 1) throw new Error('Invalid prototype header');
    const mode = buffer[5], length = buffer.readUInt32BE(6), size = buffer.readUInt32BE(10);
    if (size !== buffer.length - HEADER || length > maxOutputBits) throw new Error('Length limit or truncated payload');
    const payload = buffer.subarray(HEADER);
    if (mode === 0) { if (payload.length !== Math.ceil(length / 8)) throw new Error('Bad raw length'); return bytesToBits(payload).slice(0, length); }
    if (![1, 2, 3].includes(mode)) throw new Error('Unknown mode');
    const reader = new Reader(mode === 1 ? new RawDecoder(payload) : new ArithmeticDecoder(payload));
    if (mode === 3) return reader.literals(length);
    const dictionary = [], limit = Math.min(maxOutputBits + 65536, length * 16 + 65536);
    let operations = 0;
    const visit = (depth = 0) => {
        if (depth > 2048 || ++operations > limit * 4 + 1024) throw new Error('Decode budget exceeded');
        switch (reader.tag()) {
            case CONCAT: {
                const a = visit(depth + 1), b = visit(depth + 1);
                if (a.length + b.length > limit) throw new Error('Expansion exceeds budget');
                return a + b;
            }
            case LITERAL: {
                const n = reader.uint(64); if (n > limit) throw new Error('Literal exceeds budget');
                return reader.literals(n);
            }
            case DEFINE: {
                const index = dictionary.length; dictionary.push(null);
                const bits = visit(depth + 1); dictionary[index] = bits; return bits;
            }
            case REFERENCE: {
                const distance = reader.uint(128), index = dictionary.length - 1 - distance;
                if (index < 0 || dictionary[index] == null) throw new Error('Invalid or cyclic reference');
                return dictionary[index];
            }
        }
    };
    const bits = visit();
    if (bits.length <= length || !/^10*$/.test(bits.slice(length))) throw new Error('Invalid SUL end padding');
    return bits.slice(0, length);
}
```

## cli.mjs

```js
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { capture, buildGraph, bytesToBits, bitsToBytes } from './sul-graph.mjs';
import { rawDocument, arithmeticDocument, encodeGraph, decodeDocument } from './codec.mjs';

const [command, input, output] = process.argv.slice(2);
if (!['compress', 'decompress'].includes(command) || !input || !output) {
    console.error('Usage: node cli.mjs compress|decompress INPUT OUTPUT'); process.exit(1);
}
const bytes = fs.readFileSync(input);
if (command === 'decompress') {
    const bits = decodeDocument(bytes);
    if (bits.length % 8) throw new Error('The decoded document is not byte-aligned');
    fs.writeFileSync(output, bitsToBytes(bits));
} else {
    const bits = bytesToBits(bytes), captured = capture(bits);
    let best = { name: 'raw', encoded: rawDocument(bits) };
    const plain = arithmeticDocument(bits);
    if (plain.length < best.encoded.length) best = { name: 'arithmetic-only', encoded: plain };
    for (const expanded of [false, true]) {
        const { root } = buildGraph(captured, expanded);
        for (const minimumBits of [16, 32, 64, 128, 256]) for (const arithmetic of [false, true]) {
            const candidate = encodeGraph(root, bits.length, { minimumBits, arithmetic });
            if (candidate.encoded.length < best.encoded.length) best = { name: `${expanded ? 'expanded' : 'native'}-SUL/${minimumBits}/${arithmetic ? 'arith' : 'raw'}`, ...candidate };
        }
    }
    assert.equal(decodeDocument(best.encoded), bits);
    fs.writeFileSync(output, best.encoded);
    console.log(JSON.stringify({ inputBytes: bytes.length, compressedBytes: best.encoded.length, selected: best.name }));
}
```

## test.mjs

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ArithmeticEncoder, ArithmeticDecoder } from './arithmetic.mjs';
import { capture, buildGraph, flatten } from './sul-graph.mjs';
import { rawDocument, arithmeticDocument, encodeGraph, decodeDocument } from './codec.mjs';

test('arithmetic coder: balanced, skewed, and rescaled contexts', () => {
    let seed = 123456789;
    for (const kind of ['random', 'zero', 'alternating']) {
        const encoder = new ArithmeticEncoder(), pairs = [];
        for (let i = 0; i < 70000; i++) {
            seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
            const bit = kind === 'random' ? (seed >>> 0) & 1 : kind === 'zero' ? 0 : i & 1;
            const context = kind === 'random' ? i % 7 : 0;
            pairs.push([bit, context]); encoder.bit(bit, context);
        }
        const decoder = new ArithmeticDecoder(encoder.finish());
        for (const [bit, context] of pairs) assert.equal(decoder.bit(context), bit);
    }
});

test('all 511 short bitstrings round-trip with both SUL graph forms and coders', () => {
    for (let n = 0; n <= 8; n++) for (let x = 0; x < 2 ** n; x++) {
        const bits = n ? x.toString(2).padStart(n, '0') : '';
        assert.equal(decodeDocument(rawDocument(bits)), bits);
        assert.equal(decodeDocument(arithmeticDocument(bits)), bits);
        const captured = capture(bits);
        for (const expanded of [false, true]) {
            const { root } = buildGraph(captured, expanded);
            assert.equal(flatten(root).slice(0, n), bits);
            for (const arithmetic of [false, true]) {
                const { encoded } = encodeGraph(root, n, { minimumBits: 2, arithmetic });
                assert.equal(decodeDocument(encoded), bits);
            }
        }
    }
});

test('repeated and irregular long bitstrings round-trip; nested rules are valid', () => {
    let seed = 42;
    const random = Array.from({ length: 65537 }, () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return String((seed >>> 0) & 1); }).join('');
    const patterns = ['0'.repeat(40000), '10110010'.repeat(4096), random, random.slice(0, 4096).repeat(16)];
    for (const bits of patterns) {
        const captured = capture(bits);
        for (const expanded of [false, true]) {
            const { root } = buildGraph(captured, expanded);
            for (const minimumBits of [16, 64, 256]) for (const arithmetic of [false, true]) {
                const { encoded } = encodeGraph(root, bits.length, { minimumBits, arithmetic });
                assert.equal(decodeDocument(encoded), bits);
            }
        }
    }
});

test('frame rejects truncated payload and respects declared output limit', () => {
    const data = arithmeticDocument('01101010');
    assert.throws(() => decodeDocument(data.subarray(0, -1)));
    assert.throws(() => decodeDocument(data, { maxOutputBits: 7 }));
});
```

## benchmark.mjs

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
const fixtures = [
    ['source_code', source, 'First 64 KiB of sorted concatenated vendored FunctionalScript modules, including proofs.'],
    ['json_records', Buffer.from(recordRows.join('')), '640 generated JSON records with changing numeric fields.'],
    ['repeated_phrase', repeatTo(Buffer.from('Immutable documents share identical subtrees. Arithmetic coding represents frequent events with fewer bits.\n'), 65536), 'One 108-byte phrase repeated and truncated.'],
    ['repeated_random_block', repeatTo(exactBlock, 131072), 'A generated 4 KiB pseudorandom block repeated 32 times.'],
    ['edited_versions', Buffer.concat(versions), '32 versions of that 4 KiB block; each has one independent byte substitution.'],
    ['recursive_sequence', Buffer.from(recursive), '16 Thue-Morse expansion rounds, stored as ASCII 0/1.'],
    ['biased_bits', biased, 'Generated sparse bytes: approximately 1% of bits are set.'],
    ['uniform_random', randomBytes(65536, 123456789), 'Xorshift32 pseudorandom byte stream; incompressibility control.'],
];

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
```
