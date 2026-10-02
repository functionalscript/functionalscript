/**
 * @import { State, _DemoTrie } from './types.ts'
 * @import { State as DemoState } from '../../website/demo/versions/types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { emptyState, patriciaTrie } from './module.f.mjs'
import { _census, _graphOf, _load, _press, demo, presets } from './demo.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'

/** @type {(a: bigint, b: bigint) => bigint} */
const combine = (a, b) => a * 1_000n + b

/** @type {(a: bigint, b: bigint, s: readonly [bigint, bigint, bigint][]) => readonly [bigint, readonly [bigint, bigint, bigint][]]} */
const create = (a, b, s) => {
    const h = combine(a, b)
    return [h, [...s, [a, b, h]]]
}

const { push, end } = patriciaTrie(create)

/** @type {(state: State<readonly [bigint, bigint, bigint][], bigint>) => readonly bigint[]} */
const leaves = ([, candidates]) => candidates.map(([leaf]) => leaf)

/** @type {(inputs: readonly bigint[], expectedLeaves: readonly (readonly bigint[])[], expectedNodeCounts: readonly number[]) => void} */
const runExample = (inputs, expectedLeaves, expectedNodeCounts) => {
    /** @type {State<readonly [bigint, bigint, bigint][], bigint>} */
    let state = emptyState([])
    for (let i = 0; i < inputs.length; i++) {
        const x = inputs[i]
        const prevCount = state[0].length
        state = push([x, x], state)

        const actual = leaves(state)
        assertEq(actual.length, expectedLeaves[i].length)
        for (let j = 0; j < actual.length; j++) {
            assertEq(actual[j], expectedLeaves[i][j])
        }

        const newNodes = state[0].slice(prevCount)
        assertEq(newNodes.length, expectedNodeCounts[i])
        for (const [l, r, h] of newNodes) { assertEq(h, combine(l, r)) }
    }
    const prevCount = state[0].length
    const [root, finalStorage] = end(state)
    const finalNodes = finalStorage.slice(prevCount)
    assertEq(finalNodes.length, expectedLeaves[expectedLeaves.length - 1].length - 1)
    assert(root !== undefined)
    for (const [l, r, h] of finalNodes) { assertEq(h, combine(l, r)) }
}

const empty = () => {
    const [root, storage] = end(emptyState([]))
    assertEq(storage.length, 0)
    assertEq(root, undefined)
}

const singleLeaf = () => {
    const state = push([42n, 42n], emptyState([]))
    assertEq(state[0].length, 0)
    assertEq(leaves(state).length, 1)
    assertEq(leaves(state)[0], 42n)

    const [root, finalStorage] = end(state)
    assertEq(finalStorage.length, 0)
    assertEq(root, 42n)
}

const twoLeaves = () => {
    const s1 = push([7n, 7n], emptyState([]))
    const prevCount = s1[0].length
    const s2 = push([3n, 3n], s1)
    assertEq(s2[0].slice(prevCount).length, 0)
    assertEq(leaves(s2).length, 2)

    const prevCount2 = s2[0].length
    const [root, finalStorage] = end(s2)
    const finalNodes = finalStorage.slice(prevCount2)
    assertEq(finalNodes.length, 1)
    assertEq(finalNodes[0][0], 7n)
    assertEq(finalNodes[0][1], 3n)
    assertEq(finalNodes[0][2], combine(7n, 3n))
    assertEq(root, combine(7n, 3n))
}

// example.md — descending
// merges happen at: step 2 (1), 3 (1), 4 (1), 7 (2), 8 (2), A (1), C (2), F (1)
const descending = () => runExample(
    [
        0b11111001n, 0b11110010n, 0b11100011n, 0b11001000n,
        0b10110011n, 0b10100110n, 0b10100011n, 0b10011111n,
        0b01110111n, 0b01101110n, 0b01011001n, 0b01001001n,
        0b00100111n, 0b00010111n, 0b00010000n, 0b00001110n,
    ],
    [
        [0b11111001n],
        [0b11111001n, 0b11110010n],
        [0b11110010n, 0b11100011n],
        [0b11100011n, 0b11001000n],
        [0b11001000n, 0b10110011n],
        [0b11001000n, 0b10110011n, 0b10100110n],
        [0b11001000n, 0b10110011n, 0b10100110n, 0b10100011n],
        [0b11001000n, 0b10100011n, 0b10011111n],
        [0b10011111n, 0b01110111n],
        [0b10011111n, 0b01110111n, 0b01101110n],
        [0b10011111n, 0b01101110n, 0b01011001n],
        [0b10011111n, 0b01101110n, 0b01011001n, 0b01001001n],
        [0b10011111n, 0b01001001n, 0b00100111n],
        [0b10011111n, 0b01001001n, 0b00100111n, 0b00010111n],
        [0b10011111n, 0b01001001n, 0b00100111n, 0b00010111n, 0b00010000n],
        [0b10011111n, 0b01001001n, 0b00100111n, 0b00010000n, 0b00001110n],
    ],
    [0, 0, 1, 1, 1, 0, 0, 2, 2, 0, 1, 0, 2, 0, 0, 1],
)

