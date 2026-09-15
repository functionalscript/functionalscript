# Shared frequency-profile experiment source listing

Verbatim research source; see [the report](frequency-profiles.md) and [archive](profile-prototype.zip).

## sul-profile-experiment/profile.mjs

```js
import { createHash } from 'node:crypto';
import { ArithmeticEncoder, ArithmeticDecoder } from '../sul-compression-research/arithmetic.mjs';

export const schema = 'sul-ordered-binary-contexts-v1';
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function validateProfile(profile) {
    if (profile.schema !== schema || profile.total !== 4096 || !Array.isArray(profile.rows)) throw new Error('Unknown profile schema');
    let previous = -1;
    for (const row of profile.rows) {
        if (!Array.isArray(row) || row.length !== 3 || !row.every(Number.isSafeInteger)) throw new Error('Invalid profile row');
        const [context, zero, one] = row;
        if (context <= previous || context < 0 || zero < 1 || one < 1 || zero + one !== profile.total) throw new Error('Invalid profile weights');
        previous = context;
    }
    return profile;
}

export const profileBytes = profile => {
    validateProfile(profile);
    return Buffer.from(JSON.stringify({ schema: profile.schema, total: profile.total, rows: profile.rows }) + '\n');
};
export const profileId = profile => digest(profileBytes(profile));
const weights = profile => new Map(validateProfile(profile).rows.map(([context, zero, one]) => [context, [zero, one]]));

export class FixedEncoder extends ArithmeticEncoder {
    constructor(profile) { super(); this.weights = weights(profile); }
    get(context) { return this.weights.get(context) ?? [1, 1]; }
    update() {}
}

export class FixedDecoder extends ArithmeticDecoder {
    constructor(bytes, profile) { super(bytes); this.weights = weights(profile); }
    get(context) { return this.weights.get(context) ?? [1, 1]; }
    update() {}
}

// The stored table remains immutable. Each stream starts with a small trained
// prior (total 16) and then uses the original adaptive updates and rescaling.
function priorModel(coder, context) {
    if (!coder.models.has(context)) {
        const source = coder.weights.get(context);
        if (source) { const zero = Math.max(1, Math.min(15, Math.round(16 * source[0] / 4096))); coder.models.set(context, [zero, 16 - zero]); }
    }
    let model = coder.models.get(context);
    if (!model) { model = [1, 1]; coder.models.set(context, model); }
    return model;
}

export class PriorEncoder extends ArithmeticEncoder {
    constructor(profile) { super(); this.weights = weights(profile); }
    get(context) { return priorModel(this, context); }
}

export class PriorDecoder extends ArithmeticDecoder {
    constructor(bytes, profile) { super(bytes); this.weights = weights(profile); }
    get(context) { return priorModel(this, context); }
}

export class RecordingDecoder extends ArithmeticDecoder {
    constructor(bytes, counts) { super(bytes); this.counts = counts; }
    bit(context) {
        const bit = super.bit(context);
        const row = this.counts.get(context) ?? [0, 0]; row[bit]++; this.counts.set(context, row);
        return bit;
    }
}

export function mergeCounts(inputs) {
    const result = new Map();
    for (const counts of inputs) for (const [context, countsRow] of counts) {
        const row = result.get(context) ?? [0, 0]; row[0] += countsRow[0]; row[1] += countsRow[1]; result.set(context, row);
    }
    return result;
}

export function fitProfile(counts, minimumEvents = 16) {
    const rows = [];
    for (const [context, [zero, one]] of [...counts].sort((a, b) => a[0] - b[0])) {
        if (zero + one < minimumEvents) continue;
        const weight = Math.max(1, Math.min(4095, Math.round(4096 * (zero + 1) / (zero + one + 2))));
        rows.push([context, weight, 4096 - weight]);
    }
    return validateProfile({ schema, total: 4096, rows });
}
```

## sul-profile-experiment/codec.mjs

