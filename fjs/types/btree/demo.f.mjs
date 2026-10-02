/**
 * A persistent B-tree before and after a step: type keys, see what the last
 * one changed — and everything it did not.
 *
 * **Nothing here changes in place**, so inserting a key builds a new tree and
 * leaves the old one as it was. That would be expensive if the new tree were
 * a copy, and it is not: only the path from the root to the change is built
 * again, and every other subtree is the same object in both versions.
 *
 * **Both versions are one graph.** A subtree both versions hold is drawn
 * once, reached from both roots: the sharing is the drawing itself. The
 * leaves all sit in the last column, and each column reads in key order — see {@link _graphOf}. The
 * two roots sit on different ranks when a step grows or shrinks the tree,
 * which is the shape of what happened.
 *
 * **A node's colour says which versions hold it**: `new` is only in the
 * version after the last step, `replaced` only in the one before, and
 * `shared` in both, and a replaced node is drawn faded: it is only what the
 * tree was. The line above the drawing counts each.
 *
 * **A reader changes the tree one key at a time**: type a key, press
 * **Insert** or **Remove**, and the tree that was the new version is now
 * the old one. A key that is not an integer is refused by name, and the
 * trees stay as they were.
 *
 * **A preset loads a tree and a key, and takes no step.** Each makes one
 * tree both versions, puts a key in the field and a hint naming the button
 * to press, so the reader makes the change and sees it happen; picking one
 * again is how to start over. After the first press the drop-down says
 * `Custom`.
 *
 * **It needs no operations.** Inserting, removing and walking are pure, so
 * `update` declares `never`.
 *
 * @module
 *
 * @import { TNode, Tree } from './types/types.ts'
 * @import { _State, _Versions } from './types.ts'
 * @import { Examples } from '../../website/demo/examples/types.ts'
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Graph } from '../../website/demo/graph/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 */

import { set } from './set/module.f.mjs'
import { remove } from './remove/module.f.mjs'
import { cmp } from '../number/module.f.mjs'
import { graphSvg } from '../../website/demo/graph/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { examplePicker, name as exampleName } from '../../website/demo/examples/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.mjs'

/**
 * `text` as a key, or `null` if it is none. A key is a safe integer spelled
 * the way `String` spells it, so `07`, `1e3` and `NaN` are refused: `NaN` has
 * no order for the tree to keep, and the other two would be drawn under a
 * spelling the reader did not type.
 *
 * @type {(text: string) => number | null}
 */
const keyOf = text => {
    const key = Number(text)
    return Number.isSafeInteger(key) && String(key) === text ? key : null
}

/** @type {(key: number) => (tree: Tree<number>) => Tree<number>} */
const insert = key => set(cmp(key))(() => key)

/**
 * `state` after pressing `op`'s button: the tree it showed after its last
 * step is the one before this step, or, if the field holds no key, the same
 * trees and a reason.
 *
 * @type {(op: 'insert' | 'remove') => (state: _State) => _State}
 */
export const _press = op => state => {
    const key = keyOf(state.key.trim())
    if (key === null) { return { ...state, error: `"${state.key}" is not a key: type an integer.` } }
    const { after } = state.versions
    return {
        key: state.key,
        versions: { before: after, after: (op === 'insert' ? insert(key) : remove(cmp(key)))(after) },
        status: { last: `${op} ${key}` },
        error: null,
    }
}

/** @type {(node: TNode<number>) => readonly TNode<number>[]} */
const childrenOf = node => node.length === 3 ? [node[0], node[2]]
    : node.length === 5 ? [node[0], node[2], node[4]]
    : []

/**
 * Every node of `tree`, each once: a B-tree is a tree, so no node is reached
 * twice inside one version.
 *
 * @type {(tree: Tree<number>) => readonly TNode<number>[]}
 */
const nodesOf = tree => tree === null ? [] : [tree, ...childrenOf(tree).flatMap(nodesOf)]

/**
 * How many nodes the last step built, how many it reused, and how many it
 * left behind in the version before it.
 *
 * @type {(v: _Versions) => { readonly built: number, readonly shared: number, readonly replaced: number }}
 */
export const _census = ({ before, after }) => {
    const old = nodesOf(before)
    const current = nodesOf(after)
    const built = current.filter(node => !old.includes(node)).length
    return {
        built,
        shared: current.length - built,
        replaced: old.filter(node => !current.includes(node)).length,
    }
}

