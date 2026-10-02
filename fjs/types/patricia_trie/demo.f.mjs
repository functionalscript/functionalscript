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
 * **A node's title is the first four hex digits of its hash**, SHA-256 of
 * its children's identities. A leaf is its key, in binary and in decimal:
 * the binary is what the trie branches on.
 *
 * **The drawing is the B-tree demo's**: leaves in the last column, each
 * column in key order, an arrow into each version's root, and a node's
 * colour saying which versions hold it — blue only in the new one, amber
 * and faded only in the old one, plain in both.
 *
 * **It needs no operations.** Building, hashing and walking are pure, so
 * `update` declares `never`.
 *
 * @module
 *
 * @import { _DemoNode, _DemoState, _DemoVersions, State } from './types.ts'
 * @import { Examples } from '../../website/demo/examples/types.ts'
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Edge, Graph } from '../../website/demo/graph/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 */

import { emptyState, patriciaTrie } from './module.f.mjs'
import { computeSync, sha256 } from '../../crypto/sha2/module.f.mjs'
import { uint } from '../bit_vec/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { graphSvg } from '../../website/demo/graph/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { examplePicker, name as exampleName } from '../../website/demo/examples/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.mjs'

/** A key's bits: the trie branches on them, most significant first. */
const bits = 8

/**
 * `text` as a key, or `null` if it is none: an integer the trie's eight bits
 * can hold, spelled the way `String` spells it.
 *
 * @type {(text: string) => number | null}
 */
const keyOf = text => {
    const key = Number(text)
    return Number.isSafeInteger(key) && String(key) === text && 0 <= key && key < 2 ** bits ? key : null
}

/** @type {(key: number) => string} */
const binary = key => key.toString(2).padStart(bits, '0')

/** @type {(text: string) => string} */
const hashOf = text => uint(computeSync(sha256)([utf8(text)])).toString(16).padStart(64, '0')

/**
 * The trie's `create`: a branch's identity is the hash of its children's,
 * and the storage gathers every branch built, by identity.
 *
 * @type {(a: string, b: string, storage: ReadonlyMap<string, _DemoNode>) => readonly [string, ReadonlyMap<string, _DemoNode>]}
 */
const create = (a, b, storage) => {
    const id = hashOf(`${a} ${b}`)
    return [id, new Map([...storage, [id, /** @type {_DemoNode} */ (['branch', a, b])]])]
}

const { push, end } = patriciaTrie(create)

/** @type {(key: number) => string} */
const leafId = key => `leaf ${key}`

/**
 * The trie over `keys`, built from scratch: its root's identity, or `null`
 * for no keys, and every node by identity.
 *
 * @type {(keys: readonly number[]) => readonly [string | null, ReadonlyMap<string, _DemoNode>]}
 */
const build = keys => {
    /** @type {ReadonlyMap<string, _DemoNode>} */
    const leaves = new Map(keys.map(k => [leafId(k), /** @type {_DemoNode} */ (['leaf', k])]))
    /** @type {State<ReadonlyMap<string, _DemoNode>, string>} */
    const start = emptyState(leaves)
    const state = keys.reduce((s, k) => push([BigInt(k), leafId(k)], s), start)
    const [root, nodes] = end(state)
    return [root ?? null, nodes]
}

/**
 * Every identity reachable from `root`, each once.
 *
 * @type {(nodes: ReadonlyMap<string, _DemoNode>) => (root: string | null) => readonly string[]}
 */
const reachable = nodes => root => {
    if (root === null) { return [] }
    const node = assertNotNullish(nodes.get(root))
    return node[0] === 'leaf' ? [root] : [root, ...reachable(nodes)(node[1]), ...reachable(nodes)(node[2])]
}

/** @type {(kind: string) => number} */
const kindOrder = kind => kind === 'replaced' ? 0 : kind === 'shared' ? 1 : 2

/**
 * Both tries as one graph: the nodes they share drawn once, leaves in the
 * last column, each column in key order — by the smallest key under a
 * node — and an arrow into each root, the old one's faded.
 *
 * @type {(v: _DemoVersions) => Graph}
 */