```js
import { encodeOrdered, decodeOrdered } from '../sul-ordered-experiment/ordered.mjs';
import { fixedSymbolTree } from '../sul-byte-experiment/levels.mjs';
import { bytesToBits, bitsToBytes } from '../sul-compression-research/sul-graph.mjs';
import { FixedEncoder, FixedDecoder, PriorEncoder, PriorDecoder, RecordingDecoder, profileId } from './profile.mjs';

export function prepare(bytes) {
    const bits = bytesToBits(bytes), start = performance.now();
    const tree = fixedSymbolTree(bits, 8);
    return { bits, tree, treeMs: performance.now() - start };
}

export function encodeCandidate(bytes, profile, prepared = prepare(bytes), policy = 'fixed') {
    if (!['fixed', 'prior16'].includes(policy)) throw new Error('Unknown profile policy');
    const start = performance.now();
    const Encoder = policy === 'prior16' ? PriorEncoder : FixedEncoder;
    const result = encodeOrdered(prepared.tree.root, prepared.bits.length, profile ? { createEncoder: () => new Encoder(profile) } : {});
    let encoded = result.encoded;
    if (profile) {
        const header = Buffer.alloc(37); header.write('SULP'); header[4] = policy === 'prior16' ? 2 : 1; Buffer.from(profileId(profile), 'hex').copy(header, 5);
        encoded = Buffer.concat([header, encoded]);
    }
    return { encoded, result, encodeMs: performance.now() - start };
}

export function decode(bytes, registry = new Map(), counts) {
    if (bytes.subarray(0, 4).toString() === 'SULO') {
        return bitsToBytes(decodeOrdered(bytes, counts ? { createDecoder: payload => new RecordingDecoder(payload, counts) } : {}));
    }
    if (bytes.length < 51 || bytes.subarray(0, 4).toString() !== 'SULP' || ![1, 2].includes(bytes[4])) throw new Error('Invalid profile frame');
    const id = bytes.subarray(5, 37).toString('hex'), profile = registry.get(id);
    if (!profile) throw new Error('Missing frequency profile ' + id);
    if (profileId(profile) !== id) throw new Error('Frequency profile hash mismatch');
    const Decoder = bytes[4] === 2 ? PriorDecoder : FixedDecoder;
    return bitsToBytes(decodeOrdered(bytes.subarray(37), { createDecoder: payload => new Decoder(payload, profile) }));
}

export function encodeBest(bytes, profiles, prepared = prepare(bytes)) {
    const candidates = [{ name: 'adaptive', ...encodeCandidate(bytes, undefined, prepared) },
        ...profiles.flatMap(({ name, profile }) => ['fixed', 'prior16'].map(policy => ({ name: name + '-' + policy, profileName: name, policy, ...encodeCandidate(bytes, profile, prepared, policy) })))];
    // Adaptive wins a size tie, avoiding an unnecessary external dependency.
    let best = candidates[0];
    for (const candidate of candidates.slice(1)) if (candidate.encoded.length < best.encoded.length) best = candidate;
    return { best, candidates };
}
```

## sul-profile-experiment/train.mjs

```js
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { prepare, encodeCandidate, decode } from './codec.mjs';
import { digest, fitProfile, mergeCounts, profileBytes, profileId } from './profile.mjs';

const root = new URL('./', import.meta.url), corpus = JSON.parse(fs.readFileSync(new URL('corpus.json', root)));
const documents = [], byCategory = new Map();
for (const file of corpus.files.filter(f => f.split === 'train')) {
    const bytes = fs.readFileSync(new URL(file.local, root)); assert.equal(digest(bytes), file.sha256);
    const counts = new Map(), encoded = encodeCandidate(bytes, undefined, prepare(bytes)).encoded;
    assert.deepEqual(decode(encoded, undefined, counts), bytes);
    documents.push({ file, counts });
    console.log(JSON.stringify({ phase: 'train', name: file.name, bytes: bytes.length, contexts: counts.size }));
}
const descriptions = {
    generic: f => true,
    text: f => f.category === 'text',
    ascii: f => f.ascii,
    json: f => f.category === 'json',
};
fs.mkdirSync(new URL('profiles/', root), { recursive: true });
const registry = { version: 1, dictionaryPolicy: 'Unchanged first-occurrence order and raw-byte SUL hierarchy. Profiles describe binary coding contexts, not document-local dictionary identities.',
    training: 'Count only arithmetic events in the final adaptive encoding, observed by decoding it. Discarded candidates and raw streams supply no events. Use add-one smoothing, at least 16 events per context, weights totaling 4096; unknown contexts use [1,1].', profiles: [] };
for (const [name, accept] of Object.entries(descriptions)) {
    const selected = documents.filter(({ file }) => accept(file)); assert(selected.length);
    const counts = mergeCounts(selected.map(d => d.counts)), profile = fitProfile(counts), id = profileId(profile), data = profileBytes(profile);
    fs.writeFileSync(new URL(`profiles/${id}.json`, root), data);
    registry.profiles.push({ name, id: 'sha256:' + id, file: `profiles/${id}.json`, bytes: data.length, rows: profile.rows.length,
        events: [...counts.values()].reduce((n, row) => n + row[0] + row[1], 0), trainingFiles: selected.map(d => d.file.name) });
}
fs.writeFileSync(new URL('registry.json', root), JSON.stringify(registry, null, 2) + '\n');
console.log(JSON.stringify(registry.profiles.map(({ name, id, bytes, rows, events }) => ({ name, id, bytes, rows, events }))));
```

