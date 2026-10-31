/**
 * @import { List } from '../../types/list/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { DemoEvent } from '../../website/demo/types.ts'
 * @import { Absorbing, Monoid, Stack, Walk, Weight } from './types.ts'
 */

import { repeat, fold, foldAbsorbing, move, runs, step, accumulator, absorbingAccumulator } from './module.f.js'
import { demo, n, sequence, trace } from './demo.f.mjs'
import { assert, assertEq, assertNotNullish, assertStructurallySame } from '../../asserts/module.f.js'
import { toArray } from '../../types/list/alt/module.f.js'
import { concat, countdown, map, repeat as repeatItem, run } from '../../types/list/module.f.js'
import { htmlToString } from '../../media/html/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'
import { unwrap } from '../../types/result/module.f.js'
import { decodeQuery, encodeQuery, restoreInputs } from '../../website/demo/sharing/module.f.mjs'
import { stylesheet } from '../../website/style/module.f.js'

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
    machine: () => {
        const machine = accumulator(bracket)
        const suspended = machine.update(null, 'a')
        const [tag] = suspended
        assertEq(tag, 'next')
        assertEq(run({ ...machine, init: suspended })(['b', 'c']), fold(bracket)(['a', 'b', 'c']))
        assertEq(run(absorbingAccumulator(multiply))([2, 0, 7]), 0)
    },
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
        // The fold assumes nothing about a merged value's weight: it reads the
        // result's and applies the rule again. Weighed by magnitude, `2` and
        // `-2` merge to `0`, lighter than either, and a run of weight zero
        // lets every term above it merge in turn, so the stack never holds
        // more than two runs and the terms add in order, small ones first.
        cancelling: () => {
            /** @type {Monoid<{ readonly sum: number, readonly text: string }>} */
            const signed = {
                identity: { sum: 0, text: '' },
                operation: a => b => ({ sum: a.sum + b.sum, text: `(${a.text}${b.text})` }),
                weight: term => abs(term.sum),
            }
            const terms = [2, -2, 2, -2, 2].map((sum, i) => ({ sum, text: String.fromCharCode(0x61 + i) }))
            const folded = fold(signed)(terms)
            assertEq(folded.sum, 2)
            assertEq(folded.text, '((((ab)c)d)e)')
            const stack = terms.reduce((s, term) => step(signed)(term)(s), /** @type {Stack<{ readonly sum: number, readonly text: string }>} */ (null))
            assertStructurallySame(toArray(runs(stack)).map(run => run.sum), [2, 0])
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
            // The lifecycle tags keep an ordinary `null` result distinct from
            // early completion, whose summary can also be a domain value.
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
    // The fold one move at a time: a push's moves on a walk, then the fold's
    // on the walk the push left, each ending on the walk it was given.
    move: () => {
        /** @type {Monoid<string>} */
        const concat = { identity: '', operation: a => b => a + b, weight: length }
        const push = move(concat)(false)
        const collect = move(concat)(true)
        // `c` arrives on `b` over `a`, and `a` does not outweigh `c`: the two
        // runs beneath merge, and `c` waits
        /** @type {Walk<string>} */
        const arrived = { stack: { value: 'b', rest: { value: 'a', rest: null } }, value: 'c', pending: null }
        const merged = push(arrived)
        assertStructurallySame(merged, { stack: null, value: 'ab', pending: { value: 'c', rest: null } })
        // the merged run sits, and the pending `c` is the value again
        const settled = push(merged)
        assertStructurallySame(settled, { stack: { value: 'ab', rest: null }, value: 'c', pending: null })
        // `c` may sit and nothing is pending: the push is over
        assert(push(settled) === settled)
        // folding, the same walk merges `c` into the run beneath it, and is
        // over once the stack is empty
        const folded = collect(settled)
        assertStructurallySame(folded, { stack: null, value: 'abc', pending: null })
        assert(collect(folded) === folded)
        // a heavy run beneath lets a value sit on a push, which is where the
        // push and the fold part: the fold merges it in
        /** @type {Walk<string>} */
        const light = { stack: { value: 'b', rest: { value: 'aaaa', rest: null } }, value: 'c', pending: null }
        assert(push(light) === light)
        assertStructurallySame(collect(light), { stack: { value: 'aaaa', rest: null }, value: 'bc', pending: null })
    },
    demo: {
        // The drawing of the example the notation was designed on: the merge
        // beneath an arriving value, the pushes, the fold at the end, pairwise
        // where the run below is lighter, and the sum last.
        trace: () => {
            assertEq(trace([1, 2, 3, 3, 5, 1, 4, 2, 9, 0]), [
                '1 |',
                '1 2 |',
                '1_2 3',
                ' 3  3 |',
                ' 3__3 3',
                '  6   3 |',
                '  6   3 5 |',
                '  6   3 5 1 |',
                '  6   3 5 1 4 |',
                '  6   3 5 1_4 2',
                '  6   3_5  5  2',
                '  6    8   5  2 |',
                '  6    8   5__2 9',
                '  6____8    7   9',
                '    14      7   9 |',
                '    14      7   9 0 |',
                '    14      7   9_0 .',
                '    14      7____9 .',
                '    14________16 .',
                '         30',
            ].join('\n'))
            assertEq(trace([]), '')
            assertEq(trace([7]), '7 |\n7')
        },
        // Counting sequences hold `1` to `n`; the shuffle's order is a
        // function of the seed, so a shared link draws the same tree.
        sequences: () => {
            assertEq(n, 30)
            /** @type {readonly number[]} */
            const up = Array.from({ length: n }, (_, i) => i + 1)
            assertStructurallySame(sequence('increasing', 0), up)
            assertStructurallySame(sequence('decreasing', 0), up.toReversed())
            const shuffled = sequence('random', 0)
            assertStructurallySame(shuffled, [11, 25, 18, 19, 16, 20, 23, 27, 13, 9, 21, 17, 3, 5, 1, 24, 26, 29, 22, 28, 7, 12, 6, 14, 10, 2, 4, 8, 30, 15])
            assertStructurallySame(shuffled.toSorted((a, b) => a - b), up)
            const again = sequence('random', 1)
            assertStructurallySame(again.toSorted((a, b) => a - b), up)
            assert(again.some((value, i) => value !== shuffled[i]))
            // the signed sequence is `1` to `n / 2` and their negations, shuffled
            const signed = sequence('signed', 0)
            assertStructurallySame(signed, [11, -14, -9, -8, 13, -13, 9, 3, -3, 5, -1, 1, 7, -2, -5, 12, -7, 6, -11, 14, -4, 10, -15, -10, -12, 2, 4, -6, 8, 15])
            assertStructurallySame(signed.toSorted((a, b) => a - b), [...up.slice(0, n / 2).map(v => -v).toReversed(), ...up.slice(0, n / 2)])
            assert(sequence('signed', 1).some((value, i) => value !== signed[i]))
            // the last line is the sum, whatever the order: `465` for `1` to
            // `n`, `0` where every value has its negation
            for (const [kind, total] of [['increasing', '465'], ['decreasing', '465'], ['random', '465'], ['signed', '0']]) {
                assertEq(trace(sequence(kind, 0)).split('\n').at(-1)?.trim(), total)
            }
        },
        heavyEnds: () => {
            const ones = Array.from({ length: n - 1 }, () => 1)
            for (const [kind, expected, label] of /** @type {const} */ ([
                ['heavy-first', [31, ...ones], '31, 1, …, 1 (|....)'],
                ['heavy-last', [...ones, 31], '1, …, 1, 31 (....|)'],
            ])) {
                assertStructurallySame(sequence(kind, 0), expected)
                assertStructurallySame(sequence(kind, 7), expected)
                assertEq(trace(expected).split('\n').at(-1)?.trim(), '60')
                const state = /** @type {const} */ ({ sequence: kind, seed: 7 })
                const rendered = htmlToString(demo.view(state))
                assert(rendered.includes(`<option value="${kind}" selected="">${label}</option>`))
                assert(rendered.includes('name="shuffle" disabled=""'))
                assert(rendered.includes(`<pre data-code="">${expected.join(' ')}</pre>`))
                const sharing = assertNotNullish(demo.sharing)
                const link = unwrap(encodeQuery(sharing, sharing.read(state)))
                const restored = sharing.restore(unwrap(restoreInputs(sharing, unwrap(decodeQuery(link.slice(0, -5))))))
                assertStructurallySame(restored, state)
            }
        },
        // The select picks the sequence, the button advances the seed, and
        // nothing else changes the state.
        update: () => {
            /** @type {(event: DemoEvent) => (state: typeof demo.init) => typeof demo.init} */
            const step = event => state => unwrap(assertNotNullish(
                runPure(demo.update(state)(event))[0],
                'expected the demo to reach a value without asking for an operation'))
            assertStructurallySame(step({ kind: 'input', name: 'sequence', value: 'decreasing' })(demo.init), { sequence: 'decreasing', seed: 0 })
            assertStructurallySame(step({ kind: 'click', name: 'shuffle' })(demo.init), { sequence: 'random', seed: 1 })
            for (const event of /** @type {readonly DemoEvent[]} */ ([{ kind: 'start' }, { kind: 'input', name: 'other', value: 'decreasing' }, { kind: 'click', name: 'other' }])) {
                assert(step(event)(demo.init) === demo.init)
            }
        },
        view: () => {
            const initial = htmlToString(demo.view(demo.init))
            assert(initial.includes('<option value="random" selected="">shuffled</option>'))
            assert(initial.includes('<button type="button" name="shuffle">Shuffle</button>'))
            assert(initial.includes('<pre data-code="">11 25 18 19 16 20 23 27 13 9 21 17 3 5 1 24 26 29 22 28 7 12 6 14 10 2 4 8 30 15</pre>'))
            assert(initial.includes(`<pre data-code="" data-drawing="">11 |\n11 25 |\n11_25 18\n`))
            assert(initial.endsWith('465</pre></div>'))
            const counting = htmlToString(demo.view({ sequence: 'increasing', seed: 0 }))
            assert(counting.includes('<option value="increasing" selected="">1, 2, …, 30</option>'))
            assert(counting.includes('name="shuffle" disabled=""'))
            assert(counting.includes('<pre data-code="" data-drawing=""> 1 |\n 1  2 |\n 1__2  3\n  3    3 |\n'))
            // with signs, a value weighs its magnitude: `13` arrives over `-8`
            // and `-9`, which does not outweigh it, so `-9` and `-8` merge to
            // `-17`, which then outweighs `11` beneath, and `11` and `-14`
            // merge to `-3`, lighter than either
            const signed = htmlToString(demo.view({ sequence: 'signed', seed: 0 }))
            assert(signed.includes('<option value="signed" selected="">±1, …, ±15, shuffled</option>'))
            assert(signed.includes('<button type="button" name="shuffle">Shuffle</button>'))
            assert(signed.includes('<pre data-code="" data-drawing=""> 11 |\n 11 -14 |\n 11 -14  -9 |\n 11 -14  -9  -8 |\n 11 -14  -9__-8  13\n 11_-14   -17    13\n   -3_____-17    13\n      -20        13 |\n'))
            assert(signed.endsWith('0</pre></div>'))
            // the drawing is an output box, whose rule wraps a long line; the
            // drawing's rule comes after it in the stylesheet, so it wins the
            // cascade at the same specificity and the rows keep their columns
            const box = stylesheet.indexOf('[data-code], [data-result] {')
            const drawing = stylesheet.indexOf('[data-drawing] {')
            assert(box >= 0 && drawing > box)
            assert(stylesheet.slice(drawing).startsWith('[data-drawing] { overflow-wrap: normal; overflow-x: auto; white-space: pre }'))
        },
        // The inputs a link carries are the sequence and the seed; a kind the
        // select does not offer is refused.
        sharing: () => {
            const sharing = assertNotNullish(demo.sharing)
            assertEq(unwrap(encodeQuery(sharing, sharing.read(demo.init))), '#demo')
            const link = unwrap(encodeQuery(sharing, sharing.read({ sequence: 'decreasing', seed: 3 })))
            assertEq(link, '?seed=3&sequence=decreasing#demo')
            const restored = sharing.restore(unwrap(restoreInputs(sharing, unwrap(decodeQuery(link.slice(0, -5))))))
            assertStructurallySame(restored, { sequence: 'decreasing', seed: 3 })
            assertEq(restoreInputs(sharing, unwrap(decodeQuery('?sequence=sorted')))[0], 'error')
        },
    },
}
