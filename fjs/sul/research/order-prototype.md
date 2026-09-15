# Byte-order experiment source listing

Verbatim research source; see [the report](byte-ordering.md) and [runnable archive](order-prototype.zip).

## sul-order-experiment/order.mjs

```js
// Research search over the comparison order of the 256 byte symbols.
// Orders list byte values from lowest to highest rank. Search is deterministic.
export const naturalOrder = () => Array.from({ length: 256 }, (_, i) => i);

export function rankOf(order) {
    if (order.length !== 256 || new Set(order).size !== 256 || order.some(x => !Number.isInteger(x) || x < 0 || x > 255)) throw new Error('Expected a byte permutation');
    const rank = new Uint16Array(256);
    order.forEach((byte, i) => { rank[byte] = i; });
    return rank;
}

// The final incomplete word counts as one group. This equals the number of
// level-one occurrences intersecting real input, before the padding suffix.
export function countGroups(bytes, rank) {
    let groups = 0;
    for (let i = 0; i < bytes.length; groups++) {
        let j = i + 1;
        while (j < bytes.length && rank[bytes[j - 1]] > rank[bytes[j]]) j++;
        i = Math.min(j + 1, bytes.length);
    }
    return groups;
}

export function measureGroups(bytes, order) {
    const rank = rankOf(order), unique = new Set(), histogram = {};
    let groups = 0, complete = 0, longest = 0, pendingBytes = 0;
    for (let i = 0; i < bytes.length; groups++) {
        let j = i + 1;
        while (j < bytes.length && rank[bytes[j - 1]] > rank[bytes[j]]) j++;
        const end = Math.min(j + 1, bytes.length), length = end - i;
        if (j < bytes.length) complete++; else pendingBytes = length;
        unique.add(Buffer.from(bytes.subarray(i, end)).toString('hex'));
        histogram[length] = (histogram[length] ?? 0) + 1;
        longest = Math.max(longest, length); i = end;
    }
    return { groups, complete, pendingBytes, unique: unique.size, meanLength: groups ? bytes.length / groups : 0, longest, histogram };
}

function random(seed) {
    let state = seed >>> 0;
    return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 0x100000000; };
}

function transitionScore(order, matrix) {
    let result = 0;
    for (let i = 1; i < order.length; i++) for (let j = 0; j < i; j++) result += matrix[order[i] * 256 + order[j]];
    return result;
}

// Strict-improvement insertion search for the pairwise descending-edge proxy.
function improveTransitions(initial, matrix, active, maxSweeps = 12) {
    const order = [...initial];
    for (let sweep = 0; sweep < maxSweeps; sweep++) {
        let moved = false;
        for (const a of active) {
            const from = order.indexOf(a); let best = from, bestDelta = 0, delta = 0;
            for (let to = from + 1; to < order.length; to++) {
                const b = order[to]; delta += matrix[a * 256 + b] - matrix[b * 256 + a];
                if (delta > bestDelta) { bestDelta = delta; best = to; }
            }
            delta = 0;
            for (let to = from - 1; to >= 0; to--) {
                const b = order[to]; delta += matrix[b * 256 + a] - matrix[a * 256 + b];
                if (delta > bestDelta) { bestDelta = delta; best = to; }
            }
            if (best !== from) { order.splice(from, 1); order.splice(best, 0, a); moved = true; }
        }
        if (!moved) break;
    }
    return order;
}

export function optimizeByteOrder(bytes, { seed = 0x53554c31, proposals = 2048, restarts = 3 } = {}) {
    if (!Number.isInteger(proposals) || proposals < 0 || !Number.isInteger(restarts) || restarts < 1) throw new Error('Invalid search budget');
    const start = performance.now(), rng = random(seed), frequency = new Uint32Array(256), matrix = new Uint32Array(256 * 256);
    for (let i = 0; i < bytes.length; i++) { frequency[bytes[i]]++; if (i) matrix[bytes[i - 1] * 256 + bytes[i]]++; }
    const natural = naturalOrder(), active = natural.filter(x => frequency[x]), absent = natural.filter(x => !frequency[x]);
    const first = [...new Set(bytes)], byFrequency = [...active].sort((a, b) => frequency[b] - frequency[a] || a - b);
    const seeds = [natural, [...natural].reverse(), [...first, ...absent], [...byFrequency, ...absent], [...byFrequency].reverse().concat(absent)];
    for (let n = 0; n < 3; n++) { const shuffled = [...active]; for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; } seeds.push([...shuffled, ...absent]); }
    let evaluations = 0, bestOrder = natural, bestCount = countGroups(bytes, rankOf(natural));
    const improvements = [], candidates = [], seen = new Set();
    const evaluate = (order, stage) => {
        const groups = countGroups(bytes, rankOf(order)); evaluations++;
        if (groups < bestCount) { bestCount = groups; bestOrder = [...order]; improvements.push({ stage, evaluation: evaluations, groups }); }
        return groups;
    };
    for (const [index, initial] of seeds.entries()) for (const [stage, order] of [['seed', initial], ['transition', improveTransitions(initial, matrix, active)]]) {
        const key = order.join(','); if (seen.has(key)) continue; seen.add(key);
        candidates.push({ order, groups: evaluate(order, `${stage}-${index}`), proxyScore: transitionScore(order, matrix) });
    }
    candidates.sort((a, b) => a.groups - b.groups);
    if (active.length > 1) for (let restart = 0; restart < Math.min(restarts, candidates.length); restart++) {
        let current = [...candidates[restart].order], currentCount = candidates[restart].groups;
        for (let iteration = 0; iteration < proposals; iteration++) {
            const a = active[Math.floor(rng() * active.length)]; let b = active[Math.floor(rng() * active.length)];
            if (a === b) b = active[(active.indexOf(a) + 1) % active.length];
            const candidate = [...current], from = candidate.indexOf(a), to = candidate.indexOf(b);
            if (iteration % 2) [candidate[from], candidate[to]] = [candidate[to], candidate[from]];
            else { candidate.splice(from, 1); candidate.splice(to, 0, a); }
            const groups = evaluate(candidate, `direct-${restart}`);
            const fraction = proposals <= 1 ? 1 : iteration / (proposals - 1);
            const temperature = Math.max(0.1, Math.max(1, bytes.length * 0.001) * (1 - fraction) ** 3);
            if (groups <= currentCount || rng() < Math.exp((currentCount - groups) / temperature)) { current = candidate; currentCount = groups; }
        }
    }
    // Finish with exact full-input evaluations of adjacent active-symbol swaps.
    for (let sweep = 0; sweep < 3; sweep++) {
        let changed = false;
        const positions = bestOrder.map((byte, i) => frequency[byte] ? i : -1).filter(i => i >= 0);
        for (let i = 1; i < positions.length; i++) {
            const candidate = [...bestOrder], a = positions[i - 1], b = positions[i];
            [candidate[a], candidate[b]] = [candidate[b], candidate[a]];
            const previous = bestCount; evaluate(candidate, 'adjacent'); if (bestCount < previous) changed = true;
        }
        if (!changed) break;
    }
    return { order: bestOrder, groups: bestCount, baselineGroups: countGroups(bytes, rankOf(natural)), activeSymbols: active.length,
        seed, proposals, restarts, evaluations, searchMs: performance.now() - start, improvements,
        seedCandidates: candidates.map(({ groups, proxyScore }) => ({ groups, proxyScore })) };
}
```