/**
 * A node's rows, in its elements' own order: a subtree is an edge to it
 * (`Left`, `Middle`, `Right`), and a key is the key alone. A node has no
 * names for its keys: the number of rows already says which of the four
 * kinds it is.
 *
 * @type {(node: TNode<number>) => readonly (readonly [label: string, value: TNode<number> | number])[]}
 */
const rowsOf = node => {
    switch (node.length) {
        case 1: { return [['', node[0]]] }
        case 2: {
            const [v0, v1] = node
            return [['', v0], ['', v1]]
        }
        case 3: {
            const [l, v, r] = node
            return [['Left', l], ['', v], ['Right', r]]
        }
        case 5: {
            const [l, v0, m, v1, r] = node
            return [['Left', l], ['', v0], ['Middle', m], ['', v1], ['Right', r]]
        }
    }
}

/** @type {(node: TNode<number>) => number} */
const average = node => {
    const keys = rowsOf(node).flatMap(([, v]) => typeof v === 'number' ? [v] : [])
    return keys.reduce((a, b) => a + b, 0) / keys.length
}

/**
 * How far `node` is above the leaves. Every leaf of a B-tree is as deep as
 * every other, so the leftmost path is as long as any.
 *
 * @type {(node: TNode<number>) => number}
 */
const heightOf = node => node.length === 1 || node.length === 2 ? 0 : 1 + heightOf(node[0])

/** @type {(kind: string) => number} */
const kindOrder = kind => kind === 'replaced' ? 0 : kind === 'shared' ? 1 : 2

/**
 * Both versions as one graph, built here rather than walked by `graphOf`,
 * because three things about it are the B-tree's, not any value's:
 *
 * - **No root above the two, and no titles.** An arrow from nowhere
 *   points at each version's root — faded for the old one, solid for the
 *   new. A root both versions share has only the solid arrow: the step
 *   changed nothing, which the line above the drawing already says.
 * - **Leaves line up.** A node's rank is how far it is above the leaves,
 *   counted down from the taller root, so every leaf sits in the last
 *   column and the two roots sit where their heights put them.
 * - **A column reads in key order.** The graph draws a column in id order,
 *   and ids follow each node's average key, a replaced node before the one
 *   that took its place.
 *
 * A node drawn once is still reached from both versions where they share
 * it. Edges leaving a replaced node are marked `replaced`, like the node.
 *
 * @type {(v: _Versions) => Graph}
 */
export const _graphOf = ({ before, after }) => {
    const old = nodesOf(before)
    const current = nodesOf(after)
    /** @type {(node: TNode<number>) => string} */
    const kindOf = node => !old.includes(node) ? 'new' : current.includes(node) ? 'shared' : 'replaced'
    const sorted = [...current, ...old.filter(node => !current.includes(node))]
        .toSorted((a, b) => average(a) - average(b) || kindOrder(kindOf(a)) - kindOrder(kindOf(b)))
    const top = [before, after].reduce((m, tree) => tree === null ? m : Math.max(m, heightOf(tree)), 0)
    return {
        nodes: sorted.map((node, id) => ({ id, kind: kindOf(node), label: '', rank: top - heightOf(node) })),
        entries: [
            ...(before === null || before === after ? [] : [{ to: sorted.indexOf(before), kind: 'replaced' }]),
            ...(after === null ? [] : [{ to: sorted.indexOf(after) }]),
        ],
        edges: sorted.flatMap((node, id) => rowsOf(node).map(([label, value]) => typeof value === 'number'
            ? { from: id, to: { inline: String(value) }, label }
            : { from: id, to: sorted.indexOf(value), label, kind: kindOf(node) === 'replaced' ? 'replaced' : undefined })),
    }
}

/**
 * The drawing, and a line for each version that is the empty tree, which
 * has no node to draw.
 *
 * @type {(v: _Versions) => readonly Element[]}
 */
const drawing = versions => [
    ...(versions.before === null && versions.after === null ? [] : [graphSvg(_graphOf(versions))]),
    ...(versions.before === null ? [/** @type {const} */ (['p', 'Before is the empty tree.'])] : []),
    ...(versions.after === null ? [/** @type {const} */ (['p', 'After is the empty tree.'])] : []),
]

/** @type {Tree<number>} */
const empty = null

