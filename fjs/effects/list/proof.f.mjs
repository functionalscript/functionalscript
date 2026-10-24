/**
 * @import { EffectList, Next } from './types.ts'
 * @import { NotImplemented } from '../types.ts'
 */

import { runPure } from '../module.f.mjs'
import { empty, fromList, nonEmpty } from './module.f.mjs'
import { assert, assertEq, assertOk } from '../../asserts/module.f.js'

/**
 * Pulls one cell. Both constructors are pure, so the cell is reached without a
 * runner.
 *
 * @type {(e: EffectList<never, number>) => Next<never, number, NotImplemented>}
 */
const pull = e => {
    const o = runPure(e)
    assert(o.length === 1, o)
    return assertOk(o[0])
}

export const proof = {
    /** `empty` is the end of the stream. */
    empty: () => {
        assertEq(pull(empty()), undefined)
    },
    /** `nonEmpty` is a cell holding `first` and the `tail` it was given. */
    nonEmpty: () => {
        /** @type {EffectList<never, number>} */
        const tail = empty()
        const cell = pull(nonEmpty(1, tail))
        assert(cell !== undefined, cell)
        assertEq(cell.first, 1)
        assertEq(cell.tail, tail)
    },
    /** `fromList` streams a strict list cell by cell and ends where it ends. */
    fromList: () => {
        const c1 = pull(fromList([1, 2]))
        assert(c1 !== undefined, c1)
        assertEq(c1.first, 1)
        const c2 = pull(c1.tail)
        assert(c2 !== undefined, c2)
        assertEq(c2.first, 2)
        assertEq(pull(c2.tail), undefined)
        assertEq(pull(fromList(null)), undefined)
    },
}
