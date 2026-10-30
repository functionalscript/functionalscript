/**
 * @import { List } from '../../types/list/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Absorbing, Monoid, Stack, Weight } from './types.ts'
 */

import { repeat, fold, foldAbsorbing, runs, step, uniform } from './module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { toArray } from '../../types/list/alt/module.f.mjs'
import { concat, countdown, map, repeat as repeatItem } from '../../types/list/module.f.mjs'

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
    weight: uniform,
}

/** @type {Weight<string>} */
const length = s => s.length

/** {@link bracket}, weighed by length. @type {Monoid<string>} */
const weighedBracket = { identity: bracket.identity, operation: bracket.operation, weight: length }

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

/** {@link cost} balanced by count, as `fold` was before it weighed. @type {Monoid<{ readonly length: number, readonly copies: number }>} */
const countedCost = { identity: cost.identity, operation: cost.operation, weight: uniform }

/** @type {(length: number) => { readonly length: number, readonly copies: number }} */
const chunk = length => ({ length, copies: 0 })

/** @type {Absorbing<number>} */
const multiply = {
    monoid: {
        identity: 1,
        operation: a => b => a * b,
        weight: uniform,
    },
    absorbing: 0,
}

export const proof = {
    numberAdd: () => {
        /** @type {Monoid<number>} */
        const add = {
             identity: 0,
             operation: a => b => a + b,
             weight: uniform,
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
             weight: length,
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
                weight: uniform,
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
            // nothing, so it combines against `(ab)` only at the end.
            assertEq(f(['a', 'b', 'c']), '((ab)c)')
            // four is where balancing separates from a left fold, which would
            // give `(((ab)c)d)`.
            assertEq(f(['a', 'b', 'c', 'd']), '((ab)(cd))')
            assertEq(f(['a', 'b', 'c', 'd', 'e']), '(((ab)(cd))e)')
            // the runs left on the stack combine lightest first, so the
            // heaviest, `((ab)(cd))`, is copied once: `(ef)` and `g` join
            // before it does.
            assertEq(f(['a', 'b', 'c', 'd', 'e', 'f', 'g']), '(((ab)(cd))((ef)g))')
        },
    },
    weighed: {
        // Weighed by length, a long value waits at the bottom of the stack
        // until the runs above it together outweigh it.
        grouping: () => {
            const f = fold(weighedBracket)
            assertEq(f([]), '')
            assertEq(f(['aaaa', 'b', 'c']), '(aaaa(bc))')
            assertEq(fold(bracket)(['aaaa', 'b', 'c']), '((aaaab)c)')
            // `bb` outweighs `c`, but `aaa` does not outweigh the two together:
            // they merge, and the result then outweighs `aaa` too.
            assertEq(f(['aaa', 'bb', 'c']), '(aaa(bbc))')
            // equal weights carry like the binary counter `fold` is
            assertEq(f(['aa', 'bb', 'c']), '((aabb)c)')
            assertEq(f(['a', 'b', 'c', 'd', 'e']), fold(bracket)(['a', 'b', 'c', 'd', 'e']))
        },
        // One array of 1024 items followed by 1024 arrays of one: counted,
        // the long array merges at every carry that reaches its run, ten
        // times; weighed by length it merges once, when the short ones
        // together outweigh it. Both then pass the result through the
        // identity once, which is the `2048` in each count.
        longAmongShort: () => {
            const list = concat([chunk(1024)])(repeatItem(chunk(1))(1024))
            const weighed = fold(cost)(list)
            assertEq(weighed.length, 2048)
            assertEq(weighed.copies, 14_336)
            const counted = fold(countedCost)(list)
            assertEq(counted.length, 2048)
            assertEq(counted.copies, 22_519)
        },
        // Arrays of strictly decreasing length never merge under the plain
        // "merge while the top is no heavier" rule, which would copy about
        // 180 million items here; the invariant keeps the stack logarithmic
        // and stays within a few per cent of the count-balanced fold.
        decreasing: () => {
            const list = map((/** @type {number} */ n) => chunk(n + 1))(countdown(1024))
            const weighed = fold(cost)(list)
            assertEq(weighed.length, 524_800)
            assertEq(weighed.copies, 5_835_821)
            assertEq(fold(countedCost)(list).copies, 5_772_800)
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
                    weight: uniform,
                },
                absorbing: 0,
            }
            assertEq(foldAbsorbing(min)([]), null)
            assertEq(foldAbsorbing(min)([3, null, 5]), 3)
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
            // itself...
            assertEq(foldAbsorbing(multiply)({ first: 0, tail: rest(1) }), 0)
            // ...and here only the merge of `2` and `0` reaches it.
            assertEq(
                foldAbsorbing(multiply)({ first: 2, tail: { first: 0, tail: rest(1) } }),
                0)
        },
    },
    foldAbsorbingWeighed: () => {
        // concatenation capped at five characters, `null` once over the cap
        /** @type {Absorbing<string | null>} */
        const capped = {
            monoid: {
                identity: '',
                operation: a => b =>
                    a === null || b === null || a.length + b.length > 5 ? null : a + b,
                weight: s => s === null ? 0 : s.length,
            },
            absorbing: null,
        }
        const f = foldAbsorbing(capped)
        assertEq(f([]), '')
        assertEq(f(['ab', 'c', 'd']), 'abcd')
        assertEq(f(['abcd', 'e', 'f']), null)
        // `'abcd'` and `'ef'` already exceed the cap, but only their merge
        // says so, and empty values after them weigh nothing. Each counts
        // as one all the same: the second empty carries into `'ef'`, that
        // run into `'abcd'`, and the walk stops before the third is read.
        /** @type {List<string | null>} */
        const unread = () => {
            assert(false)
            return { first: '', tail: unread }
        }
        assertEq(f({ first: 'abcd', tail: { first: 'ef', tail: { first: '', tail: { first: '', tail: unread } } } }), null)
    },
    // The run stack carries like a binary counter: the run sizes are the set
    // bits of the number of elements pushed, and each merge keeps the earlier
    // run on the left.
    stack: () => {
        /** @type {Monoid<string>} */
        const concat = { identity: '', operation: a => b => a + b, weight: uniform }
        const s = step(concat)
        /** @type {Stack<string>} */
        const empty = null
        assertStructurallySame(toArray(runs(empty)), [])
        const three = s('c')(s('b')(s('a')(empty)))
        assertStructurallySame(toArray(runs(three)), ['c', 'ab'])
        const four = s('d')(three)
        assertEq(four.size, 4)
        assertStructurallySame(toArray(runs(four)), ['abcd'])
    },
    // Weighed, a run's size is the weight of what it holds, and a heavy run
    // stays below the light ones.
    stackWeighed: () => {
        /** @type {Monoid<string>} */
        const concat = { identity: '', operation: a => b => a + b, weight: length }
        const s = step(concat)
        const three = s('c')(s('b')(s('aaaa')(null)))
        assertStructurallySame(toArray(runs(three)), ['bc', 'aaaa'])
        assertEq(three.size, 2)
        assertEq(three.rest === null ? 0 : three.rest.size, 4)
        // nothing weighs less than one
        assertEq(s('')(null).size, 1)
        assertEq(uniform(), 1)
    },
}