/** @type {(tree: Tree<number>, key: number) => Tree<number>} */
const insertInto = (tree, key) => insert(key)(tree)

/**
 * 10, 20, … up to `n` tens: keys with room between them, so a reader can
 * insert one anywhere.
 *
 * @type {(n: number) => readonly number[]}
 */
const tensUpTo = n => Array.from({ length: n }, (_, i) => (i + 1) * 10)

/**
 * The presets the drop-down offers: a name, the keys whose inserts build the
 * starting tree, the key put in the field, and the hint naming the button
 * to press and what it will show.
 *
 * @type {readonly (readonly [name: string, keys: readonly number[], key: number, hint: string])[]}
 */
export const presets = [
    ['Insert into a leaf', tensUpTo(7), 80, 'Press Insert to add 80: only the path to the leaf 70 is built again, and the rest is shared.'],
    ['Empty tree', [], 10, 'Press Insert to add 10, then keep inserting 20, 30, … to watch the tree grow from a single leaf.'],
    ['Split a leaf', tensUpTo(8), 90, 'Press Insert to add 90: the leaf 70 80 is full, so it splits and 80 moves up into its parent.'],
    ['Grow a level', tensUpTo(14), 150, 'Press Insert to add 150: the split runs all the way up to the root, and the tree grows a level.'],
    ['Remove and merge', tensUpTo(7), 70, 'Press Remove to take out 70: its leaf empties and merges with its sibling, and the tree shrinks a level.'],
    ['Remove a missing key', tensUpTo(7), 90, 'Press Remove to take out 90: it is not in the tree, so nothing changes and every node is shared.'],
    ['Big tree', tensUpTo(31), 320, 'Press Insert to add 320: only the five nodes on its path are built again, and the other 26 are shared.'],
]

/**
 * Each preset by its name, which is also its source: the selection is read
 * off the status, and a loaded preset's status names it.
 *
 * @type {Examples}
 */
const examples = presets.map(([n]) => [n, n])

const picker = examplePicker(examples)

/**
 * The state a preset loads: its tree as both versions, so every node is
 * shared until the first press.
 *
 * @type {(name: string) => _State}
 */
export const _load = name => {
    // `pick` refuses a name no preset has, which only a bug can send.
    const source = picker.pick(name)
    const [, keys, key, hint] = assertNotNullish(presets.find(([n]) => n === source))
    const tree = keys.reduce(insertInto, empty)
    return { key: String(key), versions: { before: tree, after: tree }, status: { preset: name, hint }, error: null }
}

/**
 * What the last step did. A step that left the tree as it was — removing a
 * key the tree does not have — says so, rather than a count of nothing.
 *
 * @type {(last: string) => (versions: _Versions) => string}
 */
const lastLine = last => versions => {
    if (versions.before === versions.after) { return `Last step, ${last}: the key is not in the tree, so nothing changed.` }
    const { built, shared, replaced } = _census(versions)
    return `Last step, ${last}: ${built} new (blue), ${shared} shared with the version before, ${replaced} replaced (amber).`
}

/**
 * The page opens on the first preset, loaded.
 *
 * @type {Demo<_State, DemoEvent>}
 */
export const demo = {
    init: _load(presets[0][0]),
    update: state => event => pureOk(
        event.kind === 'input' && event.name === 'key' ? { ...state, key: event.value }
        : event.kind === 'input' && event.name === exampleName ? _load(event.value)
        : event.kind === 'click' && (event.name === 'insert' || event.name === 'remove') ? _press(event.name)(state)
        : state),
    view: ({ key, versions, status, error }) => {
        return ['div',
            ['p',
                'Every step builds a new tree and leaves the old one as it was, ',
                'but only the path from the root to the change is built again: ',
                'everything else is shared by both versions.',
            ],
            picker.view('preset' in status ? status.preset : ''),
            ['p',
                ['label', { for: 'btree-key' }, 'Key '],
                ['input', { type: 'text', id: 'btree-key', name: 'key', value: key, size: '6' }],
                ' ',
                ['button', { type: 'button', name: 'insert' }, 'Insert'],
                ' ',
                ['button', { type: 'button', name: 'remove' }, 'Remove'],
            ],
            ...(error === null ? [] : [/** @type {const} */ (['p', `Error: ${error}`])]),
            ['p', 'preset' in status ? status.hint : lastLine(status.last)(versions)],
            ...drawing(versions),
        ]
    },
}