export const _graphOf = ({ before, after }) => {
    const [oldRoot, oldNodes] = build(before)
    const [newRoot, newNodes] = build(after)
    const nodes = new Map([...oldNodes, ...newNodes])
    const node = /** @type {(id: string) => _DemoNode} */ (id => assertNotNullish(nodes.get(id)))
    const old = reachable(nodes)(oldRoot)
    const current = reachable(nodes)(newRoot)
    /** @type {(id: string) => string} */
    const kindOf = id => !old.includes(id) ? 'new' : current.includes(id) ? 'shared' : 'replaced'
    /** @type {(id: string) => number} */
    const heightOf = id => {
        const n = node(id)
        return n[0] === 'leaf' ? 0 : 1 + Math.max(heightOf(n[1]), heightOf(n[2]))
    }
    /** @type {(id: string) => number} */
    const firstKey = id => {
        const n = node(id)
        return n[0] === 'leaf' ? n[1] : firstKey(n[1])
    }
    const ids = [...current, ...old.filter(id => !current.includes(id))]
        .toSorted((a, b) => firstKey(a) - firstKey(b) || heightOf(b) - heightOf(a) || kindOrder(kindOf(a)) - kindOrder(kindOf(b)))
    /** @type {(id: string) => readonly string[]} */
    const childrenOf = id => {
        const n = node(id)
        return n[0] === 'leaf' ? [] : [n[1], n[2]]
    }
    /** @type {(id: string) => number} */
    const depthOf = id => {
        const parents = ids.filter(p => childrenOf(p).includes(id))
        return parents.reduce((m, p) => Math.max(m, depthOf(p) + 1), 0)
    }
    return {
        nodes: ids.map((id, i) => {
            const n = node(id)
            return { id: i, kind: kindOf(id), label: n[0] === 'leaf' ? '' : id.slice(0, 4), rank: depthOf(id) }
        }),
        entries: [
            ...(oldRoot === null || oldRoot === newRoot ? [] : [{ to: ids.indexOf(oldRoot), kind: 'replaced' }]),
            ...(newRoot === null ? [] : [{ to: ids.indexOf(newRoot) }]),
        ],
        edges: ids.flatMap(/** @type {(id: string, i: number) => readonly Edge[]} */ ((id, i) => {
            const n = node(id)
            const kind = kindOf(id) === 'replaced' ? 'replaced' : undefined
            return n[0] === 'leaf'
                ? [{ from: i, to: { inline: String(n[1]) }, label: binary(n[1]) }]
                : [{ from: i, to: ids.indexOf(n[1]), label: 'Left', kind }, { from: i, to: ids.indexOf(n[2]), label: 'Right', kind }]
        })),
    }
}

/**
 * How many nodes the step built, how many the two tries share, and how many
 * only the old one has.
 *
 * @type {(v: _DemoVersions) => { readonly built: number, readonly shared: number, readonly replaced: number }}
 */
export const _census = versions => {
    const { nodes } = _graphOf(versions)
    /** @type {(kind: string) => number} */
    const count = kind => nodes.filter(n => n.kind === kind).length
    return { built: count('new'), shared: count('shared'), replaced: count('replaced') }
}

/**
 * `state` after pressing `op`'s button: the new key set becomes the old one,
 * or, if the field holds no key, the same sets and a reason.
 *
 * @type {(op: 'insert' | 'remove') => (state: _DemoState) => _DemoState}
 */
export const _press = op => state => {
    const key = keyOf(state.key.trim())
    if (key === null) { return { ...state, error: `"${state.key}" is not a key: type an integer from 0 to ${2 ** bits - 1}.` } }
    const { after } = state.versions
    const next = op === 'insert'
        ? (after.includes(key) ? after : [...after, key].toSorted((a, b) => a - b))
        : after.filter(k => k !== key)
    return { key: state.key, versions: { before: after, after: next }, status: { last: `${op} ${key}` }, error: null }
}

