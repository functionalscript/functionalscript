/**
 * Mixed self uses retain ordinary-call sharing and closed capture identity.
 * Native output suites separately exercise the same fixture at deep counts.
 *
 * @import { Args, Exp } from '../../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { evaluate } from '../../from_fast/member_returns/proof.f.mjs'
import { _mixedSelfUses } from './fixtures.f.js'

/** @type {(fn: Exp, args: Args) => Exp} */
const call = (fn, args) => ['()', fn, args]
/** @type {(value: Exp, index: number) => Exp} */
const at = (value, index) => ['.', value, index]

export const proof = /** @type {const} */ ({
    ordinarySelfEvaluationIsSharedBeforeTheFollowingArray: () => {
        const graph = _mixedSelfUses()
        const fresh = _mixedSelfUses()
        assertEq(graph[1], 1)
        assertStructurallySame(graph[2], [7, ['[]', []], 9])
        assert(graph !== fresh)
        assert(graph[2][1] !== fresh[2][1])
        const body = graph[3]
        assert(body instanceof Array && body[0] === '?:')
        const tail = body[2]
        assert(tail instanceof Array && tail[0] === '()')
        assertStructurallySame(tail[1], ['self'])
        const decision = body[3]
        assert(decision instanceof Array && decision[0] === '?:')
        const ordinaryResults = decision[2]
        assert(ordinaryResults instanceof Array && ordinaryResults[0] === '[]')
        const [ordinary, repeated] = ordinaryResults[1]
        assert(ordinary instanceof Array && ordinary[0] === '()')
        assertEq(ordinary, repeated)
        assert(ordinary !== tail)
        assertStructurallySame(ordinary, ['()', ['self'], [0]])
        assertStructurallySame(decision[3], ['[]', [['frame', 2], ['frame', 0], ['frame', 1], ['self']]])
    },
    shallowTailAndOrdinaryInvocationsKeepSelfCapturesAndFreshResults: () => {
        const graph = _mixedSelfUses()
        const base = call(graph, [0])
        const ordinary = call(graph, [1])
        const tail = call(graph, [3])
        const fresh = call(graph, [1])
        /** @type {Exp} */
        const observations = ['[]', [
            at(base, 0), at(base, 1), at(base, 2),
            ['===', at(base, 3), graph],
            ['===', at(ordinary, 0), at(ordinary, 1)],
            ['===', at(tail, 0), at(tail, 1)],
            ['===', at(at(ordinary, 0), 3), graph],
            ['===', at(at(tail, 0), 3), graph],
            ['===', at(at(ordinary, 0), 2), at(base, 2)],
            ['===', at(at(tail, 0), 2), at(base, 2)],
            ['!==', at(ordinary, 0), at(fresh, 0)],
            ['!==', at(tail, 0), at(ordinary, 0)],
        ]]
        assertStructurallySame(evaluate(observations), [9, 7, [], true, true, true, true, true, true, true, true, true])
    },
})
