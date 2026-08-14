/** @import { Monoid } from './types.ts' */

import { repeat, fold } from './module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

export const proof = {
    numberAdd: () => {
        /** @type {Monoid<number>} */
        const add = {
             identity: 0,
             operation: a => b => a + b,
        };
        const resultAdd = repeat(add)(10n)(2) // 20
        assertEq(resultAdd, 20)

        const id = repeat(add)(0n)(42)
        assertEq(id, 0)
    },
    stringConcat: () => {
        /** @type {Monoid<string>} */
        const concat = {
             identity: '',
             operation: a => b => a + b,
        };

        const resultConcat = repeat(concat)(3n)('ha') // 'hahaha'
        assertEq(resultConcat, 'hahaha')
    },
    fold: {
        nonEmpty: () => {
            /** @type {Monoid<number>} */
            const add = {
                identity: 0,
                operation: a => b => a + b,
            };
            assertEq(fold(add)([1, 2, 3, 4]), 10)
        },
        order: () => {
            // a non-commutative monoid: `fold` must preserve left-to-right order
            // (`((('' + 'a') + 'b') + 'c')`), not reverse it to `'cba'`.
            /** @type {Monoid<string>} */
            const concat = {
                identity: '',
                operation: a => b => a + b,
            };
            assertEq(fold(concat)(['a', 'b', 'c']), 'abc')
        },
        empty: () => {
            /** @type {Monoid<string>} */
            const concat = {
                identity: '',
                operation: a => b => a + b,
            };
            // an empty list folds to the identity
            assertEq(fold(concat)([]), '')
        },
        balanced: () => {
            // `operation` brackets each combination so the *grouping* `fold`
            // chose is visible in the result. It is deliberately **not**
            // associative — a lawful monoid could not observe the grouping at
            // all, which is exactly why re-associating is allowed. The identity
            // still behaves as one (both branches return the other operand
            // unchanged), so `fold`'s contract is respected.
            /** @type {Monoid<string>} */
            const bracket = {
                identity: '',
                operation: a => b => a === '' ? b : b === '' ? a : `(${a}${b})`,
            }
            const f = fold(bracket)
            assertEq(f(['a']), 'a')
            assertEq(f(['a', 'b']), '(ab)')
            // three elements keep the trailing run separate: `c` merges with
            // nothing, so it combines against `(ab)` only at the end.
            assertEq(f(['a', 'b', 'c']), '((ab)c)')
            // four is where balancing separates from a left fold, which would
            // give `(((ab)c)d)`.
            assertEq(f(['a', 'b', 'c', 'd']), '((ab)(cd))')
            assertEq(f(['a', 'b', 'c', 'd', 'e']), '(((ab)(cd))e)')
        },
    }
}