## sul-order-experiment/codec.mjs

```js
import { bytesToBits, bitsToBytes } from '../sul-compression-research/sul-graph.mjs';
import { fixedSymbolTree } from '../sul-byte-experiment/levels.mjs';
import { encodeOrdered, decodeOrdered } from '../sul-ordered-experiment/ordered.mjs';
import { naturalOrder, optimizeByteOrder } from './order.mjs';

export function encodeWithOrder(bytes, order = naturalOrder()) {
    const bits = bytesToBits(bytes), start = performance.now();
    const tree = fixedSymbolTree(bits, 8, { byteOrder: order }), treeMs = performance.now() - start;
    const encodeStart = performance.now(), result = encodeOrdered(tree.root, bits.length);
    return { tree, treeMs, encodeMs: performance.now() - encodeStart, ...result };
}

export function encodeOptimized(bytes, options) {
    const search = optimizeByteOrder(bytes, options);
    return { search, ...encodeWithOrder(bytes, search.order) };
}

export function decodeBytes(encoded) { return bitsToBytes(decodeOrdered(encoded)); }
```

## sul-order-experiment/test.mjs

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { naturalOrder, rankOf, countGroups, measureGroups, optimizeByteOrder } from './order.mjs';
import { encodeWithOrder, decodeBytes } from './codec.mjs';
import { fixedSymbolTree } from '../sul-byte-experiment/levels.mjs';
import { bytesToBits } from '../sul-compression-research/sul-graph.mjs';
import { flatten } from '../sul-ordered-experiment/levels.mjs';

