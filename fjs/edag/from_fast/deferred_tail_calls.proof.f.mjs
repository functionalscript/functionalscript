/** Deferred owning self tails keep their first-demand and invocation owners.
 * @import { BindingId, Block, Function as FastFunction, Value } from '../../js/ast/types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { fromFast } from './module.f.mjs'
import { _fixtures } from './deferred_tail_calls/fixtures.f.mjs'
import { identityAnalysis } from '../analysis/module.f.mjs'
import { memo } from '../memo/module.f.mjs'
import { toData } from '../value/to_unknown/module.f.mjs'

/** @type {(block: Block) => ValueResult} */
const interpreted = block => memo(assertOk(identityAnalysis(fromFast(block))))({ args: [] })

/** @type {(block: Block) => unknown} */
const data = block => assertOk(toData(assertOk(interpreted(block))))

/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]

/** @type {(fn: FastFunction, args?: readonly Value[]) => ValueResult} */
const called = (fn, args = []) => interpreted({
    statements: [], exit: ['yield', [['()', ['function', fn], args]]],
})

/** @type {(fn: FastFunction, args?: readonly Value[]) => unknown} */
const evaluated = (fn, args = []) => assertOk(toData(assertOk(called(fn, args))))

/** Both calls share one established function, so invocation freshness is observable.
 * @type {(fn: FastFunction, args: readonly Value[]) => unknown}
 */
const twice = (fn, args) => {
    const callee = /** @type {const} */ ({ index: 0 })
    const first = /** @type {const} */ ({ index: 0 })
    const second = /** @type {const} */ ({ index: 0 })
    return data({
        statements: [
            ['define', callee, ['function', fn], 'required'],
            ['define', first, ['()', ref(callee), args], 'required'],
            ['define', second, ['()', ref(callee), args], 'required'],
        ],
        exit: ['yield', [['array', [ref(first), ref(second)]]]],
    })
}

export const proof = /** @type {const} */ ({
    demandedRecipesKeepTheirOwningReturnAcrossLoops: () => {
        const { terminal, ordinary, nestedRecipe, insideAlias, outsideAlias } = _fixtures()
        for (const fn of [terminal, ordinary, nestedRecipe, insideAlias, outsideAlias]) {
            assertEq(evaluated(fn, [0]), 7)
            assertEq(evaluated(fn, [3]), 7)
        }
    },
    selectedTailValuesReadOneInvocationSnapshot: () => {
        const { tailValues, nonTail } = _fixtures()
        assertStructurallySame(evaluated(tailValues, [0, 4, 9]), [4, 9])
        assertStructurallySame(evaluated(tailValues, [3, 4, 9]), [9, 4])
        assertEq(evaluated(nonTail, [3]), 3)
    },
    loopLocalRecipesRestartAfterOrdinaryIterations: () => {
        const { localReset } = _fixtures()
        assertEq(evaluated(localReset, [0, 0]), 2)
        assertEq(evaluated(localReset, [3, 0]), 8)
    },
    capturesRetainTheirCreatingInvocation: () => {
        const values = twice(_fixtures().captures, [3, null])
        assert(values instanceof Array && values[0] instanceof Array && values[1] instanceof Array)
        const [first, second] = values
        assertStructurallySame(first, [[0], [1]])
        assertStructurallySame(second, [[0], [1]])
        assert(first[0] !== first[1])
        assert(first[0] !== second[0])
        assert(first[1] !== second[1])
    },
    deferredDemandPreservesArgumentFailuresAndSkips: () => {
        const { extraArguments, failedSpread } = _fixtures()
        assertEq(evaluated(extraArguments, [3, false]), 7)
        assertEq(evaluated(extraArguments, [0, true]), 7)
        assertEq(evaluated(extraArguments, [-1, true]), 9)
        assertError(called(extraArguments, [1, true]))
        assertEq(evaluated(failedSpread, [0]), 7)
        assertError(called(failedSpread, [1]))
    },
    restDemandsKeepFreshArraysAndRepeatedReadIdentity: () => {
        const { rest, restOnly } = _fixtures()
        const result = /** @type {const} */ ({ index: 0 })
        const value = ref(result)
        const values = data({
            statements: [['define', result, ['()', ['function', rest], [3, null, ['array', [9]], 7]], 'required']],
            exit: ['yield', [['array', [
                ['.', value, 0], ['.', value, 1], ['.', value, 2], ['()', ['.', value, 3], []],
            ]]]],
        })
        assert(values instanceof Array)
        assertStructurallySame(values, [[[9], 7], [[9], 7], [[9], 7], [[9], 7]])
        assert(values[0] !== values[1])
        assertEq(values[1], values[2])
        assertEq(values[1], values[3])
        assertEq(evaluated(restOnly, [3, 0]), 3)
    },
    normalPayloadTagsStayOpaqueAndMemoized: () => {
        const { normalPayload } = _fixtures()
        for (const tail of [false, true]) {
            for (const tag of ['tail', 'return', 'normal']) {
                const values = twice(normalPayload, [3, tail, tag])
                assert(values instanceof Array && values[0] instanceof Array && values[1] instanceof Array)
                const [first, second] = values
                const expected = /** @type {const} */ ([tag, [tail ? 0 : 3]])
                assertStructurallySame(first, [expected, expected])
                assertStructurallySame(second, [expected, expected])
                assertEq(first[0], first[1])
                assertEq(second[0], second[1])
                assert(first[0] !== second[0])
            }
        }
    },
})
