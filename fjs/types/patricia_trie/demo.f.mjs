/**
 * Two Patricia tries, one graph: type keys, see which subtrees the trie
 * before the step and the trie after it have in common.
 *
 * **Each trie is built from scratch**, from its sorted keys, and still the
 * two share most of their nodes. A node's identity is the hash of its two
 * children's, as in a Merkle tree, so a subtree whose leaves did not change
 * gets the same hash in both tries — and the same hash is the same node.
 * The B-tree demo shares by reusing objects; this one shares by content.
 *
 * **The demo is a [versions demo](../../website/demo/versions/module.f.mjs)**,
 * which draws both versions as one graph; this module says only what the
 * trie is. A branch is titled with the first four hex digits of its hash,
 * SHA-256 of its children's identities. A leaf is its key, in binary and in
 * decimal: the binary is what the trie branches on. A trie is not balanced,
 * so a node is drawn one column right of its parent rather than every leaf
 * in the last column, which would stretch the shallow ones across the page.
 *
 * @module
 *
 * @import { _DemoNode, _DemoTrie, State } from './types.ts'
 * @import { Preset, Row, Structure } from '../../website/demo/versions/types.ts'
 */

import { emptyState, patriciaTrie } from './module.f.mjs'
import { computeSync, sha256 } from '../../crypto/sha2/module.f.mjs'
import { uint } from '../bit_vec/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { versionsDemo } from '../../website/demo/versions/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.mjs'

/** A key's bits: the trie branches on them, most significant first. */
const bits = 8

/** @type {(key: number) => string} */
const binary = key => key.toString(2).padStart(bits, '0')

/** @type {(text: string) => string} */
const hashOf = text => uint(computeSync(sha256)([utf8(text)])).toString(16).padStart(64, '0')

/**
 * The trie's `create`: a branch's identity is the hash of its children's,
 * and the storage gathers every node built, by identity.
 *
 * @type {(a: string, b: string, storage: ReadonlyMap<string, _DemoNode>) => readonly [string, ReadonlyMap<string, _DemoNode>]}
 */
const create = (a, b, storage) => {
    const id = hashOf(`${a} ${b}`)
    /** @type {_DemoNode} */
    const branch = ['branch', a, b]
    return [id, new Map([...storage, [id, branch]])]
}

const { push, end } = patriciaTrie(create)

/** @type {(key: number) => string} */
const leafId = key => `leaf ${key}`

/**
 * The trie over `keys`, which must be sorted, built from scratch.
 *
 * @type {(keys: readonly number[]) => _DemoTrie}
 */
const build = keys => {
    /** @type {ReadonlyMap<string, _DemoNode>} */
    const leaves = new Map(keys.map(k => [leafId(k), /** @type {_DemoNode} */ (['leaf', k])]))
    /** @type {State<ReadonlyMap<string, _DemoNode>, string>} */
    const start = emptyState(leaves)
    const [root, nodes] = end(keys.reduce((s, k) => push([BigInt(k), leafId(k)], s), start))
    return { keys, root: root ?? null, nodes }
}

/** @type {(a: number, b: number) => number} */
const ascending = (a, b) => a - b

/** @type {Structure<_DemoTrie, string>} */
const structure = {
    empty: build([]),
    insert: key => trie => trie.keys.includes(key) ? trie : build([...trie.keys, key].toSorted(ascending)),
    remove: key => trie => trie.keys.includes(key) ? build(trie.keys.filter(k => k !== key)) : trie,
    root: trie => trie.root,
    // A node is looked up in either version: the same identity is the same
    // node in both, which is the whole point.
    shape: ({ before, after }) => {
        const nodes = new Map([...before.nodes, ...after.nodes])
        /** @type {(id: string) => _DemoNode} */
        const node = id => assertNotNullish(nodes.get(id))
        /** @type {(id: string) => number} */
        const firstKey = id => {
            const n = node(id)
            return n[0] === 'leaf' ? n[1] : firstKey(n[1])
        }
        return {
            rows: id => {
                const n = node(id)
                /** @type {readonly Row<string>[]} */
                const rows = n[0] === 'leaf'
                    ? [{ label: binary(n[1]), inline: String(n[1]) }]
                    : [{ label: 'Left', to: n[1] }, { label: 'Right', to: n[2] }]
                return rows
            },
            title: id => node(id)[0] === 'leaf' ? '' : id.slice(0, 4),
            order: firstKey,
            layout: 'depth',
        }
    },
}

/** The worked example's sixteen keys, from [`example.md`](./example.md). */
const worked = [
    0b11111001, 0b11110010, 0b11100011, 0b11001000, 0b10110011, 0b10100110, 0b10100011, 0b10011111,
    0b01110111, 0b01101110, 0b01011001, 0b01001001, 0b00100111, 0b00010111, 0b00010000, 0b00001110,
].toSorted(ascending)

/** The first presets' eight keys, spread over the eight bits. */
const spread = [3, 17, 40, 66, 99, 130, 180, 230]

/**
 * The presets the drop-down offers, each one press from what its name
 * says. The proofs follow each hint and check what it claims.
 *
 * @type {readonly Preset[]}
 */
export const presets = [
    ['Insert a key', spread, 100, 'Press Insert to add 100: the trie is built again from scratch, and only the branches above 100 get new hashes.'],
    ['Remove a key', spread, 180, 'Press Remove to take out 180: its sibling moves up, and only the branches above it change.'],
    ['Insert at the edge', spread, 250, 'Press Insert to add 250: the right edge of the trie changes, and the whole left half keeps its hashes.'],
    ['Worked example', worked, 128, 'The sixteen keys of example.md. Press Insert to add 128 (10000000).'],
    ['Empty trie', [], 42, 'Press Insert to add 42, then keep inserting to watch the trie grow.'],
]

const versions = versionsDemo({
    structure,
    name: 'patricia',
    noun: 'trie',
    intro: 'Each step builds the trie again from all its keys. A node is named by the hash of its children, so every subtree whose keys did not change gets the same name, and is the same node in both tries.',
    range: [0, 2 ** bits - 1],
    presets,
})

export const demo = versions.demo
export const _load = versions.load
export const _press = versions.press
export const _graphOf = versions.graphOf
export const _census = versions.census
