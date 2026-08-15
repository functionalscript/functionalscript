/**
 * @import { Effect } from '../types.ts'
 */

import { do_, match, pure } from '../module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'
import { assertPure } from '../proof.f.mjs'
import { eff } from './module.f.mjs'

/** @typedef {readonly['add', (a: number, b: number) => number]} _AddOp */

/** @type {(command: 'add') => (a: number, b: number) => Effect<_AddOp, number>} */
const doAdd = do_

const next = match({ add: (a, b) => a + b })

export const proof = {
    value: () => {
        assertPure(eff(pure(5)).value, 5)
    },
    pure: () => {
        assertPure(pure(5), 5)
    },
    chain: () => {
        const x = eff(pure(5))
            .step(v => pure(v + 1))
            .step(v => pure(v * 2))
            .value
        assertPure(x, 12)
    },
    overDo: () => {
        const e = eff(doAdd('add')(2, 3))
            .step(r => pure(r + 1))
            .value
        const r = next(e)
        assert(r[0] === 'cont', r)
        assertEq(r[1], 5)
        assertPure(r[2](r[1]), 6)
    },
    map: {
        chain: () => {
            const x = eff(pure(5))
                .map(v => v + 1)
                .map(v => v * 2)
                .value
            assertPure(x, 12)
        },
        // `.map` grows the history exactly as `.step` does, so a callback after
        // it still reaches the pre-`map` value. This is the contract that makes
        // rewriting `.step(v => pure(f(v)))` into `.map(f)` a pure readability
        // change rather than one that alters what later callbacks receive.
        growsHistory: () => {
            const x = eff(pure(5))
                .map(v => v + 1)
                .step((v, prev) => pure(`${prev}${v}`))
                .value
            assertPure(x, '56')
        },
        overDo: () => {
            const e = eff(doAdd('add')(2, 3))
                .map(r => r + 1)
                .value
            const r = next(e)
            assert(r[0] === 'cont', r)
            assertEq(r[1], 5)
            assertPure(r[2](r[1]), 6)
        },
    },
}
