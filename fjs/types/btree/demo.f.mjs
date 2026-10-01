/**
 * A persistent B-tree as the graph two of its versions make together: type
 * keys, see what the last one changed — and everything it did not.
 *
 * **Nothing here changes in place**, so inserting a key builds a new tree and
 * leaves the old one as it was. That would be expensive if the new tree were
 * a copy, and it is not: only the path from the root to the change is built
 * again, and every other subtree is the same object in both versions. This
 * demo draws both versions under one root, `versions`, so a subtree they
 * share is one node with an edge from each — the [graph
 * module](../../website/demo/graph/module.f.mjs) draws one node per distinct
 * reference, which is exactly the property on show.
 *
 * **A node's colour says which version holds it**: `new` is only in the
 * version after the last step, `replaced` only in the one before, and
 * `shared` in both. The line under the drawing counts each.
 *
 * **The input is the steps, not a tree.** Each word is a step: an integer is
 * an insert, and one after `-` is a removal. The tree is a fold over the
 * steps from the empty tree, so the same text always draws the same graph,
 * and the drawing is of the last step only — the one before it is what the
 * `before` edge reaches. A word that is not a key is refused by name rather
 * than skipped, which would draw a tree the text does not describe.
 *
 * **It needs no operations.** Folding and walking are pure functions of the
 * text, so `update` declares `never`.
 *
 * @module
 *
 * @import { TNode, Tree } from './types/types.ts'
 * @import { _Value, _Versions } from './private.ts'
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Shape } from '../../website/demo/graph/types.ts'
 * @import { Examples } from '../../website/demo/examples/types.ts'
 * @import { Element } from '../../media/html/types.ts'
 */

import { set } from './set/module.f.mjs'
import { remove } from './remove/module.f.mjs'
import { cmp } from '../number/module.f.mjs'
import { graphOf, graphSvg } from '../../website/demo/graph/module.f.mjs'
import { textDemo } from '../../website/demo/module.f.mjs'

/**
 * `word` as the step it names, or `null` if it names none. A key is a safe
 * integer spelled the way `String` spells it, so `07`, `1e3` and `NaN` are
 * refused: `NaN` has no order for the tree to keep, and the other two would
 * be drawn under a spelling the reader did not type.
 *
 * @type {(word: string) => ((tree: Tree<number>) => Tree<number>) | null}
 */
const stepOf = word => {
    const isRemove = word.startsWith('-')
    const digits = isRemove ? word.slice(1) : word
    const key = Number(digits)
    return !Number.isSafeInteger(key) || String(key) !== digits ? null
        : isRemove ? remove(cmp(key))
        : set(cmp(key))(() => key)
}

/** @type {(text: string) => readonly string[]} */
const wordsOf = text => text.split('\n').flatMap(line => line.split(' ')).filter(word => word !== '')

/** @type {_Versions} */
const empty = { before: null, after: null, last: null }

/**
 * The last two versions `text`'s steps build, starting from the empty tree,
 * or the first word that is not a step.
 *
 * @type {(text: string) => _Versions | string}
 */
export const _versions = text => wordsOf(text).reduce(
    /** @type {(v: _Versions | string, word: string) => _Versions | string} */
    (v, word) => {
        if (typeof v === 'string') { return v }
        const step = stepOf(word)
        return step === null
            ? `"${word}" is not a step: write an integer to insert it, or "-" and an integer to remove it.`
            : { before: v.after, after: step(v.after), last: word }
    },
    empty)

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
 * How the walk reads one value, given both versions to tell a node's kind
 * from. A node's label is its keys, and each of its ports says which keys
 * the subtree it leads to holds.
 *
 * @type {(v: _Versions) => (value: _Value) => Shape<_Value>}
 */
const shapeOf = ({ before, after }) => {
    const old = nodesOf(before)
    const current = nodesOf(after)
    /** @type {(node: TNode<number>) => string} */
    const kindOf = node => !old.includes(node) ? 'new' : current.includes(node) ? 'shared' : 'replaced'
    return value => {
        if (value === null) { return { inline: 'empty' } }
        if ('after' in value) {
            return { kind: 'versions', label: 'versions', children: [['before', value.before], ['after', value.after]] }
        }
        const kind = kindOf(value)
        switch (value.length) {
            case 1: { return { kind, label: String(value[0]), children: [] } }
            case 2: { return { kind, label: `${value[0]} ${value[1]}`, children: [] } }
            case 3: {
                const [l, k, r] = value
                return { kind, label: String(k), children: [[`< ${k}`, l], [`> ${k}`, r]] }
            }
            case 5: {
                const [l, a, m, b, r] = value
                return { kind, label: `${a} ${b}`, children: [[`< ${a}`, l], [`${a}…${b}`, m], [`> ${b}`, r]] }
            }
        }
    }
}

/** @type {(word: string) => string} */
const describe = word => word.startsWith('-') ? `remove ${word.slice(1)}` : `insert ${word}`

/** @type {(v: _Versions) => readonly Element[]} */
const render = v => {
    if (v.last === null) { return [['p', 'Type keys to insert, and see the tree they build.']] }
    const { built, shared, replaced } = _census(v)
    return [
        graphSvg(graphOf(shapeOf(v))(v)),
        ['p', `Last step, ${describe(v.last)}: ${built} new (green), ${shared} shared with the version before, ${replaced} replaced (red).`],
    ]
}

/**
 * The step lists the examples drop-down offers, each ending on the step it
 * is named for.
 *
 * - **Insert into a leaf** puts 8 beside 7: the root, its right child and
 *   one leaf are built again, and the whole left half is shared.
 * - **Split a leaf** inserts 9 into the leaf `7 8`, which has no room: it
 *   splits, and 8 moves up into its parent.
 * - **Grow a level** splits all the way to the root, so the tree gets one
 *   level taller — and still shares every leaf it did not touch.
 * - **Remove** takes 7 out of its leaf, which leaves the leaf empty: it
 *   merges with its sibling, and the tree gets one level shorter.
 * - **Remove a missing key** changes nothing, so both versions are one
 *   tree: every node is shared and none is new.
 * - **The first key** starts from the empty tree, which has no nodes to
 *   share.
 * - **Error** is a word that is not a step.
 *
 * @type {Examples}
 */
export const examples = [
    ['Insert into a leaf', '1 2 3 4 5 6 7 8'],
    ['Split a leaf', '1 2 3 4 5 6 7 8 9'],
    ['Grow a level', '1 2 3 4 5 6 7 8 9 10 11 12 13 14 15'],
    ['Remove', '1 2 3 4 5 6 7 -7'],
    ['Remove a missing key', '1 2 3 4 5 6 7 -9'],
    ['The first key', '1'],
    ['Error', '1 two'],
]

/**
 * The state is the text, not the trees: both versions are a function of it.
 *
 * @type {Demo<string, DemoEvent>}
 */
export const demo = textDemo({ name: 'btree', label: 'Steps', rows: 3, init: examples[0][1], examples })(text => {
    const v = _versions(text)
    return typeof v === 'string' ? [['p', `Error: ${v}`]] : render(v)
})
