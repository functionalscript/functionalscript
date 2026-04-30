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

    // README example (descending 8-bit values)
    //
    // Input:  F9 F2 E3 C8  B3 A6 A3 9F  77 6E 59 49  27 17 10 0E
    //
    // Expected rightmost leaves after each push (from README state column):
    const expectedLeaves: readonly (readonly bigint[])[] = [
        [0xF9n],
        [0xF9n, 0xF2n],
        [0xF2n, 0xE3n],
        [0xE3n, 0xC8n],
        [0xC8n, 0xB3n],
        [0xC8n, 0xB3n, 0xA6n],
        [0xC8n, 0xB3n, 0xA6n, 0xA3n],
        [0xC8n, 0xA3n, 0x9Fn],
        [0x9Fn, 0x77n],
        [0x9Fn, 0x77n, 0x6En],
        [0x9Fn, 0x6En, 0x59n],
        [0x9Fn, 0x6En, 0x59n, 0x49n],
        [0x9Fn, 0x49n, 0x27n],
        [0x9Fn, 0x49n, 0x27n, 0x17n],
        [0x9Fn, 0x49n, 0x27n, 0x17n, 0x10n],
        [0x9Fn, 0x49n, 0x27n, 0x10n, 0x0En],
    ]

    // Number of nodes completed at each push step:
    // merges happen when: step 2 (1), 3 (1), 4 (1), 7 (2), 8 (2), A (1), C (2), F (1)
    const expectedNodeCounts: readonly number[] = [0, 0, 1, 1, 1, 0, 0, 2, 2, 0, 1, 0, 2, 0, 0, 1]

    const inputs: readonly bigint[] = [
        0xF9n, 0xF2n, 0xE3n, 0xC8n,
        0xB3n, 0xA6n, 0xA3n, 0x9Fn,
        0x77n, 0x6En, 0x59n, 0x49n,
        0x27n, 0x17n, 0x10n, 0x0En,
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