## sul-profile-experiment/benchmark.mjs

```js
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { brotliCompressSync, brotliDecompressSync, zstdCompressSync, zstdDecompressSync, constants } from 'node:zlib';
import { prepare, encodeBest, decode } from './codec.mjs';
import { digest, profileId } from './profile.mjs';

const root = new URL('./', import.meta.url), corpus = JSON.parse(fs.readFileSync(new URL('corpus.json', root))), registry = JSON.parse(fs.readFileSync(new URL('registry.json', root)));
const profiles = registry.profiles.map(entry => ({ ...entry, profile: JSON.parse(fs.readFileSync(new URL(entry.file, root))) }));
for (const entry of profiles) assert.equal(entry.id, 'sha256:' + profileId(entry.profile));
const byId = new Map(profiles.map(p => [profileId(p.profile), p.profile]));
fs.mkdirSync(new URL('results/', root), { recursive: true });
const report = { version: 1, node: process.version, sulCommit: 'd16a9ebf39b30a42e1b795bc329774d867196841', corpus, registry, scope: 'Four shared profiles, each fixed and as a prior of total 16, versus unchanged adaptive models. Profiled frames include a 37-byte wrapper with a full SHA-256 profile ID and coding policy. The prior control was added after the fixed-profile losses; no tables were refitted. Dictionary contents, alphabet order and SUL hierarchy construction are unchanged; optimal retained levels can change with the model.', files: [] };
for (const file of corpus.files.filter(f => f.split === 'test')) {
    const start = performance.now(), bytes = fs.readFileSync(new URL(file.local, root)); assert.equal(digest(bytes), file.sha256);
    const prepared = prepare(bytes), { best, candidates } = encodeBest(bytes, profiles, prepared);
    const row = { name: file.name, category: file.category, inputBytes: bytes.length, sha256: file.sha256, treeMs: prepared.treeMs, selected: best.name, candidates: [] };
    for (const candidate of candidates) {
        assert.deepEqual(decode(candidate.encoded, byId), bytes);
        fs.writeFileSync(new URL(`results/${file.name}-${candidate.name}.sulp`, root), candidate.encoded);
        const p = profiles.find(p => p.name === candidate.profileName);
        row.candidates.push({ name: candidate.name, profile: candidate.profileName ?? null, policy: candidate.policy ?? 'adaptive', bytes: candidate.encoded.length, innerBytes: candidate.result.encoded.length,
            coldBytes: candidate.encoded.length + (p?.bytes ?? 0), profileBytes: p?.bytes ?? 0, encodeMs: candidate.encodeMs,
            container: candidate.result.container, layers: candidate.result.layers, literalBits: candidate.result.literalBits, literalMode: candidate.result.literalMode });
    }
    row.adaptiveBytes = row.candidates[0].bytes; row.selectedBytes = best.encoded.length;
    row.bestColdBytes = Math.min(...row.candidates.map(c => c.coldBytes));
    for (const [name, encode, restore] of [
        ['brotli11', b => brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }), brotliDecompressSync],
        ['zstd19', b => zstdCompressSync(b, { params: { [constants.ZSTD_c_compressionLevel]: 19 } }), zstdDecompressSync],
    ]) { const output = encode(bytes); assert.deepEqual(restore(output), bytes); row[name + 'Bytes'] = output.length; }
    row.totalMs = performance.now() - start; report.files.push(row);
    fs.writeFileSync(new URL('results/results.json', root), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ name: row.name, category: row.category, input: row.inputBytes, adaptive: row.adaptiveBytes,
        profiles: Object.fromEntries(row.candidates.slice(1).map(c => [c.name, c.bytes])), selected: row.selected, bytes: row.selectedBytes, brotli: row.brotli11Bytes }));
}
const fields = ['name', 'category', 'inputBytes', 'adaptiveBytes', 'selected', 'selectedBytes', 'bestColdBytes', 'brotli11Bytes', 'zstd19Bytes'];
fs.writeFileSync(new URL('results/summary.csv', root), fields.join(',') + '\n' + report.files.map(r => fields.map(f => r[f]).join(',')).join('\n') + '\n');
console.log(`All ${report.files.length * 9} SUL candidates and ${report.files.length * 2} standard-codec outputs decoded exactly.`);
```