test('full byte permutations are validated', () => {
    assert.equal(new Set(rankOf(naturalOrder())).size, 256);
    for (const bad of [[0], Array(256).fill(0), [...naturalOrder().slice(0,255),256]]) assert.throws(() => rankOf(bad));
    assert.throws(() => fixedSymbolTree('0', 1, { byteOrder: naturalOrder() }));
});

test('group-count scan agrees with an independent streaming stopping-rule oracle', () => {
    const permutations = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
    for (const first of permutations) {
        const rank = rankOf([...first, ...naturalOrder().slice(3)]);
        for (let length = 0; length <= 6; length++) for (let value = 0; value < 3 ** length; value++) {
            let n = value; const bytes = Buffer.alloc(length);
            for (let i = 0; i < length; i++) { bytes[i] = n % 3; n = Math.floor(n / 3); }
            let last, groups = 0;
            for (const byte of bytes) { const next = rank[byte]; if (last === undefined) last = next; else if (next < last) last = next; else { groups++; last = undefined; } }
            if (last !== undefined) groups++;
            assert.equal(countGroups(bytes, rank), groups);
        }
    }
});

test('natural comparison keys preserve the existing byte hierarchy and root', () => {
    for (const bytes of [Buffer.alloc(0), Buffer.from([255]), Buffer.from(naturalOrder()), Buffer.from('SUL orders bytes, but preserves their payload.\n'.repeat(4))]) {
        const bits = bytesToBits(bytes), a = fixedSymbolTree(bits,8), b = fixedSymbolTree(bits,8,{byteOrder:naturalOrder()});
        assert.equal(a.root.value,b.root.value); assert.equal(a.paddedBits,b.paddedBits); assert.deepEqual(a.stats,b.stats); assert.equal(flatten(a.root),flatten(b.root));
    }
});

test('a reversed order can keep a 256-byte ascending prefix in one completed word', () => {
    const bytes = Buffer.from([...naturalOrder(),255]), order = naturalOrder().reverse();
    assert.equal(measureGroups(bytes,order).groups,1); assert.equal(measureGroups(bytes,order).longest,257);
    const result = encodeWithOrder(bytes,order); assert.deepEqual(decodeBytes(result.encoded),bytes);
    assert.equal(flatten(result.tree.root).slice(0,bytes.length*8),bytesToBits(bytes));
});

test('the decoder restores original bytes without knowing the optimized order', () => {
    const bytes = Buffer.concat([Buffer.from('λ FunctionalScript 🙂\n'.repeat(12)),Buffer.from(naturalOrder())]);
    const search = optimizeByteOrder(bytes,{proposals:64,restarts:2});
    const result = encodeWithOrder(bytes,search.order); assert.deepEqual(decodeBytes(result.encoded),bytes);
    let count = 0;
    const visit = (node, offset) => { if(offset>=bytes.length*8)return; if(node.level===1){count++;return;} for(const child of node.children??[]){visit(child,offset);offset+=child.length;} };
    visit(result.tree.root,0); assert.equal(count,search.groups);
});

test('search is deterministic and retains the natural-order group-count bound', () => {
    for(const bytes of [Buffer.alloc(0),Buffer.alloc(63,5),Buffer.from('ABCD '.repeat(30)),Buffer.from(naturalOrder())]) {
        const a = optimizeByteOrder(bytes,{proposals:64,restarts:2}), b = optimizeByteOrder(bytes,{proposals:64,restarts:2});
        assert.deepEqual(a.order,b.order); assert.equal(a.groups,b.groups); assert.ok(a.groups<=a.baselineGroups); assert.equal(measureGroups(bytes,a.order).groups,a.groups);
    }
});
```

## sul-order-experiment/benchmark.mjs

```js
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fixtures } from '../sul-ordered-experiment/benchmark.mjs';
import { naturalOrder, measureGroups, optimizeByteOrder } from './order.mjs';
import { encodeWithOrder, decodeBytes } from './codec.mjs';

