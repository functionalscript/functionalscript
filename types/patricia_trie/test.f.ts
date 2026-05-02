import { assert } from '../../dev/module.f.ts'
import { patriciaTrie, type State } from './module.f.ts'

type NodeList = readonly [bigint, bigint, bigint][]

const combine = (a: bigint, b: bigint): bigint => a * 1_000n + b

const create = (a: bigint, b: bigint, s: NodeList): readonly[bigint, NodeList] => {
    const h = combine(a, b)
    return [h, [...s, [a, b, h]]]
}

const { push, end } = patriciaTrie(create)

const leaves = ([, candidates]: State<NodeList, bigint>): readonly bigint[] =>
    candidates.map(([leaf]) => leaf)

const runExample = (
    inputs: readonly bigint[],
    expectedLeaves: readonly (readonly bigint[])[],
    expectedNodeCounts: readonly number[]
) => {
    let state: State<NodeList, bigint> = [[], []]
    for (let i = 0; i < inputs.length; i++) {
        const x = inputs[i]
        const prevCount = state[0].length
        state = push([x, x], state)

        const actual = leaves(state)
        assert(actual.length === expectedLeaves[i].length)
        for (let j = 0; j < actual.length; j++) {
            assert(actual[j] === expectedLeaves[i][j])
        }

        const newNodes = state[0].slice(prevCount)
        assert(newNodes.length === expectedNodeCounts[i])
        for (const [l, r, h] of newNodes) { assert(h === combine(l, r)) }
    }
    const prevCount = state[0].length
    const [root, finalStorage] = end(state)
    const finalNodes = finalStorage.slice(prevCount)
    assert(finalNodes.length === expectedLeaves[expectedLeaves.length - 1].length - 1)
    assert(root !== undefined)
    for (const [l, r, h] of finalNodes) { assert(h === combine(l, r)) }
}

const empty = () => {
    const [root, storage] = end([[], []])
    assert(storage.length === 0)
    assert(root === undefined)
}

const singleLeaf = () => {
    const state = push([42n, 42n], [[], []])
    assert(state[0].length === 0)
    assert(leaves(state).length === 1)
    assert(leaves(state)[0] === 42n)

    const [root, finalStorage] = end(state)
    assert(finalStorage.length === 0)
    assert(root === 42n)
}

const twoLeaves = () => {
    const s1 = push([7n, 7n], [[], []])
    const prevCount = s1[0].length
    const s2 = push([3n, 3n], s1)
    assert(s2[0].slice(prevCount).length === 0)
    assert(leaves(s2).length === 2)

    const prevCount2 = s2[0].length
    const [root, finalStorage] = end(s2)
    const finalNodes = finalStorage.slice(prevCount2)
    assert(finalNodes.length === 1)
    assert(finalNodes[0][0] === 7n)
    assert(finalNodes[0][1] === 3n)
    assert(finalNodes[0][2] === combine(7n, 3n))
    assert(root === combine(7n, 3n))
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

export default {
    empty,
    singleLeaf,
    twoLeaves,
    descending,
    ascending
}
