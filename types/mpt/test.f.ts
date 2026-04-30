import { assert } from '../../dev/module.f.ts'
import { mpt, type State } from './module.f.ts'

const compress = (a: bigint, b: bigint): bigint => a * 1_000n + b

const { push, end } = mpt(compress)

const leaves = (state: State): readonly bigint[] => state.map(([leaf]) => leaf)

export default () => {
    // empty
    {
        const [nodes, root] = end([])
        assert(nodes.length === 0)
        assert(root === undefined)
    }

    // single leaf
    {
        const [nodes, s] = push([])(42n)
        assert(nodes.length === 0)
        assert(leaves(s).length === 1)
        assert(leaves(s)[0] === 42n)

        const [endNodes, root] = end(s)
        assert(endNodes.length === 0)
        assert(root === 42n)
    }

    // two leaves: second push emits no node; end emits one
    {
        const [, s1] = push([])(7n)
        const [nodes, s2] = push(s1)(3n)
        assert(nodes.length === 0)
        assert(leaves(s2).length === 2)

        const [endNodes, root] = end(s2)
        assert(endNodes.length === 1)
        assert(endNodes[0][0] === 7n)
        assert(endNodes[0][1] === 3n)
        assert(endNodes[0][2] === compress(7n, 3n))
        assert(root === compress(7n, 3n))
    }

    // example.md (descending 8-bit values)
    //
    // Expected rightmost leaves after each push (from example.md state column):
    const expectedLeaves: readonly (readonly bigint[])[] = [
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
    ]

    // Number of nodes completed at each push step:
    // merges happen at: step 2 (1), 3 (1), 4 (1), 7 (2), 8 (2), A (1), C (2), F (1)
    const expectedNodeCounts: readonly number[] = [0, 0, 1, 1, 1, 0, 0, 2, 2, 0, 1, 0, 2, 0, 0, 1]

    const inputs: readonly bigint[] = [
        0b11111001n, 0b11110010n, 0b11100011n, 0b11001000n,
        0b10110011n, 0b10100110n, 0b10100011n, 0b10011111n,
        0b01110111n, 0b01101110n, 0b01011001n, 0b01001001n,
        0b00100111n, 0b00010111n, 0b00010000n, 0b00001110n,
    ]

    let state: State = []
    for (let i = 0; i < inputs.length; i++) {
        const [nodes, newState] = push(state)(inputs[i])
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

    // end: 5 remaining candidates collapse into 4 nodes
    {
        const [finalNodes, root] = end(state)
        assert(finalNodes.length === 4)
        assert(root !== undefined)
        for (const [l, r, h] of finalNodes) {
            assert(h === compress(l, r))
        }
    }
}