const prior = JSON.parse(fs.readFileSync(new URL('../sul-byte-experiment/results/results.json',import.meta.url)));
const directory = new URL('./results/',import.meta.url); fs.mkdirSync(directory,{recursive:true});
const selected = process.argv.slice(2), inputs = selected.length ? fixtures.filter(([name])=>selected.includes(name)) : fixtures;
const report = {version:1,node:process.version,sulCommit:prior.sulCommit,scope:'Optimize only the comparison order of byte symbols at level zero, independently per input. Higher levels retain numeric SUL-ID ordering.',
    objective:'Minimum full-input level-one group occurrences; final incomplete word counted once. No compression size is used during order search.',
    orderDirection:'ascending rank: order[0] is lowest; order[255] is highest',
    search:{seed:0x53554c31,proposals:2048,restarts:3,description:'Eight initial orders plus transition insertion search, followed by bounded simulated annealing on exact group count and up to three adjacent-swap sweeps.'},
    format:'Unchanged SULO v1. Original byte payloads and explicit reconstruction recipes make the order unnecessary to decode; no uncounted shared resource.',fixtures:[]};
for(const [name,bytes,description] of inputs) {
    const start = performance.now(), previous = prior.fixtures.find(x=>x.name===name), sha256=createHash('sha256').update(bytes).digest('hex'); assert.equal(sha256,previous.sha256);
    const search=optimizeByteOrder(bytes,report.search), originalGroups=measureGroups(bytes,naturalOrder()), optimizedGroups=measureGroups(bytes,search.order);
    console.log(JSON.stringify({phase:'search',name,originalGroups:originalGroups.groups,optimizedGroups:optimizedGroups.groups,meanBefore:originalGroups.meanLength,meanAfter:optimizedGroups.meanLength,seconds:+(search.searchMs/1000).toFixed(2)}));
    const row={name,description,inputBytes:bytes.length,sha256,originalGroups,optimizedGroups,search,baselineBytes:previous.rawByteRecursive.bytes,brotli11Bytes:previous.brotli11Bytes,zstd19Bytes:previous.zstd19Bytes};
    for(const [label,order] of [['natural',naturalOrder()],['optimized',search.order]]) {
        const result=encodeWithOrder(bytes,order), beforeDecode=performance.now(); assert.deepEqual(decodeBytes(result.encoded),bytes);
        const decodeMs=performance.now()-beforeDecode;
        if(label==='natural') {
            assert.equal(result.encoded.length,previous.rawByteRecursive.bytes);
            assert.deepEqual(result.encoded,fs.readFileSync(new URL(`../sul-byte-experiment/results/${name}-rawByteRecursive.sulo`,import.meta.url)));
        }
        let actualGroups=0;
        const visit=(node,offset)=>{if(offset>=bytes.length*8)return;if(node.level===1){actualGroups++;return;}for(const child of node.children??[]){visit(child,offset);offset+=child.length;}};visit(result.tree.root,0);
        assert.equal(actualGroups,label==='natural'?originalGroups.groups:optimizedGroups.groups);
        row[label]={bytes:result.encoded.length,hierarchicalBytes:result.hierarchicalBytes,container:result.container,layers:result.layers,literalBits:result.literalBits,literalMode:result.literalMode,
            treeMs:result.treeMs,encodeMs:result.encodeMs,decodeMs,paddedBits:result.tree.paddedBits,paddingSymbols:result.tree.paddingSymbols,levels:result.tree.stats,states:result.states,trials:result.trials};
        fs.writeFileSync(new URL(`${name}-${label}.sulo`,directory),result.encoded);
    }
    row.groupReduction=1-optimizedGroups.groups/originalGroups.groups;row.compressionReduction=1-row.optimized.bytes/row.natural.bytes;row.bestOfTwoBytes=Math.min(row.natural.bytes,row.optimized.bytes);row.totalMs=performance.now()-start;report.fixtures.push(row);
    fs.writeFileSync(new URL('results.json',directory),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({phase:'compression',name,natural:row.natural.bytes,optimized:row.optimized.bytes,brotli:row.brotli11Bytes,seconds:+(row.totalMs/1000).toFixed(2)}));
}
const fields=['name','inputBytes','naturalGroups','optimizedGroups','naturalMeanLength','optimizedMeanLength','groupReduction','naturalBytes','optimizedBytes','compressionReduction','bestOfTwoBytes','brotli11Bytes','zstd19Bytes','searchMs'];
const rows=report.fixtures.map(r=>({...r,naturalGroups:r.originalGroups.groups,optimizedGroups:r.optimizedGroups.groups,naturalMeanLength:r.originalGroups.meanLength,optimizedMeanLength:r.optimizedGroups.meanLength,naturalBytes:r.natural.bytes,optimizedBytes:r.optimized.bytes,searchMs:r.search.searchMs}));
fs.writeFileSync(new URL('summary.csv',directory),fields.join(',')+'\n'+rows.map(row=>fields.map(k=>row[k]).join(',')).join('\n')+'\n');
console.log(`All ${inputs.length*2} files decoded exactly; all ${inputs.length} natural controls reproduced previous compressed files byte for byte.`);
```

## sul-order-experiment/generalization.mjs

```js
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { naturalOrder, measureGroups } from './order.mjs';