/**
 * The presets: a name, the starting keys, the key put in the field, and the
 * hint naming the button to press.
 *
 * The first set is spread over the eight bits; the worked example is the
 * sixteen keys of [`example.md`](./example.md).
 *
 * @type {readonly (readonly [name: string, keys: readonly number[], key: number, hint: string])[]}
 */
export const presets = [
    ['Insert a key', [3, 17, 40, 66, 99, 130, 180, 230], 100,
        'Press Insert to add 100: the trie is built again from scratch, and only the branches above 100 get new hashes.'],
    ['Remove a key', [3, 17, 40, 66, 99, 130, 180, 230], 180,
        'Press Remove to take out 180: its sibling moves up, and only the branches above it change.'],
    ['Insert at the edge', [3, 17, 40, 66, 99, 130, 180, 230], 250,
        'Press Insert to add 250: the right edge of the trie changes, and the whole left half keeps its hashes.'],
    ['Worked example', [0b11111001, 0b11110010, 0b11100011, 0b11001000, 0b10110011, 0b10100110, 0b10100011, 0b10011111,
        0b01110111, 0b01101110, 0b01011001, 0b01001001, 0b00100111, 0b00010111, 0b00010000, 0b00001110].toSorted((a, b) => a - b), 128,
        'The sixteen keys of example.md. Press Insert to add 128 (10000000).'],
    ['Empty trie', [], 42, 'Press Insert to add 42, then keep inserting to watch the trie grow.'],
]

const picker = examplePicker(presets.map(([n]) => [n, n]))

/**
 * The state a preset loads: its keys as both versions, so every node is
 * shared until the first press.
 *
 * @type {(name: string) => _DemoState}
 */
export const _load = name => {
    const source = picker.pick(name)
    const [, keys, key, hint] = assertNotNullish(presets.find(([n]) => n === source))
    return { key: String(key), versions: { before: keys, after: keys }, status: { preset: name, hint }, error: null }
}

/** @type {(last: string) => (versions: _DemoVersions) => string} */
const lastLine = last => versions => {
    if (versions.before === versions.after) { return `Last step, ${last}: nothing changed.` }
    const { built, shared, replaced } = _census(versions)
    return `Last step, ${last}: ${built} new (blue), ${shared} shared with the trie before, ${replaced} replaced (amber).`
}

/** @type {(v: _DemoVersions) => readonly Element[]} */
const drawing = versions => [
    ...(versions.before.length === 0 && versions.after.length === 0 ? [] : [graphSvg(_graphOf(versions))]),
    ...(versions.before.length === 0 ? [/** @type {const} */ (['p', 'Before is the empty trie.'])] : []),
    ...(versions.after.length === 0 ? [/** @type {const} */ (['p', 'After is the empty trie.'])] : []),
]

/**
 * The page opens on the first preset, loaded.
 *
 * @type {Demo<_DemoState, DemoEvent>}
 */
export const demo = {
    init: _load(presets[0][0]),
    update: state => event => pureOk(
        event.kind === 'input' && event.name === 'key' ? { ...state, key: event.value }
        : event.kind === 'input' && event.name === exampleName ? _load(event.value)
        : event.kind === 'click' && (event.name === 'insert' || event.name === 'remove') ? _press(event.name)(state)
        : state),
    view: ({ key, versions, status, error }) => ['div',
        ['p',
            'Each step builds the trie again from all its keys. A node is named by ',
            'the hash of its children, so every subtree whose keys did not change ',
            'gets the same name — and is the same node in both tries.',
        ],
        picker.view('preset' in status ? status.preset : ''),
        ['p',
            ['label', { for: 'patricia-key' }, 'Key (0–255) '],
            ['input', { type: 'text', id: 'patricia-key', name: 'key', value: key, size: '6' }],
            ' ',
            ['button', { type: 'button', name: 'insert' }, 'Insert'],
            ' ',
            ['button', { type: 'button', name: 'remove' }, 'Remove'],
        ],
        ...(error === null ? [] : [/** @type {const} */ (['p', `Error: ${error}`])]),
        ['p', 'preset' in status ? status.hint : lastLine(status.last)(versions)],
        ...drawing(versions),
    ],
}
