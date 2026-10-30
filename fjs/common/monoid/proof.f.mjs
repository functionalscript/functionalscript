/**
 * @import { List } from '../../types/list/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Absorbing, Monoid, Weight } from './types.ts'
 */

import { repeat, fold, foldAbsorbing, runs, step } from './module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { toArray } from '../../types/list/alt/module.f.mjs'
import { concat, countdown, map, repeat as repeatItem } from '../../types/list/module.f.mjs'

const { abs } = Math

/** @type {Weight<string>} */
const length = s => s.length

/**
 * The letters of a bracketed string, {@link bracket}'s weight: the brackets a
 * grouping adds weigh nothing, so a run weighs the letters it holds.
 *
 * @type {Weight<string>}
 */
const letters = s => [...s].filter(c => c !== '(' && c !== ')').length

/**
 * `operation` brackets each combination so the *grouping* a fold chose is
 * visible in the result. It is deliberately **not** associative — a lawful
 * monoid could not observe the grouping at all, which is exactly why
 * re-associating is allowed. The identity still behaves as one (both
 * branches return the other operand unchanged), so the fold's contract is
 * respected.
 *
 * @type {Monoid<string>}
 */
const bracket = {
    identity: '',
    operation: a => b => a === '' ? b : b === '' ? a : `(${a}${b})`,
    weight: letters,
}

/** {@link bracket} with every value weighing nothing: the sequential fold. @type {Monoid<string>} */
const sequential = { identity: bracket.identity, operation: bracket.operation, weight: () => 0 }

/**
 * What concatenating arrays would copy: a value is an array's length and the
 * items every merge so far has written.
 *
 * @type {Monoid<{ readonly length: number, readonly copies: number }>}
 */
const cost = {
    identity: { length: 0, copies: 0 },
    operation: a => b => ({ length: a.length + b.length, copies: a.copies + b.copies + a.length + b.length }),
    weight: c => c.length,
}

/** @type {(length: number) => { readonly length: number, readonly copies: number }} */
const chunk = length => ({ length, copies: 0 })

/** @type {Absorbing<number>} */
const multiply = {
    monoid: {
        identity: 1,
        operation: a => b => a * b,
        weight: abs,
    },
    absorbing: 0,
}

/**
 * Concatenation capped at five characters, `null` once over the cap and
 * absorbing from then on; a string weighs its length.
 *
 * @type {Absorbing<string | null>}
 */
const capped = {
    monoid: {
        identity: '',
        operation: a => b =>
            a === null || b === null || a.length + b.length > 5 ? null : a + b,
        weight: s => s === null ? 0 : s.length,
    },
    absorbing: null,
}

/**
 * An unbounded tail no fold may read: forcing it fails the proof.
 *
 * @type {List<string | null>}
 */
const unread = () => {
    assert(false)
    return { first: '', tail: unread }
}