## sul-profile-experiment/test.mjs

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedEncoder, FixedDecoder, PriorEncoder, PriorDecoder, fitProfile, profileId, validateProfile } from './profile.mjs';
import { encodeCandidate, encodeBest, decode, prepare } from './codec.mjs';

const profile = fitProfile(new Map([[0, [999, 1]], [1024, [1000, 1]], [1152, [1, 1000]], [2049, [12, 34]]]));

test('fixed model codes rare outcomes and unseen contexts without modifying weights', () => {
    const before = JSON.stringify(profile), encoder = new FixedEncoder(profile), events = [];
    for (let i = 0; i < 1000; i++) { const context = [0, 1024, 1152, 2049, 987654][i % 5], bit = (i * 17 % 7) < 3 ? 0 : 1; events.push([context, bit]); encoder.bit(bit, context); }
    const decoder = new FixedDecoder(encoder.finish(), profile);
    for (const [context, bit] of events) assert.equal(decoder.bit(context), bit);
    assert.equal(JSON.stringify(profile), before);
});

test('profile frame requires the exact profile and preserves all byte values', () => {
    for (const bytes of [Buffer.alloc(0), Buffer.from([255]), Buffer.from(Array.from({ length: 256 }, (_, i) => i)), Buffer.from('alpha beta alpha gamma beta alpha\n'.repeat(24))]) {
        const encoded = encodeCandidate(bytes, profile).encoded, id = profileId(profile);
        assert.deepEqual(decode(encoded, new Map([[id, profile]])), bytes);
        assert.throws(() => decode(encoded), /Missing frequency profile/);
        assert.throws(() => decode(encoded, new Map([[id, fitProfile(new Map())]])), /hash mismatch/);
    }
});

test('model selection includes the profile identifier and retains adaptive fallback', () => {
    const bytes = Buffer.from('abcd'.repeat(64)), tree = prepare(bytes);
    const result = encodeBest(bytes, [{ name: 'example', profile }], tree);
    assert.equal(result.candidates[1].encoded.length, result.candidates[1].result.encoded.length + 37);
    assert(result.best.encoded.length <= result.candidates[0].encoded.length);
});

test('profiles are canonical, smoothed and validated', () => {
    const a = fitProfile(new Map([[9, [20, 0]], [3, [0, 20]]])), b = fitProfile(new Map([[3, [0, 20]], [9, [20, 0]]]));
    assert.equal(profileId(a), profileId(b));
    assert.equal(profileId(a), profileId({ rows: a.rows, total: a.total, schema: a.schema }));
    assert(a.rows.every(([, zero, one]) => zero > 0 && one > 0));
    assert.throws(() => validateProfile({ schema: a.schema, total: 4096, rows: [[0, 0, 4096]] }));
    assert.throws(() => validateProfile({ schema: 'unknown', total: 4096, rows: [] }));
});

test('trained priors adapt per stream without mutating the registered table', () => {
    const before = JSON.stringify(profile), encoder = new PriorEncoder(profile);
    const first = [...encoder.get(0)]; assert.equal(first[0] + first[1], 16);
    for (let i = 0; i < 100; i++) encoder.bit(1, 0);
    assert.equal(encoder.get(0)[1], first[1] + 100);
    const decoder = new PriorDecoder(encoder.finish(), profile);
    for (let i = 0; i < 100; i++) assert.equal(decoder.bit(0), 1);
    assert.equal(JSON.stringify(profile), before);
    const bytes = Buffer.from('one two one three two one\n'.repeat(16));
    const encoded = encodeCandidate(bytes, profile, prepare(bytes), 'prior16').encoded;
    assert.deepEqual(decode(encoded, new Map([[profileId(profile), profile]])), bytes);
});
```

## sul-profile-experiment/cli.mjs

```js
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { encodeBest, decode } from './codec.mjs';
import { profileId } from './profile.mjs';

