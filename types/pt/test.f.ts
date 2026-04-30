import { stat } from 'node:fs'
import { assert } from '../../dev/module.f.ts'
import { pt, type State } from './module.f.ts'

const compress = (a: bigint, b: bigint): bigint => a * 1_000n + b

const { push, end } = pt(compress)

const leaves = (state: State<bigint>): readonly bigint[] => state.map(([leaf]) => leaf)

const push1 = (state: State<bigint>) => (u: bigint) => push(state)([u, u])

const runExample = (inputs: readonly bigint[], expectedLeaves: readonly (readonly bigint[])[], expectedNodeCounts: readonly number[]) => {
    let state: State<bigint> = []
    for (let i = 0; i < inputs.length; i++) {
        const x = inputs[i]
        const [nodes, newState] = push1(state)(x)
        state = newState

        const actual = leaves(state)
        assert(actual.length === expectedLeaves[i].length)
        for (let j = 0; j < actual.length; j++) {
            assert(actual[j] === expectedLeaves[i][j])
        }

        assert(nodes.length === expectedNodeCounts[i])
        for (const [l, r, h] of nodes) {
            assert(h === compress(l, r))
        }
    }
    return state
}

const empty = () => {
    const [nodes, root] = end([])
    assert(nodes.length === 0)
    assert(root === undefined)
}

const singleLeaf = () => {
    const [nodes, s] = push1([])(42n)
    assert(nodes.length === 0)
    assert(leaves(s).length === 1)
    assert(leaves(s)[0] === 42n)

    const [endNodes, root] = end(s)
    assert(endNodes.length === 0)
    assert(root === 42n)
}

// Second push emits no node; end emits one.
const twoLeaves = () => {
    const [, s1] = push1([])(7n)
    const [nodes, s2] = push1(s1)(3n)
    assert(nodes.length === 0)
    assert(leaves(s2).length === 2)

    const [endNodes, root] = end(s2)
    assert(endNodes.length === 1)
    assert(endNodes[0][0] === 7n)
    assert(endNodes[0][1] === 3n)
    assert(endNodes[0][2] === compress(7n, 3n))
    assert(root === compress(7n, 3n))
}

// example.md — descending
// merges happen at: step 2 (1), 3 (1), 4 (1), 7 (2), 8 (2), A (1), C (2), F (1)
const descending = () => {
    const state = runExample(
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
    // 5 remaining candidates collapse into 4 nodes
    const [finalNodes, root] = end(state)
    assert(finalNodes.length === 4)
    assert(root !== undefined)
    for (const [l, r, h] of finalNodes) { assert(h === compress(l, r)) }
}

// example.md — ascending (same values, reversed)
// merges happen at: step 3 (2), 4 (1), 6 (1), 8 (3), B (1), C (2)
const ascending = () => {
    const state = runExample(
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
    // 6 remaining candidates collapse into 5 nodes
    const [finalNodes, root] = end(state)
    assert(finalNodes.length === 5)
    assert(root !== undefined)
    for (const [l, r, h] of finalNodes) { assert(h === compress(l, r)) }
}

export default { empty, singleLeaf, twoLeaves, descending, ascending }
