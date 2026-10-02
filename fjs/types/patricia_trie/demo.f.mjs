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
 * trie is.
 *
 * **Every node is named by a SHA-256 hash, and titled with its first four
 * hex digits**, so a reader can check any of them with `sha256sum`:
 *
 * - a leaf, by the hash of `leaf ` and its key in binary —
 *   `leaf 00000011`;
 * - a branch, by the hash of its two children's hashes, in hex, joined by a
 *   space.
 *
 * The `leaf ` prefix keeps a leaf's hash from ever being a branch's: no
 * branch's text starts with it.
 *
 * **Keys are typed and shown in binary**, eight bits, since bits are what
 * the trie branches on. A branch shows the bits every key under it shares
 * — its prefix — and a leaf its whole key, each in two parts: the bits its
 * parent already fixed, and the bits it adds. A node both tries share may
 * have a parent in each; its parts are split at the longer parent's prefix,
 * the parent the layout also draws it beside. A trie is not balanced,
 * so a node is drawn one column right of its parent rather than every leaf
 * in the last column, which would stretch the shallow ones across the page.
 *
 * @module
 *
 * @import { _DemoNode, _DemoTrie, State } from './types.ts'
 * @import { Keys, Preset, Row, Structure } from '../../website/demo/versions/types.ts'
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
const leafId = key => hashOf(`leaf ${binary(key)}`)

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
        /** @type {(id: string) => number} */
        const lastKey = id => {
            const n = node(id)
            return n[0] === 'leaf' ? n[1] : lastKey(n[2])
        }
        /**
         * How many leading bits every key under `id` shares: all of them
         * for a leaf, and for a branch as many as its smallest and largest
         * keys share — a branch's keys differ, so that is fewer than all.
         *
         * @type {(id: string) => number}
         */
        const prefixLength = id => {
            const n = node(id)
            return n[0] === 'leaf' ? bits : bits - (firstKey(id) ^ lastKey(id)).toString(2).length
        }
        /** @type {(id: string) => number} */
        const inherited = id => [...nodes].reduce(
            (m, [p, n]) => n[0] === 'branch' && (n[1] === id || n[2] === id) ? Math.max(m, prefixLength(p)) : m, 0)
        /** @type {(id: string) => Row<string>} */
        const prefixRow = id => {
            const text = binary(firstKey(id)).slice(0, prefixLength(id))
            const split = inherited(id)
            return {
                label: '',
                inline: text,
                parts: [
                    ...(split === 0 ? [] : [/** @type {const} */ ([text.slice(0, split), 'prior'])]),
                    /** @type {const} */ ([text.slice(split), 'current']),
                ],
            }
        }
        return {
            rows: id => {
                const n = node(id)
                return n[0] === 'leaf'
                    ? [prefixRow(id)]
                    : [...(prefixLength(id) === 0 ? [] : [prefixRow(id)]), { label: 'Left', to: n[1] }, { label: 'Right', to: n[2] }]
            },
            title: id => id.slice(0, 4),
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
    ['Insert a key', spread, 0b01100100, 'Press Insert to add 01100100: the trie is built again from scratch, and only the branches above it get new hashes.'],
    ['Remove a key', spread, 0b10110100, 'Press Remove to take out 10110100: its sibling moves up, and only the branches above it change.'],
    ['Insert at the edge', spread, 0b11111010, 'Press Insert to add 11111010: the right edge of the trie changes, and the whole left half keeps its hashes.'],
    ['Worked example', worked, 0b10000000, 'The sixteen keys of example.md. Press Insert to add 10000000.'],
    ['Empty trie', [], 0b00101010, 'Press Insert to add 00101010, then keep inserting to watch the trie grow.'],
]

/**
 * Keys as the trie sees them: up to eight binary digits typed, eight shown.
 *
 * @type {Keys}
 */
const keys = {
    parse: text => text.length >= 1 && text.length <= bits && [...text].every(c => c === '0' || c === '1') ? parseInt(text, 2) : null,
    show: binary,
    label: 'Key (8 bits)',
    accepts: 'up to eight binary digits, such as 01100100',
}

const versions = versionsDemo({
    structure,
    name: 'patricia',
    noun: 'trie',
    intro: 'Each step builds the trie again from all its keys. A branch shows the bits all its keys start with, a leaf its whole key: grey, the bits its parent already fixed; dark, the bits it adds. Every node is named by a SHA-256 hash, and titled with its first four hex digits: a leaf by the hash of "leaf " and its key, a branch by the hash of its two children\'s hashes joined by a space. So every subtree whose keys did not change gets the same name, and is the same node in both tries.',
    keys,
    presets,
})

export const demo = versions.demo
export const _load = versions.load
export const _press = versions.press
export const _graphOf = versions.graphOf
export const _census = versions.census