const results=JSON.parse(fs.readFileSync(new URL('./results/results.json',import.meta.url)));
const randomBytes=(length,initial)=>{let seed=initial;const out=Buffer.alloc(length);for(let i=0;i<length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;out[i]=(seed>>>0)&255;}return out;};
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const vendor=fileURLToPath(new URL('../sul-compression-research/vendor/',import.meta.url));
const source=Buffer.concat(walk(vendor).filter(p=>p.endsWith('.mjs')).map(p=>fs.readFileSync(p)));
assert.ok(source.length>65536);
const cases=[['source_code',source.subarray(65536,131072),'Next available source bytes after the 64 KiB fitting sample; not used by order search.'],
    ['uniform_random',randomBytes(65536,0x81ac339b),'Independent xorshift32 stream, seed 0x81ac339b; not used by order search.']];
const rows=cases.map(([name,bytes,description])=>{const order=results.fixtures.find(r=>r.name===name).search.order;return {name,description,inputBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),natural:measureGroups(bytes,naturalOrder()),fittedOrder:measureGroups(bytes,order)};});
fs.writeFileSync(new URL('./results/heldout.json',import.meta.url),JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({name:r.name,bytes:r.inputBytes,naturalGroups:r.natural.groups,fittedGroups:r.fittedOrder.groups,naturalMean:r.natural.meanLength,fittedMean:r.fittedOrder.meanLength})),null,2));
```

## sul-order-experiment/cli.mjs

```js
import fs from 'node:fs';
import { optimizeByteOrder } from './order.mjs';
import { encodeWithOrder, decodeBytes } from './codec.mjs';

const [command,input,output] = process.argv.slice(2);
if(!input||!['order','encode','decode'].includes(command)||command!=='order'&&!output) throw new Error('Usage: node cli.mjs order INPUT | encode INPUT OUTPUT | decode INPUT OUTPUT');
const bytes=fs.readFileSync(input);
if(command==='decode')fs.writeFileSync(output,decodeBytes(bytes));
else {
    const search=optimizeByteOrder(bytes);
    if(command==='order')console.log(JSON.stringify(search,null,2));
    else {const result=encodeWithOrder(bytes,search.order);fs.writeFileSync(output,result.encoded);console.log(JSON.stringify({bytes:result.encoded.length,groups:search.groups,order:search.order}));}
}
```

## sul-byte-experiment/levels.mjs

```js
// Experimental SUL word hierarchy with raw bit or byte leaves. This deliberately
// bypasses the native bit-specific literal pipeline; it is not a native SUL ID.
import { rawId } from '../sul-compression-research/vendor/fjs/sul/id/module.f.mjs';
import { vec } from '../sul-compression-research/vendor/fjs/types/bit_vec/module.f.mjs';
import { encode, emptyEncodeState } from '../sul-compression-research/vendor/fjs/sul/level/hash/module.f.mjs';
import { compress } from '../sul-compression-research/vendor/fjs/sul/id/module.f.mjs';
import { patriciaTrie } from '../sul-compression-research/vendor/fjs/types/patricia_trie/module.f.mjs';
import { flatten } from '../sul-ordered-experiment/levels.mjs';

export function symbolTree(bits, width = 8) {
    if (width !== 1 && width !== 8) throw new Error('Expected complete bit or byte symbols');
    return fixedSymbolTree(bits, width);
}