// example.md — ascending (same values, reversed)
// merges happen at: step 3 (2), 4 (1), 6 (1), 8 (3), B (1), C (2)
const ascending = () => runExample(
    [
        0b00001110n, 0b00010000n, 0b00010111n, 0b00100111n,
        0b01001001n, 0b01011001n, 0b01101110n, 0b01110111n,
        0b10011111n, 0b10100011n, 0b10100110n, 0b10110011n,
        0b11001000n, 0b11100011n, 0b11110010n, 0b11111001n,
    ],
    [
        [0b00001110n],
        [0b00001110n, 0b00010000n],
        [0b00001110n, 0b00010000n, 0b00010111n],
        [0b00010111n, 0b00100111n],
        [0b00100111n, 0b01001001n],
        [0b00100111n, 0b01001001n, 0b01011001n],
        [0b00100111n, 0b01011001n, 0b01101110n],
        [0b00100111n, 0b01011001n, 0b01101110n, 0b01110111n],
        [0b01110111n, 0b10011111n],
        [0b01110111n, 0b10011111n, 0b10100011n],
        [0b01110111n, 0b10011111n, 0b10100011n, 0b10100110n],
        [0b01110111n, 0b10011111n, 0b10100110n, 0b10110011n],
        [0b01110111n, 0b10110011n, 0b11001000n],
        [0b01110111n, 0b10110011n, 0b11001000n, 0b11100011n],
        [0b01110111n, 0b10110011n, 0b11001000n, 0b11100011n, 0b11110010n],
        [0b01110111n, 0b10110011n, 0b11001000n, 0b11100011n, 0b11110010n, 0b11111001n],
    ],
    [0, 0, 0, 2, 1, 0, 1, 0, 3, 0, 0, 1, 2, 0, 0, 0],
)

/** @type {(state: DemoState<_DemoTrie>) => string} */
const html = state => htmlToString(demo.view(state))

/**
 * A preset loaded and its hint followed: the button the hint names, pressed
 * with the key the preset put in the field.
 *
 * @type {(name: string) => DemoState<_DemoTrie>}
 */
const follow = name => {
    const loaded = _load(name)
    const { status } = loaded
    assert('preset' in status, '')
    return _press(status.hint.startsWith('Press Remove') ? 'remove' : 'insert')(loaded)
}

/** @type {(name: string) => string} */
const censusAfter = name => JSON.stringify(_census(follow(name).versions))

const demoProof = {
    // Each preset's hint is what its press does: a handful of branches
    // built again, every other node shared — though the trie after the step
    // was built from scratch.
    presets: () => {
        assertEq(presets.length, 5)
        assertEq(censusAfter('Insert a key'), '{"built":5,"shared":12,"replaced":3}')
        assertEq(censusAfter('Remove a key'), '{"built":2,"shared":11,"replaced":4}')
        assertEq(censusAfter('Insert at the edge'), '{"built":4,"shared":13,"replaced":2}')
        assertEq(censusAfter('Worked example'), '{"built":5,"shared":28,"replaced":3}')
        assertEq(censusAfter('Empty trie'), '{"built":1,"shared":0,"replaced":0}')
    },
    // A trie built twice from the same keys is the same trie, node for
    // node: sharing by content needs no object to be reused.
    contentAddressed: () => {
        const { versions } = _load('Insert a key')
        const again = _press('remove')({ ..._press('insert')({ ..._load('Insert a key'), key: '5' }), key: '5' })
        assertEq(again.versions.after.root, versions.after.root)
        assert(again.versions.after !== versions.after, '')
    },
    // A branch is titled with the start of its hash; a leaf is its key in
    // binary, beside the key in decimal.
    drawing: () => {
        const h = html(_load('Insert a key'))
        const { root } = _load('Insert a key').versions.after
        assert(root !== null, '')
        assert(h.includes(`data-graph-label="">${root.slice(0, 4)}<`), h)
        assert(h.includes('data-graph-edge-label="">01100011<'), h)
        assert(h.includes('data-graph-value-label="">99<'), h)
        assert(h.includes('<label for="patricia-key">Key (0–255) </label>'), h)
    },
    // A node is one column right of its deepest parent: the root at 0, and
    // a leaf where its parent puts it, not in one last column.
    layout: () => {
        const { nodes, edges } = _graphOf(_load('Insert a key').versions)
        const roots = nodes.filter(n => edges.every(e => e.to !== n.id))
        assertEq(JSON.stringify(roots.map(n => n.rank)), '[0]')
        assert(edges.every(e => typeof e.to !== 'number' || nodes[e.to].rank === nodes[e.from].rank + 1), '')
        const leafRanks = new Set(nodes.filter(n => n.label === '').map(n => n.rank))
        assert(leafRanks.size > 1, '')
    },
    // A step that leaves the keys as they were says why.
    unchanged: () => {
        const loaded = _load('Insert a key')
        assert(html(_press('insert')({ ...loaded, key: '3' })).includes('Last step, insert 3: nothing changed, the key is already in the trie.'), '')
        assert(html(_press('remove')({ ...loaded, key: '5' })).includes('Last step, remove 5: nothing changed, the key is not in the trie.'), '')
    },
    // A key the trie's eight bits cannot hold is refused.
    refused: () => {
        const s = _press('insert')({ ...demo.init, key: '256' })
        assertEq(s.versions, demo.init.versions)
        assert(html(s).includes('type an integer from 0 to 255.'), '')
    },
}

export const proof = {
    empty,
    singleLeaf,
    twoLeaves,
    descending,
    ascending,
    demo: demoProof,
}
