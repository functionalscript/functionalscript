/**
 * What the memo executor answers, each claim beside amnesia's answer to the
 * same graph: the same value wherever sharing does not decide it, and both
 * answers pinned where it does.
 *
 * @import { Exp } from '../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { vm } from '../amnesia/module.f.mjs'
import { analysis } from '../analysis/module.f.mjs'
import { lazyOp2Id } from '../module.f.mjs'
import { memo } from './module.f.mjs'

const context = { frame: { x: 1 }, args: [10, 20] }

/** @type {(e: Exp) => unknown} */
const run = e => memo(analysis(e))(context)

/** @type {(e: Exp) => unknown} */
const oracle = e => vm(context)(e)

/** The same answer as amnesia, where sharing does not decide it. @type {(e: Exp) => void} */
const agrees = e => { assertStructurallySame(run(e), oracle(e)) }

/** @type {(e: Exp, expected: unknown) => void} */
const eq = (e, expected) => { assertEq(run(e), expected) }

/** An operand that throws when evaluated, so a case can claim "not evaluated" by passing. @type {Exp} */
const boom = ['.', null, 'x']

/** `[]`, a constructor: shared, its identity is what the model preserves. @type {Exp} */
const s = ['[]', [1]]

/** @type {(v: unknown) => readonly any[]} */
const array = v => /**@type {any}*/(v)

/** @type {(v: unknown) => (...a: unknown[]) => unknown} */
const callable = v => /**@type {any}*/(v)

export const proof = {
    // The model: one node reached twice is one value. Amnesia gives two
    // arrays and `false`; this executor gives one and `true`, which is
    // JavaScript's answer for `const s = [1]; [s, s]`.
    shared: () => {
        const r = array(run(['[]', [s, s]]))
        assert(r[0] === r[1])
        const a = array(oracle(['[]', [s, s]]))
        assert(a[0] !== a[1])
        eq(['===', s, s], true)
        assertEq(oracle(['===', s, s]), false)
        // Three edges, one value.
        const t = array(run(['[]', [s, s, s]]))
        assert(t[0] === t[1] && t[1] === t[2])
    },
    // Two accesses merged by the analysis are one value: `a[0]` twice over
    // `a = [{}]` is the same object twice, as it is in JavaScript.
    merged: () => {
        /** @type {Exp} */
        const a = ['[]', [['{}', []]]]
        const r = array(run(['[]', [['.', a, 0], ['.', a, 0]]]))
        assert(r[0] === r[1])
    },
    // A lazy operand is evaluated only when demanded: a shared node reached
    // only through untaken lazy positions is never evaluated, and one
    // demanded through two taken positions is evaluated once.
    lazy: () => {
        assertStructurallySame(run(['[]', [['&&', false, boom], ['||', true, boom], ['??', 0, boom]]]), [false, true, 0])
        eq(['?:', true, 7, boom], 7)
        const r = array(run(['[]', [['&&', true, s], ['||', false, s], ['?:', false, 0, s]]]))
        assert(r[0] === r[1] && r[1] === r[2])
        // A step past a failed guard is not taken, so its operand is not demanded.
        eq(['?.', null, 'f', ['|()', boom]], undefined)
    },
    /**
     * **`lazyOp2Id` is held to this table's behaviour, not to its text.**
     * The vocabulary is named once in `../module.f.mjs` because a reader of
     * a graph, a printer of `.rs` and this executor all need the same three
     * tags; a second list is the one that drifts. So every tag it names is
     * shown here to leave its right operand undemanded given a left that
     * decides the answer, and a tag from each other corner of `op2` is shown
     * to force it — under `throw` below, since forcing it throws.
     */
    lazyVocabulary: () => {
        // The left that short-circuits, per operator.
        const deciding = { '&&': false, '||': true, '??': 0 }
        for (const tag of lazyOp2Id) {
            const left = deciding[tag]
            assertEq(run([tag, left, boom]), left)
        }
    },
    // A body's slots are per call: a constructor inside is fresh per call
    // and one within a call, and a body's `args` and `frame` are its own.
    body: () => {
        /** @type {Exp} */
        const inner = ['[]', []]
        const f = callable(run(['=>', 0, ['[]', [5]], ['[]', [inner, inner, ['args'], ['frame']]]]))
        const first = array(f(1))
        const second = array(f(2))
        assert(first[0] === first[1])
        assert(first[0] !== second[0])
        assertStructurallySame(first[2], [1])
        assertStructurallySame(first[3], [5])
        // A body inside a body, each its own scope: the inner closure's
        // constructor is fresh per inner call, whichever outer call made it.
        const g = callable(run(['=>', 0, null, ['=>', 0, null, ['[]', [inner, inner]]]]))
        const h = callable(g())
        const x = array(h())
        assert(x[0] === x[1] && x[0] !== array(h())[0])
        // A primitive body is its value and opens no invocation, as a
        // primitive program is its value: no slot is built for either.
        assertEq(callable(run(['=>', 0, null, 5]))(), 5)
        eq(5, 5)
        // The count is the callable's `length`, as amnesia's is, and the
        // slots are the body's whatever the count: a read of position `1`
        // shared twice is one value per call.
        const two = callable(run(['=>', 2, ['[]', []], ['[]', [['.', ['args'], 1], ['.', ['args'], 1]]]]))
        assertEq(two.length, 2)
        assertStructurallySame(two(1, inner), [inner, inner])
    },
    // Wherever sharing does not decide the value, the answer is amnesia's:
    // every operation once through both executors over one graph.
    agrees: () => {
        agrees(1)
        agrees(['+', ['*', 2, 3], ['-', 1]])
        agrees(['[]', [1, ['...', ['[]', [2, 3]]], ['{}', [[':', 'a', ['String', 4]], ['...', ['{}', [[':', 'b', ['undefined']]]]]]]]])
        agrees(['.', ['args'], 1])
        agrees(['.', ['frame'], 'x'])
        agrees(['own', ['{}', [[':', 'k', 9]]], 'k'])
        agrees([',', [1, ['!', 0]]])
        agrees(['?.', ['undefined'], 'x', ['|.', 'y']])
        agrees(['()', ['=>', 0, null, ['.', ['args'], 0]], ['[]', [7]]])
        agrees(['()', ['=>', 2, null, ['[]', [['.', ['args'], 1], ['.', ['args'], 'length']]]], ['[]', [7]]])
        agrees(['.', ['=>', 2, null, 1], 'length'])
        agrees(['.', ['[]', [42]], 'at', ['|?.()', ['[]', [0]], ['|.', 'toFixed', ['|()', ['[]', [1]]]]]])
        agrees(['?.()', ['=>', 0, null, ['{}', [[':', 'y', 3]]]], ['[]', []], ['|.', 'y']])
        agrees(['typeof', ['&&', 1, 'a']])
    },
    throw: {
        // Amnesia's throws are this executor's: a demanded lazy operand that throws, throws.
        forced: () => run(['&&', true, boom]),
        nullishBase: () => run(['.', ['undefined'], 'x']),
        // Outside `lazyOp2Id`, the right operand is forced: comparison,
        // arithmetic and bitwise, one from each other corner of `op2`.
        eagerComparison: () => run(['===', 1, boom]),
        eagerArithmetic: () => run(['*', 1, boom]),
        eagerBitwise: () => run(['&', 1, boom]),
    },
}