export const proof = {
    numberAdd: () => {
        /** @type {Pick<Monoid<number>, 'identity' | 'operation'>} */
        const add = { identity: 0, operation: a => b => a + b }
        const resultAdd = repeat(add)(10n)(2) // 20
        assertEq(resultAdd, 20)

        const id = repeat(add)(0n)(42)
        assertEq(id, 0)
    },
    stringConcat: () => {
        /** @type {Pick<Monoid<string>, 'identity' | 'operation'>} */
        const concat = { identity: '', operation: a => b => a + b }
        const resultConcat = repeat(concat)(3n)('ha') // 'hahaha'
        assertEq(resultConcat, 'hahaha')
    },
    fold: {
        nonEmpty: () => {
            /** @type {Monoid<number>} */
            const add = {
                identity: 0,
                operation: a => b => a + b,
                weight: abs,
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
                weight: length,
            };
            assertEq(fold(concat)(['a', 'b', 'c']), 'abc')
        },
        empty: () => {
            /** @type {Monoid<string>} */
            const concat = {
                identity: '',
                operation: a => b => a + b,
                weight: length,
            };
            // an empty list folds to the identity
            assertEq(fold(concat)([]), '')
        },
        balanced: () => {
            const f = fold(bracket)
            assertEq(f(['a']), 'a')
            assertEq(f(['a', 'b']), '(ab)')
            // three elements keep the trailing run separate: `c` merges with
            // nothing on arrival, so it combines against `(ab)` only at the end.
            assertEq(f(['a', 'b', 'c']), '((ab)c)')
            // four is where balancing separates from a left fold, which would
            // give `(((ab)c)d)`.
            assertEq(f(['a', 'b', 'c', 'd']), '((ab)(cd))')
            // `e` arrives on `(ab)`, `c`, `d`: `c` is no heavier than `e`, so
            // `c` and `d` merge beneath it, and the stack folds from the top.
            assertEq(f(['a', 'b', 'c', 'd', 'e']), '((ab)((cd)e))')
            assertEq(f(['a', 'b', 'c', 'd', 'e', 'f', 'g']), '(((ab)(cd))((ef)g))')
        },
        // Values that weigh nothing never let the runs beneath them stand, so
        // the fold is the left fold, the cheapest where merges cost the same.
        sequential: () => {
            assertEq(fold(sequential)(['a', 'b', 'c', 'd', 'e']), '((((ab)c)d)e)')
        },
    },
    weighed: {
        // Weighed by letters, a long value stands while what arrives above it
        // is lighter than the run beneath, and merges only when it is not.
        grouping: () => {
            const f = fold(bracket)
            assertEq(f([]), '')
            assertEq(f(['aaaa', 'b', 'c']), '(aaaa(bc))')
            assertEq(f(['aaa', 'bb', 'c']), '(aaa(bbc))')
            assertEq(f(['aa', 'bb', 'c']), '(aa(bbc))')
            // a heavy value arriving late is never merged on arrival
            assertEq(f(['a', 'b', 'cccc']), '((ab)cccc)')
            assertEq(f(['a', 'bbbb', 'c', 'd']), '((abbbb)(cd))')
            assertEq(f(['a', 'b', 'c', 'dddd', 'e']), '(((ab)c)(dddde))')
        },
        // One array of 1024 items and 1024 arrays of one, in either order: the
        // long array is merged once, when the short ones together outweigh the
        // run beneath it, and the short ones carry like a binary counter.
        longAmongShort: () => {
            const first = fold(cost)(concat([chunk(1024)])(repeatItem(chunk(1))(1024)))
            assertEq(first.length, 2048)
            assertEq(first.copies, 12_288)
            const last = fold(cost)(concat(repeatItem(chunk(1))(1024))([chunk(1024)]))
            assertEq(last.length, 2048)
            assertEq(last.copies, 12_288)
            assertEq(fold(cost)(repeatItem(chunk(1))(2048)).copies, 22_528)
        },
        // Arrays of strictly decreasing length never merge on arrival, so the
        // stack holds one run per array; the fold at the end merges them
        // pairwise where a run below is lighter than what has accumulated,
        // which keeps it at `w·log(w)` where folding from the top would copy
        // about 180 million items here. Increasing lengths cost the same.
        decreasing: () => {
            const down = fold(cost)(map((/** @type {number} */ n) => chunk(n + 1))(countdown(1024)))
            assertEq(down.length, 524_800)
            assertEq(down.copies, 5_117_693)
            assertEq(fold(cost)(map((/** @type {number} */ n) => chunk(1024 - n))(countdown(1024))).copies, 5_117_693)
        },
    },
    foldAbsorbing: {
        plain: () => {
            // with no absorbing element in the list, it is `fold`
            assertEq(foldAbsorbing(multiply)([2, 3, 4]), 24)
            assertEq(foldAbsorbing(multiply)([]), 1)
            assertEq(foldAbsorbing(multiply)([2, 3, 4]), fold(multiply.monoid)([2, 3, 4]))
        },
        absorbed: () => {
            assertEq(foldAbsorbing(multiply)([2, 0, 4]), 0)
        },
        nullValued: () => {
            // `min` over non-negative numbers, where `null` is the identity
            // (+infinity) and `0` is the absorbing element. `T` therefore
            // includes `null` without `null` being the stop condition — and
            // `tryFold` signals "stopped" and "finished" through one
            // `Nullable`, so a completed fold whose value is `null` must not be
            // read as an abandoned walk.
            /** @type {Absorbing<Nullable<number>>} */
            const min = {
                monoid: {
                    identity: null,
                    operation: a => b =>
                        a === null ? b : b === null ? a : a <= b ? a : b,
                    weight: v => v === null ? 0 : abs(v),
                },
                absorbing: 0,
            }
            assertEq(foldAbsorbing(min)([]), null)
            assertEq(foldAbsorbing(min)([3, null, 5]), 3)
            assertEq(foldAbsorbing(min)([3, null, 5, 7]), 3)
            assertEq(foldAbsorbing(min)([3, 0, 5]), 0)
        },
        stopsEarly: () => {
            // `List` includes `Thunk`, so this list is unbounded: `fold` would
            // pull from it forever. The elements past the absorbing one assert
            // that they are never read.
            /** @type {(n: number) => List<number>} */
            const rest = n => () => {
                assert(false)
                return { first: n, tail: rest(n + 1) }
            }
            // `0` is absorbing on its own, so the walk stops at the element
            // itself, before and after another one
            assertEq(foldAbsorbing(multiply)({ first: 0, tail: rest(1) }), 0)
            assertEq(
                foldAbsorbing(multiply)({ first: 2, tail: { first: 0, tail: rest(1) } }),
                0)
        },
        // Only a merge reaches `capped`'s absorbing element, and merges happen
        // beneath the value that arrives, so the stop comes at the merge that
        // first overflows, wherever on the stack it happens.
        mergeStops: () => {
            const f = foldAbsorbing(capped)
            assertEq(f([]), '')
            assertEq(f(['ab', 'c', 'd']), 'abcd')
            assertEq(f(['abcd', 'e', 'f']), null)
            assertEq(f(['abcd', 'ef', '', '']), null)
            // the seventh value makes `ij` and `kl` merge, and that run makes
            // `abcd` and `efgh` merge beneath it: six characters, over the cap,
            // so the eighth value is never read
            assertEq(
                f({ first: 'ab', tail: { first: 'cd', tail: { first: 'ef', tail: { first: 'gh', tail: { first: 'ij', tail: { first: 'kl', tail: { first: 'mn', tail: unread } } } } } } }),
                null)
        },
    },
    // The stack keeps the value pushed last on top, and a run two below a
    // value outweighs it; runs of one weight carry like a binary counter, two
    // of a kind side by side at most.
    stack: () => {
        /** @type {Monoid<string>} */
        const concat = { identity: '', operation: a => b => a + b, weight: length }
        const s = step(concat)
        assertStructurallySame(toArray(runs(null)), [])
        const three = s('c')(s('b')(s('a')(null)))
        assertStructurallySame(toArray(runs(three)), ['c', 'ab'])
        const four = s('d')(three)
        assertStructurallySame(toArray(runs(four)), ['d', 'c', 'ab'])
        // a heavy run stays at the bottom while lighter ones arrive
        const heavy = s('c')(s('b')(s('aaaa')(null)))
        assertStructurallySame(toArray(runs(heavy)), ['c', 'b', 'aaaa'])
    },
}
