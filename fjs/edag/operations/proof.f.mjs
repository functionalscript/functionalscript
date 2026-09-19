/**
 * The operations run over values directly: an evaluator whose operands are
 * already values, `operand` the identity, so each operation's meaning is
 * pinned once here without a graph around it. The full semantics — chains,
 * short-circuits, frames, calls and what throws — are amnesia's proofs,
 * which run every operation through this table over EDAG nodes.
 *
 * @import { Evaluator } from './types.ts'
 */

import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { operation } from './module.f.mjs'

/**
 * Operands are values; a call of a `=>` runs the body, which is a value
 * too, through the same table so that `invoke` is exercised.
 *
 * @type {Evaluator<unknown>}
 */
const values = {
    frame: 'F',
    args: [10, 20],
    operand: v => v,
    invoke: (frame, args, body) => operation({ ...values, frame, args })(/**@type {any}*/(body)),
}

/** @type {(e: any) => unknown} */
const run = e => operation(values)(e)

/** @type {(e: any, expected: unknown) => void} */
const eq = (e, expected) => { assertEq(run(e), expected) }

export const proof = {
    operators: () => {
        eq(['!', 0], true)
        eq(['~', 0], -1)
        eq(['Number', '42'], 42)
        eq(['String', 42], '42')
        eq(['typeof', 1n], 'bigint')
        eq(['+', '5'], 5)
        eq(['-', 5], -5)
        eq(['+', 2, 3], 5)
        eq(['-', 2, 3], -1)
        eq(['*', 2, 3], 6)
        eq(['/', 6, 3], 2)
        eq(['%', 7, 3], 1)
        eq(['**', 2, 3], 8)
        eq(['===', 2, 2], true)
        eq(['is', NaN, NaN], true)
        eq(['is', 0, -0], false)
        eq(['!==', 2, 3], true)
        eq(['<', 2, 3], true)
        eq(['<=', 3, 3], true)
        eq(['>', 2, 3], false)
        eq(['>=', 3, 3], true)
        eq(['&', 6, 3], 2)
        eq(['|', 6, 3], 7)
        eq(['^', 6, 3], 5)
        eq(['<<', 1, 3], 8)
        eq(['>>', -8, 1], -4)
        eq(['>>>', -1, 31], 1)
        eq(['&&', 0, 1], 0)
        eq(['||', 0, 1], 1)
        eq(['??', null, 1], 1)
        eq(['?:', true, 1, 2], 1)
        eq(['?:', false, 1, 2], 2)
        eq([',', [1, 2]], 2)
    },
    context: () => {
        eq(['undefined'], undefined)
        eq(['frame'], 'F')
        assertStructurallySame(run(['args']), [10, 20])
    },
    containers: () => {
        assertStructurallySame(run(['[]', [1, ['...', [2, 3]]]]), [1, 2, 3])
        assertStructurallySame(run(['{}', [[':', 'a', 1], ['...', { b: 2 }]]]), { a: 1, b: 2 })
    },
    reads: () => {
        eq(['.', { a: 7 }, 'a'], 7)
        eq(['own', { a: 7 }, 'a'], 7)
        eq(['?.', null, 'a'], undefined)
        eq(['?.', { a: 7 }, 'a'], 7)
    },
    // A call step and the whole chain vocabulary over host values.
    calls: () => {
        const at = [42]
        eq(['()', (/**@type {number}*/x) => x + 1, [1]], 2)
        eq(['.', at, 'at', ['|()', [0]]], 42)
        eq(['.', at, 'at', ['|?.()', [0], ['|.', 'toFixed', ['|()', [1]]]]], '42.0')
        eq(['?.', at, 'at', ['|()', [0]]], 42)
        eq(['?.', at, 'at', ['|?.()', [0]]], 42)
        eq(['?.', null, 'at', ['|.', 'x']], undefined)
        eq(['?.', { f: null }, 'f', ['|?.()', [0], ['|.', 'x']]], undefined)
        eq(['?.()', null, [0]], undefined)
        eq(['?.()', (/**@type {number}*/x) => ({ y: x }), [3], ['|.', 'y']], 3)
    },
    // `=>` closes over the frame operand's value and starts a new
    // invocation per call, whose body reads its own `args` and `frame`.
    lambda: () => {
        const f = /**@type {(...a: unknown[]) => unknown}*/(run(['=>', 'captured', ['frame']]))
        assertEq(f(), 'captured')
        const g = /**@type {(...a: unknown[]) => unknown}*/(run(['=>', null, ['args']]))
        assertStructurallySame(g(1, 2), [1, 2])
    },
    throw: {
        escapingStep: () => run(['?.', null, 'a', ['|!()', []]]),
        ownKey: () => run(['own', {}, 1]),
        ownNullish: () => run(['own', null, 'a']),
        bigintPlus: () => run(['+', 0n]),
    },
}
