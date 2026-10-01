/**
 * A persistent B-tree before and after a step: type keys, see what the last
 * one changed — and everything it did not.
 *
 * **Nothing here changes in place**, so inserting a key builds a new tree and
 * leaves the old one as it was. That would be expensive if the new tree were
 * a copy, and it is not: only the path from the root to the change is built
 * again, and every other subtree is the same object in both versions.
 *
 * **Each version is a graph of its own, and a node's colour says which
 * versions hold it**: `new` is only in the version after the last step,
 * `replaced` only in the one before, and `shared` in both — a plain node in
 * one drawing is the very object the other drawing shows plain too. The line
 * under the drawings counts each. Drawing both versions under one root would
 * show a shared subtree as one node with an edge from each, but tangles the
 * two trees into a graph neither of them is; two drawings keep each tree's
 * shape readable and leave the sharing to the colours.
 *
 * **A reader changes the tree one key at a time**: type a key, press
 * **Insert** or **Remove**, and the tree that was drawn under *After* moves
 * to *Before*. A key that is not an integer is refused by name, and the
 * trees stay as they were.
 *
 * **It needs no operations.** Inserting, removing and walking are pure, so
 * `update` declares `never`.
 *
 * @module
 *
 * @import { TNode, Tree } from './types/types.ts'
 * @import { _State, _Versions } from './types.ts'
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Shape } from '../../website/demo/graph/types.ts'
 */

import { set } from './set/module.f.mjs'
import { remove } from './remove/module.f.mjs'
import { cmp } from '../number/module.f.mjs'
import { graphOf, graphSvg } from '../../website/demo/graph/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'

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
        last: `${op} ${key}`,
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
 * How the walk reads one tree, given both versions to tell a node's kind
 * from. A node is drawn as one row per element, in the element's own order:
 * a subtree row is an edge to it (`Left`, `Middle`, `Right`), and a key row
 * holds the key (`Value`, or `Value0` and `Value1`). It has no title: the
 * number of rows already says which of the four kinds it is. Only a whole version can be empty, so
 * the `empty` inline is drawn as the graph's one node.
 *
 * @type {(v: _Versions) => (value: Tree<number> | number) => Shape<Tree<number> | number>}
 */
const shapeOf = ({ before, after }) => {
    const old = nodesOf(before)
    const current = nodesOf(after)
    /** @type {(node: TNode<number>) => string} */
    const kindOf = node => !old.includes(node) ? 'new' : current.includes(node) ? 'shared' : 'replaced'
    return value => {
        if (value === null) { return { inline: 'empty' } }
        if (typeof value === 'number') { return { inline: String(value) } }
        const kind = kindOf(value)
        switch (value.length) {
            case 1: { return { kind, label: '', children: [['Value', value[0]]] } }
            case 2: {
                const [v0, v1] = value
                return { kind, label: '', children: [['Value0', v0], ['Value1', v1]] }
            }
            case 3: {
                const [l, v, r] = value
                return { kind, label: '', children: [['Left', l], ['Value', v], ['Right', r]] }
            }
            case 5: {
                const [l, v0, m, v1, r] = value
                return { kind, label: '', children: [['Left', l], ['Value0', v0], ['Middle', m], ['Value1', v1], ['Right', r]] }
            }
        }
    }
}

/** @type {Tree<number>} */
const empty = null

/** @type {(tree: Tree<number>, key: number) => Tree<number>} */
const insertInto = (tree, key) => insert(key)(tree)

/** The tree holding 1 to 6, one insert away from the opening state. */
const six = [1, 2, 3, 4, 5, 6].reduce(insertInto, empty)

/**
 * The page opens on a step already taken — 7 inserted into the tree of 1 to
 * 6 — so there is something to compare before the first press, and the field
 * holds 8, the next key to try.
 *
 * @type {Demo<_State, DemoEvent>}
 */
export const demo = {
    init: { key: '8', versions: { before: six, after: insert(7)(six) }, last: 'insert 7', error: null },
    update: state => event => pureOk(
        event.kind === 'input' && event.name === 'key' ? { ...state, key: event.value }
        : event.kind === 'click' && (event.name === 'insert' || event.name === 'remove') ? _press(event.name)(state)
        : state),
    view: ({ key, versions, last, error }) => {
        const { built, shared, replaced } = _census(versions)
        const draw = graphOf(shapeOf(versions))
        return ['div',
            ['p',
                'Every step builds a new tree and leaves the old one as it was, ',
                'but only the path from the root to the change is built again: ',
                'everything else is shared by both versions. Try 8 and then 9, ',
                'which splits a leaf; 10 to 15, which grow the tree a level; or ',
                'removing 7, which merges two leaves.',
            ],
            ['p',
                ['label', { for: 'btree-key' }, 'Key '],
                ['input', { type: 'text', id: 'btree-key', name: 'key', value: key, size: '6' }],
                ' ',
                ['button', { type: 'button', name: 'insert' }, 'Insert'],
                ' ',
                ['button', { type: 'button', name: 'remove' }, 'Remove'],
            ],
            ...(error === null ? [] : [/** @type {const} */ (['p', `Error: ${error}`])]),
            ['h3', 'Before'],
            graphSvg(draw(versions.before)),
            ['h3', 'After'],
            graphSvg(draw(versions.after)),
            ['p', `Last step, ${last}: ${built} new (green), ${shared} shared with the version before, ${replaced} replaced (red).`],
        ]
    },
}
