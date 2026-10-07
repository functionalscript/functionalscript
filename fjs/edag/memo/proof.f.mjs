/**
 * What the memo executor answers, each claim beside Amnesia's answer to the
 * same graph: the same value wherever sharing does not decide it, and both
 * answers pinned where it does.
 *
 * @import { Exp } from '../types.ts'
 * @import { EdagValue, Values, Array as ValueArray } from '../value/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.mjs'
import { vm } from '../amnesia/module.f.mjs'
import { analysis } from '../analysis/module.f.mjs'
import { lazyOp2Id } from '../module.f.mjs'
import { memo, invoke } from './module.f.mjs'
import { toData } from '../value/to_unknown/module.f.mjs'
import { call } from '../value/call/module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'

const context = { frame: [], args: [10, 20] }

/** @param {Exp} e */
const result = e => memo(assertOk(analysis(e)))(context)

/** @param {Exp} e */
const value = e => assertOk(result(e))

/** @type {(e: Exp) => unknown} */
const run = e => assertOk(toData(value(e)))

/** @type {(e: Exp) => unknown} */
const oracle = e => assertOk(toData(assertOk(vm(context)(e))))

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

/** Call a represented function; this proof adapter never exposes a runtime function. @type {(v: EdagValue, args?: Values) => EdagValue} */
const apply = (v, args = []) => assertOk(call(ok(v), args.map(a => () => ok(a)), invoke))

/** @type {(v: EdagValue) => Values} */
const elements = v => /** @type {ValueArray} */ (v)[1]

/** @type {(e: Exp, expected?: EdagValue) => void} */
const fails = (e, expected = ['undefined']) => assertStructurallySame(result(e), ['error', expected])

