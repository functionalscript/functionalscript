/**
 * Producer-known invocation roots retain their owner through completion
 * transport without weakening structural admission for arbitrary loops.
 * @import { BindingId, Block, Function as FastFunction, Loop, Value } from '../../../../js/ast/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../../asserts/module.f.js'
import { identityAnalysis } from '../../../analysis/module.f.mjs'
import { fromFast } from '../../module.f.mjs'
import { completeTransfers } from '../completions/module.f.mjs'
import { memo } from '../../../memo/module.f.mjs'
import { toData } from '../../../value/to_unknown/module.f.mjs'
import { _invocationTransition } from '../../../../js/ast/invocation/module.f.js'
import { _directOwningInvocationRoot, invocationRootOf } from './module.f.mjs'

const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
const inner = /** @type {const} */ ({ kind: 'loop', index: 1 })
const entryN = /** @type {const} */ ({ index: 0 })
const entrySaved = /** @type {const} */ ({ index: 1 })
const entryRest = /** @type {const} */ ({ index: 2 })
const n = /** @type {const} */ ({ index: 3 })
const saved = /** @type {const} */ ({ index: 4 })
const rest = /** @type {const} */ ({ index: 5 })
const result = /** @type {const} */ ({ index: 6 })
const self = /** @type {const} */ ({ index: 7 })

/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]

/** @type {(loop: Loop, hasRest?: boolean) => FastFunction} */
const fn = (loop, hasRest = false) => ({ target: owner, parameters: hasRest ? [entryN, entrySaved] : [entryN],
    rest: hasRest ? entryRest : null, self, captures: [],
    body: { statements: [['loop', loop]], exit: ['return', owner, ref(result)] } })

/** @type {(source: FastFunction, args: readonly Value[]) => import('../../../value/control/types.ts').ValueResult} */
const evaluate = (source, args) => memo(assertOk(identityAnalysis(fromFast({ statements: [],
    exit: ['yield', [['()', ['function', source], args]]] }))))({ args: [] })

/** @type {(hasRest: boolean) => Loop} */
const nestedRoot = hasRest => {
    const transition = _invocationTransition(hasRest ? 2 : 1,
        hasRest ? [['-', ref(n), 1], ref(rest), ['...', ref(rest)]] : [['-', ref(n), 1]], target, hasRest)
    /** @type {Block} */
    const exit = { statements: [], exit: ['break', target, [hasRest
        ? ['array', [['===', ref(rest), ref(saved)], ref(rest), ref(saved)]] : 7]] }
    /** @type {Loop} */
    const nested = { target: inner, parameters: [], initial: [], results: [], body: {
        statements: [['if', [], ['>', ref(n), 0], transition, exit]], exit: ['continue', inner, []] } }
    return { target, parameters: hasRest ? [n, saved, rest] : [n],
        initial: hasRest ? [ref(entryN), ref(entrySaved), ref(entryRest)] : [ref(entryN)], results: [result],
        body: { statements: [], exit: ['loop', nested] } }
}

export const proof = /** @type {const} */ ({
    fixedInvocationControlCrossesNestedHelpers: () => {
        const loop = nestedRoot(false)
        const source = fn(loop)
        const completed = completeTransfers(source, loop)
        const direct = _directOwningInvocationRoot(completed, target)
        assertEq(direct.parameters, source.parameters)
        assertEq(direct.self, self)
        assertEq(assertOk(evaluate(source, [3])), 7)
        assertEq(assertOk(evaluate(direct, [3])), 7)
    },
    transportedRestKeepsValuesAndFreshInvocationIdentity: () => {
        const loop = nestedRoot(true)
        const source = fn(loop, true)
        const direct = _directOwningInvocationRoot(completeTransfers(source, loop), target)
        for (const version of [source, direct]) {
            const value = assertOk(toData(assertOk(evaluate(version, [2, null, 7, 8]))))
            assert(value instanceof Array)
            assertEq(value[0], false)
            assert(value[1] !== value[2])
            assertStructurallySame(value, [false, [7, 8], [7, 8]])
        }
    },
    exactRestRecipesStillUseTheirEstablishedInverse: () => {
        const args = /** @type {const} */ ([['-', ['ref', n], 1], ['ref', rest], ['...', ['ref', rest]]])
        const transition = _invocationTransition(2, args, target, true)
        /** @type {Loop} */
        const loop = { target, parameters: [n, saved, rest], initial: [ref(entryN), ref(entrySaved), ref(entryRest)],
            results: [result], body: { statements: [['if', [], ['>', ref(n), 0], transition,
                { statements: [], exit: ['break', target, [ref(rest)]] }]], exit: ['continue', target, [ref(n), ref(saved), ref(rest)]] } }
        const direct = _directOwningInvocationRoot(fn(loop, true), target)
        const conditional = direct.body.statements.at(-1)
        assert(conditional !== undefined && conditional[0] === 'if')
        assertEq(conditional[3].statements.length, 0)
        assert(conditional[3].exit[0] === 'return')
        const value = conditional[3].exit[2]
        assert(value instanceof Array && value[0] === '()')
        assertEq(value[2], args)
    },
    terminalRootsNeedNoNormalResultOrSuccessor: () => {
        /** @type {Loop} */
        const loop = { target, parameters: [n], initial: [ref(entryN)], results: [],
            body: { statements: [], exit: ['continue', target, [['-', ref(n), 1]]] } }
        /** @type {FastFunction} */
        const terminal = { ...fn(loop), body: { statements: [], exit: ['loop', loop] } }
        const direct = _directOwningInvocationRoot(terminal, target)
        assertEq(direct.body.statements.length, 1)
        assertEq(direct.body.exit[0], 'return')
        assertEq(invocationRootOf(terminal), null)
        /** @type {Loop} */
        const failing = { ...loop, body: { statements: [['if', [], ['>', ref(n), 0], loop.body,
            { statements: [], exit: ['throw', 'finished'] }]], exit: ['continue', target, [ref(n)]] } }
        const failure = _directOwningInvocationRoot({ ...terminal, body: { statements: [], exit: ['loop', failing] } }, target)
        assertError(evaluate(failure, [3]))
    },
    throw: {
        missingRoot: () => { _directOwningInvocationRoot({ ...fn(nestedRoot(false)), body: { statements: [], exit: ['return', owner, 0] } }, target) },
        foreignRoot: () => { _directOwningInvocationRoot(fn(nestedRoot(false)), { ...target }) },
        invalidTransportedRestSignature: () => {
            /** @type {Loop} */
            const loop = { ...nestedRoot(true), body: { statements: [], exit: ['continue', target, [0]] } }
            _directOwningInvocationRoot(fn(loop, true), target)
        },
    },
})
