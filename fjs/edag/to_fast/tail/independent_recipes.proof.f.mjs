/**
 * Independent terminal recipes retain real DAG sharing and invocation values.
 * @import { Args, Exp } from '../../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { evaluate, failure } from '../../from_fast/member_returns/proof.f.mjs'
import { _independentTailRecipes } from './fixtures.f.js'

/** @type {(fn: Exp, args: Args) => Exp} */
const call = (fn, args) => ['()', fn, args]
/** @type {(value: Exp, index: number) => Exp} */
const at = (value, index) => ['.', value, index]

/** Read the shared calls directly, independently of tail planning.
 * @type {(graph: Exp) => { readonly left: Exp; readonly right: Exp; readonly otherLeft: Exp; readonly otherRight: Exp; readonly base: Exp }}
 */
const recipes = graph => {
    assert(graph instanceof Array && graph[0] === '=>')
    const body = graph[3]
    assert(body instanceof Array && body[0] === '?:')
    const decision = body[2]
    assert(decision instanceof Array && decision[0] === '?:')
    const first = decision[2]
    const second = decision[3]
    assert(first instanceof Array && first[0] === '?:')
    assert(second instanceof Array && second[0] === '?:')
    assert(first[2] instanceof Array && first[2][0] === '()')
    assert(first[3] instanceof Array && first[3][0] === '()')
    return { left: first[2], right: first[3], otherLeft: second[2], otherRight: second[3], base: body[3] }
}

export const proof = /** @type {const} */ ({
    factoryGraphsHaveDistinctCallsSharedAcrossTheirDecisionArms: () => {
        const first = _independentTailRecipes()
        const second = _independentTailRecipes()
        for (const name of /** @type {const} */ (['scalar', 'vectors', 'selectedFailure', 'snapshots'])) {
            assert(first[name] !== second[name])
            const current = recipes(first[name])
            const fresh = recipes(second[name])
            assert(current.left !== current.right)
            assert(current.left !== fresh.left)
            assert(current.right !== fresh.right)
            assertEq(current.otherLeft, name === 'selectedFailure' ? current.right : current.left)
            assertEq(current.otherRight, name === 'selectedFailure' ? current.left : current.right)
        }
        const snapshot = recipes(first.snapshots)
        assert(snapshot.left instanceof Array && snapshot.left[0] === '()')
        assert(snapshot.right instanceof Array && snapshot.right[0] === '()')
        assert(snapshot.base instanceof Array && snapshot.base[0] === '[]')
        const [current, repeated, reader] = snapshot.base[1]
        assert(current instanceof Array && current[0] === '[]')
        assert(current === repeated)
        assert(reader instanceof Array && reader[0] === '=>')
        assert(reader[2][0] === current)
        assert(snapshot.left[2][2] === reader)
        assert(snapshot.right[2][2] === reader)
    },
    selectedRecipesKeepTheirSmallInvocationValuesAndFailures: () => {
        const fixtures = _independentTailRecipes()
        for (const flag of /** @type {const} */ ([false, true])) {
            for (const n of /** @type {const} */ ([0, 1, 2, 3])) {
                assertEq(evaluate(call(fixtures.scalar, [n, flag])), 0)
                assertEq(evaluate(call(fixtures.selectedFailure, [n, flag, false])), 0)
            }
            assertStructurallySame(evaluate(call(fixtures.vectors, [0, flag, 1, 2])), [1, 2])
            assertStructurallySame(evaluate(call(fixtures.vectors, [1, flag, 1, 2])), [2, 1])
            assertStructurallySame(evaluate(call(fixtures.vectors, [3, flag, 1, 2])), [2, 1])
            assertEq(evaluate(call(fixtures.selectedFailure, [0, flag, true])), 0)
        }
        assertStructurallySame(evaluate(call(fixtures.vectors, [2, false, 1, 2])), [1, 2])
        assertStructurallySame(evaluate(call(fixtures.vectors, [2, true, 1, 2])), [2, 1])
        assertEq(evaluate(call(fixtures.selectedFailure, [1, false, true])), 0)
        failure(call(fixtures.selectedFailure, [1, true, true]))
    },
    snapshotReadersRetainTheirCreatingInvocationAndSharedAllocation: () => {
        const { snapshots } = _independentTailRecipes()
        const initial = /** @type {const} */ (['=>', 0, [], ['[]', [-1]]])
        for (const flag of /** @type {const} */ ([false, true])) {
            for (const n of /** @type {const} */ ([0, 3])) {
                const value = call(snapshots, [n, flag, initial])
                /** @type {Exp} */
                const observed = ['[]', [
                    ['===', at(value, 0), at(value, 1)],
                    ['===', call(at(value, 2), []), at(value, 0)],
                    ['===', at(value, 0), at(value, 3)],
                    at(at(value, 0), 0), at(at(value, 3), 0),
                ]]
                assertStructurallySame(evaluate(observed), [true, true, false, 0, n === 0 ? -1 : 1])
                const another = call(snapshots, [n, flag, initial])
                assertEq(evaluate(['===', at(value, 0), at(another, 0)]), false)
            }
        }
    },
})