export const proof = {
    // `self` under memoization: the invoked function, the one node reused
    // across a body's shared reads, agreeing with the amnesia oracle
    self: () => {
        /** @type {Exp} */
        const fact = ['=>', 1, [], ['?:', ['<', ['arg', 0], 2], 1, ['*', ['arg', 0], ['()', ['self'], [['-', ['arg', 0], 1]]]]]]
        eq(['()', fact, [5]], 120)
        agrees(['()', ['=>', 0, [], ['is', ['self'], ['self']]], []])
        agrees(['()', ['=>', 1, [], ['?:', ['arg', 0], ['()', ['=>', 0, [['self']], ['()', ['frame', 0], [0]]], []], 'base']], [1]])
    },
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
        // The language's own failure node is a lazy operand like any other.
        eq(['?:', true, 7, ['throw', 1]], 7)
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
    // and one within a call, and a body's `args` and frame slots are its own.
    body: () => {
        /** @type {Exp} */
        const inner = ['[]', []]
        const f = value(['=>', 0, [5], ['[]', [inner, inner, ['rest'], ['frame', 0]]]])
        const first = elements(apply(f, [1]))
        const second = elements(apply(f, [2]))
        assert(first[0] === first[1])
        assert(first[0] !== second[0])
        assertStructurallySame(first[2], ['[]', [1]])
        assertEq(first[3], 5)
        // A body inside a body, each its own scope: the inner closure's
        // constructor is fresh per inner call, whichever outer call made it.
        const g = value(['=>', 0, [], ['=>', 0, [], ['[]', [inner, inner]]]])
        const h = apply(g)
        const x = elements(apply(h))
        assert(x[0] === x[1] && x[0] !== elements(apply(h))[0])
        // A primitive body is its value and opens no invocation, as a
        // primitive program is its value: no slot is built for either.
        assertEq(apply(value(['=>', 0, [], 5])), 5)
        eq(5, 5)
    },
    // Wherever sharing does not decide the value, the answer is amnesia's:
    // every operation once through both executors over one graph.
    agrees: () => {
        agrees(1)
        agrees(['+', ['*', 2, 3], ['-', 1]])
        agrees(['[]', [1, ['...', ['[]', [2, 3]]], ['{}', [[':', 'a', ['String', 4]], ['...', ['{}', [[':', 'b', ['undefined']]]]]]]]])
        agrees(['.', ['args'], 1])
        agrees(['()', ['=>', 0, [['{}', [[':', 'x', 1]]]], ['.', ['frame', 0], 'x']], []])
        agrees(['own', ['{}', [[':', 'k', 9]]], 'k'])
        agrees([',', [1, ['!', 0]]])
        agrees(['?.', ['undefined'], 'x', ['|.', 'y']])
        agrees(['()', ['=>', 0, [], ['.', ['rest'], 0]], [7]])
        agrees(['.', ['[]', [42]], 'at', ['|?.()', [0], ['|.', 'toFixed', ['|()', [1]]]]])
        agrees(['?.()', ['=>', 0, [], ['{}', [[':', 'y', 3]]]], [], ['|.', 'y']])
        agrees(['typeof', ['&&', 1, 'a']])
    },
    operations: () => {
        for (const tag of /** @type {const} */ (['+', '-', '*', '/', '%', '**', '&', '|', '^', '<<', '>>', '>>>', '<', '<=', '>', '>=', '===', '!==', 'is'])) {
            agrees([tag, 6, 2])
        }
        for (const tag of /** @type {const} */ (['!', 'typeof', 'String', 'Number', '~', '+', '-'])) { agrees([tag, '2']) }
        agrees(['+', ['[]', [1, 2]], ['{}', []]])
        agrees(['+', ['{}', [[':', 'valueOf', ['=>', 0, [], 3]]]], 2])
        agrees(['own', ['[]', [7]], '0'])
        agrees(['.', ['[]', [7]], ['Number', '0']])
        eq([',', []], undefined)
        eq(['??', null, 4], 4)
        eq(['||', 0, 5], 5)
        assertEq(run(['===', ['args'], ['args']]), true)
        // Lists beginning with '#' are ordinary data, never table references.
        assertStructurallySame(assertOk(toData(apply(value(['=>', 0, [], ['[]', ['#', 42]]])))), ['#', 42])
    },
    chains: () => {
        /** @type {Exp} */
        const identity = ['=>', 1, [], ['arg', 0]]
        /** @type {Exp} */
        const obj = ['{}', [[':', 'f', identity], [':', 'nothing', ['undefined']]]]
        eq(['?.', obj, 'f', ['|()', [7]]], 7)
        eq(['.', obj, 'f', ['|?.()', [8]]], 8)
        eq(['.', obj, 'nothing', ['|?.()', [['throw', 1]]]], undefined)
        eq(['?.', obj, 'nothing', ['|?.()', [['throw', 1]], ['|.', 'x']]], undefined)
        eq(['?.()', ['undefined'], [['throw', 1]]], undefined)
        eq(['?.()', identity, [9]], 9)
        eq(['?.()', ['=>', 0, [], identity], [], ['|()', [10]]], 10)
        eq(['?.', ['{}', [[':', 'x', ['{}', [[':', 'y', 11]]]]]], 'x', ['|.', 'y']], 11)
        eq(['?.', obj, 'f', ['|!()', [12]]], 12)
        fails(['?.', null, 'f', ['|!()', [['throw', 13]]]], 13)
        fails(['?.()', null, [], ['|.', 'f', ['|!()', []]]])
        fails(['.', null, 'f', ['|()', [['throw', 14]]]])
        fails(['?.', obj, 'nothing', ['|.', 'x']])
        // Own properties shadow builtins even when their value is undefined.
        eq(['.', ['{}', [[':', 'toString', ['undefined']]]], 'toString', ['|?.()', [['throw', 1]]]], undefined)
        eq(['.', ['{}', [[':', 'toString', ['=>', 0, [], 'own']]]], 'toString', ['|()', []]], 'own')
        fails(['.', ['{}', [[':', 'toString', 0]]], 'toString', ['|()', []]])
        eq(['.', ['[]', [2, 3]], 'at', ['|()', [1]]], 3)
    },
    failures: () => {
        /** @type {Exp} */
        const thrown = ['throw', 42]
        /** @type {Exp} */
        const numberFailure = ['{}', [[':', 'valueOf', ['=>', 0, [], thrown]]]]
        /** @type {Exp} */
        const keyFailure = ['{}', [[':', 'toString', ['=>', 0, [], ['throw', 43]]]]]
        fails(['+', numberFailure, 1], 42)
        fails(['+', 1, numberFailure], 42)
        fails(['.', ['{}', []], ['Number', numberFailure]], 42)
        fails(['{}', [[':', keyFailure, ['throw', 44]]]], 43)
        fails(['{}', [[':', thrown, ['throw', 44]]]], 42)
        fails(['{}', [[':', 'x', thrown]]], 42)
        fails(['{}', [['...', thrown]]], 42)
        fails(['[]', [['...', 1], thrown]])
        fails(['[]', [thrown]], 42)
        fails(['=>', 0, [thrown], ['throw', 44]], 42)
        fails(['()', thrown, [['throw', 44]]], 42)
        fails(['()', 0, [thrown]], 42)
        fails(['()', 0, []])
        fails([',', [thrown, ['throw', 44]]], 42)
        fails(['throw', thrown], 42)
        fails(['own', ['{}', []], 0])
        fails(['+', 1n, 2])
        fails(['/', 1n, 0n])
        // Caller-supplied represented values, including thrown containers,
        // retain identity rather than being decoded and reconstructed.
        /** @type {EdagValue} */
        const payload = ['{}', [[':', 'message', 'original']]]
        const thrownPayload = memo(assertOk(analysis(['throw', ['.', ['args'], 0]])))({ args: [payload] })
        assertEq(thrownPayload[0], 'error')
        assertEq(thrownPayload[1], payload)
    },
    callbackFailures: () => {
        /** @type {EdagValue} */
        const payload = ['{}', [[':', 'message', 'callback failure']]]
        const invocation = { args: [payload] }
        /** @type {Exp} */
        const callback = ['=>', 0, [['.', ['args'], 0]], ['throw', ['frame', 0]]]
        for (const method of ['map', 'reduce', 'toSorted']) {
            // Each VM constructs the callback, captures the supplied value,
            // and carries its failure through the method and outer operand.
            /** @type {Exp} */
            const explicit = ['+', 0, ['.', ['[]', [1, 2]], method, ['|()', [callback]]]]
            for (const result of [
                memo(assertOk(analysis(explicit)))(invocation),
                vm({ ...invocation, frame: [] })(explicit),
            ]) { assertEq(assertError(result), payload) }

            /** @type {Exp} */
            const implicit = ['+', 0, ['.', ['[]', [1, 2]], method, ['|()', [0]]]]
            for (const result of [
                memo(assertOk(analysis(implicit)))(invocation),
                vm({ ...invocation, frame: [] })(implicit),
            ]) { assertStructurallySame(result, ['error', ['undefined']]) }
        }
    },
    throw: {
        // A frame slot read outside a function is refused before anything
        // runs, as `rest` is: a module has no frame.
        frameInModule: () => run(['frame', 0]),
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