// Also supports the fixed-width IDs used by the Brotli dictionary experiment.
export function fixedSymbolTree(bits, width, { byteOrder } = {}) {
    if (!Number.isInteger(width) || width < 1 || width > 24 || bits.length % width || /[^01]/.test(bits)) throw new Error('Expected complete fixed-width symbols');
    if (byteOrder !== undefined && (width !== 8 || byteOrder.length !== 256 || new Set(byteOrder).size !== 256 || byteOrder.some(x => !Number.isInteger(x) || x < 0 || x > 255))) throw new Error('Expected a permutation of all 256 byte values');
    const leaves = new Map();
    const leaf = value => {
        if (!leaves.has(value)) leaves.set(value, {
            key: `raw${width}:0:${value}`, value: rawId(vec(BigInt(width))(BigInt(value))),
            level: 0, length: width, bits: value.toString(2).padStart(width, '0'),
        });
        return leaves.get(value);
    };
    const step = encode((_a, _b, _id, _symbol, storage) => storage);
    // Rank is only the level-zero comparison/Patricia key. The value supplied
    // to compress remains the original byte identity, never the byte's rank.
    let firstStep = step;
    if (byteOrder !== undefined) {
        const ranks = new Map(byteOrder.map((value, rank) => [leaf(value).value, BigInt(rank)]));
        const trie = patriciaTrie((a, b, storage) => [compress(a, b), storage]);
        firstStep = (value, state) => {
            const key = ranks.get(value), stack = state[1];
            if (stack.length === 0 || stack.at(-1)[0] > key) return [undefined, trie.push([key, value], state)];
            const [prefix, storage] = trie.end(state);
            return [compress(prefix, value), [storage, []]];
        };
    }
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
            const [value, state] = (index === 0 ? firstStep : step)(child.value, level.state); level.state = state;
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

## sul-order-experiment/successors.mjs

```js
// Additional grouping-only candidates; the original order-search run is retained.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fixtures } from '../sul-ordered-experiment/benchmark.mjs';
import { naturalOrder, rankOf, measureGroups } from './order.mjs';

function statistics(bytes) {
    const frequency = new Uint32Array(256), transitions = new Uint32Array(65536);
    for (let i = 0; i < bytes.length; i++) {
        frequency[bytes[i]]++;
        if (i) transitions[bytes[i - 1] * 256 + bytes[i]]++;
    }
    const active = naturalOrder().filter(x => frequency[x]).sort((a, b) => frequency[b] - frequency[a] || a - b);
    return { frequency, transitions, active, absent: naturalOrder().filter(x => !frequency[x]) };
}

function chain(stats, leastStart = false) {
    const { frequency, transitions, active, absent } = stats;
    const remaining = new Set(active), highToLow = [];
    while (remaining.size) {
        const last = highToLow.at(-1);
        const next = [...remaining].sort((a, b) => (last === undefined ? 0 : transitions[last * 256 + b] - transitions[last * 256 + a]) || (last === undefined && leastStart ? frequency[a] - frequency[b] : frequency[b] - frequency[a]) || a - b)[0];
        highToLow.push(next); remaining.delete(next);
    }
    return { order: highToLow.reverse().concat(absent) };
}

function dag(stats, mode) {
    const { frequency, transitions, absent } = stats, candidates = [];
    const active = mode === 'leastFrequencyFirstDag' ? [...stats.active].sort((a, b) => frequency[a] - frequency[b] || a - b) : stats.active;
    if (mode === 'frequencyFirstDag' || mode === 'leastFrequencyFirstDag') {
        // For a fixed source a, sorting counts is equivalent to sorting P(b | a).
        for (const a of active) {
            const successors = active.filter(b => b !== a && transitions[a * 256 + b]).sort((b, c) => transitions[a * 256 + c] - transitions[a * 256 + b] || frequency[c] - frequency[b] || b - c);
            for (const b of successors) candidates.push([a, b, transitions[a * 256 + b]]);
        }
    } else {
        // Competing orientations differ by C(a,b)-C(b,a), not just C(a,b).
        for (const a of active) for (const b of active) {
            const margin = transitions[a * 256 + b] - transitions[b * 256 + a];
            if (margin > 0) candidates.push([a, b, margin]);
        }
        candidates.sort((a, b) => b[2] - a[2] || frequency[b[0]] - frequency[a[0]] || a[0] - b[0] || a[1] - b[1]);
    }
    const reach = Array(256).fill(0n), outgoing = Array.from({ length: 256 }, () => []), indegree = new Uint16Array(256);
    const accepted = []; let rejectedCycles = 0;
    for (const [a, b, weight] of candidates) {
        const abit = 1n << BigInt(a), bbit = 1n << BigInt(b);
        if (reach[b] & abit) { rejectedCycles++; continue; }
        const addition = reach[b] | bbit;
        for (const p of active) if (p === a || (reach[p] & abit)) reach[p] |= addition;
        outgoing[a].push(b); indegree[b]++; accepted.push([a, b, weight]);
    }
    // Edges point from higher rank to lower rank. Frequency resolves unrelated nodes.
    const pending = new Set(active), highToLow = [];
    while (pending.size) {
        const a = active.find(x => pending.has(x) && indegree[x] === 0);
        assert.notEqual(a, undefined, 'Cycle remained in the graph');
        highToLow.push(a); pending.delete(a);
        for (const b of outgoing[a]) indegree[b]--;
    }
    const order = highToLow.reverse().concat(absent), rank = rankOf(order);
    for (const [a, b] of accepted) assert(rank[a] > rank[b]);
    return { order, candidateEdges: candidates.length, acceptedEdges: accepted.length, rejectedCycles };
}

function descendingWeight(stats, order) {
    const rank = rankOf(order); let count = 0;
    for (const a of stats.active) for (const b of stats.active) if (rank[a] > rank[b]) count += stats.transitions[a * 256 + b];
    return count;
}

// A genuine directed cycle must be broken; a pure descending chain must be kept.
const cycle = dag(statistics(Uint8Array.of(0, 1, 2, 0, 1, 2, 0)), 'frequencyFirstDag');
assert.equal(cycle.acceptedEdges, 2); assert.equal(cycle.rejectedCycles, 1);
assert.deepEqual(cycle.order.slice(0, 3), [2, 1, 0]);
assert.deepEqual(chain(statistics(Uint8Array.of(0, 1, 2))).order.slice(0, 3), [2, 1, 0]);
assert.deepEqual(chain(statistics(new Uint8Array())).order, naturalOrder());

const previous = JSON.parse(fs.readFileSync(new URL('./results/results.json', import.meta.url)));
const report = { version: 1, scope: 'Grouping-only evaluation of five deterministic transition-graph candidates; no arithmetic coding or complete compression rerun.',
    orderDirection: 'ascending rank: original byte values, not substituted output bytes',
    methods: { successorChain: 'Start at the most frequent byte; choose the most frequent still-unvisited successor, breaking ties by frequency then byte. Reverse traversal to obtain ascending ranks.',
        successorChainLeastStart: 'As successorChain, but begin with the least frequent observed byte. Only the first choice changes.',
        frequencyFirstDag: 'Process sources by frequency, successors by conditional probability. Accept each edge unless it closes a cycle; topologically sort with frequency tie-breaking, then reverse.',
        leastFrequencyFirstDag: 'As frequencyFirstDag, but process least frequent sources first and prefer the least frequent available source during topological sorting.',
        marginDag: 'Orient each unequal pair toward the larger transition count, process descending net margins, reject cycles, topologically sort with frequency tie-breaking, then reverse.' }, fixtures: [] };
for (const [name, bytes] of fixtures) {
    const old = previous.fixtures.find(x => x.name === name);
    assert(old, 'Run the complete original benchmark first');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), old.sha256);
    const stats = statistics(bytes), row = { name, inputBytes: bytes.length, sha256: old.sha256, naturalGroups: old.originalGroups.groups,
        previousBestSeedGroups: Math.min(...old.search.seedCandidates.map(x => x.groups)), previousSearchedGroups: old.optimizedGroups.groups, candidates: {} };
    for (const method of ['successorChain', 'successorChainLeastStart', 'frequencyFirstDag', 'leastFrequencyFirstDag', 'marginDag']) {
        const start = performance.now(), result = method.startsWith('successorChain') ? chain(stats, method === 'successorChainLeastStart') : dag(stats, method);
        row.candidates[method] = { ...result, ...measureGroups(bytes, result.order), descendingTransitionCount: descendingWeight(stats, result.order), milliseconds: performance.now() - start };
    }
    report.fixtures.push(row);
    console.log(JSON.stringify({ name, natural: row.naturalGroups, previousSeed: row.previousBestSeedGroups, searched: row.previousSearchedGroups,
        ...Object.fromEntries(Object.entries(row.candidates).map(([k, v]) => [k, v.groups])) }));
}
fs.writeFileSync(new URL('./results/successors.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log('All fixture hashes, full permutations, accepted-edge orientations, cycle and chain checks passed.');
```