const [command, input, output] = process.argv.slice(2), root = new URL('./', import.meta.url);
if (!['encode', 'decode'].includes(command) || !input || !output) throw new Error('Usage: node sul-profile-experiment/cli.mjs encode|decode INPUT OUTPUT');
const bytes = fs.readFileSync(input);
if (command === 'encode') {
    const registry = JSON.parse(fs.readFileSync(new URL('registry.json', root)));
    const profiles = registry.profiles.map(entry => ({ ...entry, profile: JSON.parse(fs.readFileSync(new URL(entry.file, root))) }));
    for (const entry of profiles) assert.equal(entry.id, 'sha256:' + profileId(entry.profile));
    const { best, candidates } = encodeBest(bytes, profiles), byId = new Map(profiles.map(p => [profileId(p.profile), p.profile]));
    assert.deepEqual(decode(best.encoded, byId), bytes);
    fs.writeFileSync(output, best.encoded);
    console.log(JSON.stringify({ selected: best.name, bytes: best.encoded.length, candidates: candidates.map(c => ({ profile: c.name, bytes: c.encoded.length })) }));
} else {
    const registry = new Map();
    if (bytes.subarray(0, 4).toString() === 'SULP' && bytes.length >= 37) {
        const id = bytes.subarray(5, 37).toString('hex');
        registry.set(id, JSON.parse(fs.readFileSync(new URL(`profiles/${id}.json`, root))));
    }
    fs.writeFileSync(output, decode(bytes, registry));
}
```

## sul-profile-experiment/select-corpus.py

```python
"""Recreate the pinned pilot corpus from the named local public source checkouts."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess

root = Path(__file__).resolve().parent.parent
out = Path(__file__).resolve().parent
fs = root / 'functionalscript-pr'
brotli = root / 'brotli-inspection'
ts = root / 'sul-pr-tools/node_modules/typescript'
sha = lambda data: hashlib.sha256(data).hexdigest()
tracked = subprocess.check_output(['git', 'ls-files'], cwd=fs, text=True).splitlines()
groups = {}
for category, extensions in [('source', {'.mjs', '.ts'}), ('text', {'.md'})]:
    paths = [s for s in tracked if Path(s).suffix in extensions and '/research/' not in s and 'proof' not in Path(s).name and (fs/s).is_file() and 512 <= (fs/s).stat().st_size <= 8192]
    paths.sort(key=lambda s: sha(s.encode()))
    groups[category] = [('functionalscript', fs/s, s) for s in paths[:9]]
paths = [p for p in brotli.rglob('*.c') if 512 <= p.stat().st_size <= 8192]
paths.sort(key=lambda p: sha(str(p.relative_to(brotli)).encode()))
groups['c'] = [('brotli', p, str(p.relative_to(brotli))) for p in paths[:9]]
groups['json'] = [('functionalscript', fs/s, s) for s in ['package-lock.json', 'deno.json', 'funding.json', 'package.json']] + [('brotli', brotli/'js/package.json', 'js/package.json'), ('typescript', ts/'package.json', 'package.json')]
groups['json'].sort(key=lambda x: sha((x[0] + '/' + x[2]).encode()))
files = []
(out/'corpus').mkdir(exist_ok=True)
for category, paths in groups.items():
    train_count = 4 if category == 'json' else 6
    for index, (project, path, original) in enumerate(paths):
        data = path.read_bytes()
        name = f'{category}-{index:02}'
        local = f'corpus/{name}{path.suffix}'
        (out/local).write_bytes(data)
        files.append(dict(name=name, category=category, split='train' if index < train_count else 'test', project=project, source=original, local=local, bytes=len(data), sha256=sha(data), ascii=all(b < 128 for b in data)))
path = brotli/'tests/testdata/cp1251-utf16le.compressed'
data = path.read_bytes()
(out/'corpus/binary-00.compressed').write_bytes(data)
files.append(dict(name='binary-00', category='binary', split='test', project='brotli', source=str(path.relative_to(brotli)), local='corpus/binary-00.compressed', bytes=len(data), sha256=sha(data), ascii=False))
train_hashes = {f['sha256'] for f in files if f['split'] == 'train'}
assert not train_hashes.intersection(f['sha256'] for f in files if f['split'] == 'test')
manifest = dict(version=1, selection='Source, markdown and C files: first nine by SHA-256 of relative path among whole files of 512..8192 bytes; first six train, next three test. JSON: six named real package/configuration files sorted by SHA-256(project/path), first four train and last two test. One pre-existing compressed test file is an out-of-domain control. No selection uses compressed sizes.',
    sourceRevisions=dict(functionalscript=subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=fs, text=True).strip(), brotli=subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=brotli, text=True).strip(), typescript=json.loads((ts/'package.json').read_text())['version']), files=files)
(out/'corpus.json').write_text(json.dumps(manifest, indent=2)+'\n')
(out/'licenses').mkdir(exist_ok=True)
for name, path in [('FunctionalScript-MIT.txt', fs/'LICENSE'), ('Brotli-MIT.txt', brotli/'LICENSE'), ('TypeScript-LICENSE.txt', ts/'LICENSE'), ('TypeScript-NOTICE.txt', ts/'NOTICE.txt')]:
    shutil.copyfile(path, out/'licenses'/name)
print(json.dumps({split: {'files': sum(f['split']==split for f in files), 'bytes': sum(f['bytes'] for f in files if f['split']==split)} for split in ['train','test']}))
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

function literal(bits, createEncoder) {
    const coder = createEncoder(); new Writer(coder).literals(bits);
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

function recipe(entries, references, arithmetic, createEncoder) {
    const coder = arithmetic ? createEncoder() : new RawEncoder(), writer = new Writer(coder);
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
export function encodeOrdered(root, originalLength, { recursive = true, recipeModes = [false, true], createEncoder = () => new ArithmeticEncoder() } = {}) {
    const memo = new Map(), trials = [];
    const compress = (source, ceiling) => {
        const key = `${ceiling}|${source.map(node => node.key).join(',')}`;
        if (memo.has(key)) return memo.get(key);
        const bits = source.map(flatten).join('');
        let best = literal(bits, createEncoder), sequence = source;
        if (ceiling >= 0) sequence = lower(source, ceiling);
        for (let generation = ceiling; generation >= 0; generation--) {
            if (sequence.some(node => node.level > generation)) throw new Error('Invalid hierarchy frontier');
            const { entries, references } = dictionary(sequence);
            if (entries.length < sequence.length) {
                const lower = recursive ? compress(entries, generation - 1) : literal(entries.map(flatten).join(''), createEncoder);
                for (const arithmetic of recipeModes) {
                    const data = recipe(entries, references, arithmetic, createEncoder);
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
    const coder = createEncoder(); new Writer(coder).literals(original);
    for (const [mode, payload, literalMode] of [[2, bitsToBytes(original), 'raw'], [3, coder.finish(), 'arithmetic']]) {
        if (payload.length < result.encoded.length) {
            header[5] = mode;
            result = { encoded: payload, layers: [], literalBits: originalLength, literalMode };
        }
    }
    header.writeUInt32BE(originalLength, 6); header.writeUInt32BE(result.encoded.length, 10);
    return { ...result, encoded: Buffer.concat([header, result.encoded]), trials, states: memo.size, recursive, hierarchicalBytes, container: header[5] >= 2 ? 'document' : 'layers' };
}

export function decodeOrdered(buffer, { maxOutputBits = 64 * 1024 * 1024, createDecoder = bytes => new ArithmeticDecoder(bytes) } = {}) {
    if (buffer.length < HEADER || buffer.subarray(0, 4).toString() !== 'SULO' || buffer[4] !== 1 || buffer[5] > 3) throw new Error('Bad ordered-codec frame');
    const originalLength = buffer.readUInt32BE(6), padded = buffer[5] === 1;
    if (originalLength > maxOutputBits || buffer.readUInt32BE(10) !== buffer.length - HEADER) throw new Error('Length limit or truncated frame');
    if (buffer[5] >= 2) {
        const payload = buffer.subarray(HEADER);
        if (buffer[5] === 3) return new Reader(createDecoder(payload)).literals(originalLength);
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
            return new Reader(createDecoder(payload)).literals(length);
        }
        if (mode > 3) throw new Error('Unknown ordered-codec mode');
        const size = integer(); if (size > buffer.length - offset) throw new Error('Truncated recipe');
        const payload = buffer.subarray(offset, offset + size); offset += size;
        const coder = mode === 3 ? createDecoder(payload) : new RawDecoder(payload), reader = new Reader(coder);
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
