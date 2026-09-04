/**
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 * @import { Rule, Thunk } from '../types.ts'
 * @import { Ast } from '../ast/types.ts'
 * @import { Mapped } from './types.ts'
 */

import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { eof, join, option, range, repeatFrom1, times } from '../module.f.mjs'
import { rewrite } from './module.f.mjs'

/** @type {(a: string) => number} */
const c = a => a.codePointAt(0) ?? 0

/**
 * The AST of a string rule: its code points.
 *
 * @type {(s: string) => readonly number[]}
 */
const cps = s => [...s].map(c)

/** Nothing mapped: the rewrite is the identity on every form. */
const none = rewrite([])

// A list of integers, `[-12,3]`: the 207 example grammar in EBNF, where a
// repetition is one form rather than a right-recursive variant.

const digit = range('09')

const digits = repeatFrom1(digit)

const sign = option('-')

const int = /**@type {const}*/([sign, digits])

const items = join(',')(int)

const list = /**@type {const}*/(['[', items, ']'])

/**
 * Every rule the author holds is mapped to the value it denotes, so the
 * list's rewrite is the integers. `items` is `join`'s option over an item
 * and a repetition of separator-item pairs; the pairs are built inside
 * `join` and held by nobody, so `items` reads them as they are, each a
 * comma's code points beside an already-rewritten integer.
 */
const integers = rewrite([
    [digit, /** @type {(d: number) => number} */ (d => d - c('0'))],
    [digits, /** @type {(ds: readonly [number, ...(readonly number[])]) => number} */
        (ds => ds.reduce((n, d) => n * 10 + d, 0))],
    [sign, /** @type {(s: readonly [] | readonly [readonly number[]]) => 1 | -1} */
        (s => s.length === 0 ? 1 : -1)],
    [int, /** @type {(v: readonly [1 | -1, number]) => number} */ (([s, n]) => s * n)],
    [list, /** @type {(v: readonly [readonly number[], readonly [] | readonly [readonly [number, readonly (readonly [readonly number[], number])[]]], readonly number[]]) => readonly number[]} */
        (([, o]) => o.length === 0 ? [] : [o[0][0], ...o[0][1].map(([, i]) => i)])],
])

/** @type {Ast<typeof int>} */
const minus12 = [[cps('-')], [c('1'), c('2')]]

/** @type {Ast<typeof int>} */
const three = [[], [c('3')]]

/** @type {Ast<typeof list>} */
const listAst = [cps('['), [[minus12, [[cps(','), three]]]], cps(']')]

/** @type {Ast<typeof list>} */
const emptyListAst = [cps('['), [], cps(']')]

// Values as they arrive from outside the type system, narrowed only at the
// call that must refuse them.

/** @type {unknown} */
const notARule = true

/** @type {unknown} */
const sparse = [, 'x']

/** @type {unknown} */
const typo = () => ['typo']

const variant = /**@type {const}*/({ a: 'x', b: 42 })

const inner = /**@type {const}*/({ a: 'x' })

/** @type {() => readonly ['const', typeof inner]} */
const outer = () => ['const', inner]

/** @type {Thunk} */
const twoDigits = times(2)(digit)

export const proof = {
    // The example end to end: the tree of a list is rewritten to the list.
    integers: () => {
        const r = integers(list)
        /** @typedef {Assert<Equal<ReturnType<typeof r>, readonly number[]>>} _Result */
        /** @typedef {Assert<Equal<Parameters<typeof r>[0], Ast<typeof list>>>} _Input */
        assertStructurallySame(r(listAst), [-12, 3])
        assertStructurallySame(r(emptyListAst), [])
        // Any held rule is an entry point, and its rewrite is the same.
        assertEq(integers(int)(minus12), -12)
        assertEq(integers(digit)(c('7')), 7)
    },
    // The law: with nothing mapped, every form rewrites to itself.
    identity: () => {
        assertStructurallySame(none(list)(listAst), listAst)
        assertStructurallySame(none(eof)([]), [])
        assertEq(none(42)(42), 42)
        assertStructurallySame(none('ab')(cps('ab')), cps('ab'))
        assertStructurallySame(none('')([]), [])
        assertStructurallySame(none(variant)(['b', 42]), ['b', 42])
        assertEq(none(digit)(c('5')), c('5'))
        assertStructurallySame(none(twoDigits)([c('1'), c('2')]), [c('1'), c('2')])
    },
    // EOF has no leaf, so a mapping of it receives the empty node.
    eof: () => {
        const r = rewrite([[eof, /** @type {(v: readonly []) => string} */ (() => 'end')]])(eof)
        assertEq(r([]), 'end')
    },
    // A number is a rule by value, so mapping it maps every occurrence — a
    // tuple naming it twice rewrites both.
    number: () => {
        const r = rewrite([[42, /** @type {(n: 42) => number} */ (n => n + 1)]])
        assertEq(r(42)(42), 43)
        assertStructurallySame(r(/**@type {const}*/([42, 42]))([42, 42]), [43, 43])
    },
    // A string is one rule, and its code points are what its mapping sees.
    string: () => {
        const r = rewrite([['ab', /** @type {(v: readonly number[]) => string} */ (v => String.fromCodePoint(...v))]])
        assertEq(r('ab')(cps('ab')), 'ab')
    },
    // A variant's mapping receives the tag and the branch's rewrite; a
    // numeric key arrives as the string it is at runtime.
    variant: () => {
        const r = rewrite([
            [42, /** @type {(n: 42) => string} */ (() => 'answer')],
            [variant, /** @type {(v: readonly ['a', readonly number[]] | readonly ['b', string]) => string} */ (([tag]) => tag)],
        ])
        assertEq(r(variant)(['a', cps('x')]), 'a')
        assertEq(r(variant)(['b', 42]), 'b')
        assertStructurallySame(none({ 0: 'x' })(['0', cps('x')]), ['0', cps('x')])
        assertStructurallySame(none(variant)(['b', 42]), ['b', 42])
        const mappedBranch = rewrite([[42, /** @type {(n: 42) => string} */ (() => 'answer')]])
        assertStructurallySame(mappedBranch(variant)(['b', 42]), ['b', 'answer'])
    },
    // A `const` thunk is the rule its payload spells: the payload's mapping
    // applies first, under the thunk's, so both may be mapped.
    const: () => {
        const r = rewrite([
            [inner, /** @type {(v: readonly ['a', readonly number[]]) => string} */ (([tag]) => tag)],
            [outer, /** @type {(v: string) => string} */ (v => v.toUpperCase())],
        ])
        /** @typedef {Assert<Equal<Mapped<typeof outer, readonly [readonly [typeof inner, (v: readonly ['a', readonly number[]]) => string]]>, string>>} _Payload */
        assertEq(r(outer)(['a', cps('x')]), 'A')
        assertEq(r(inner)(['a', cps('x')]), 'a')
        assertStructurallySame(none(outer)(['a', cps('x')]), ['a', cps('x')])
    },
    // A repetition's mapping receives one rewrite per round; both bounds
    // are honoured, `Infinity` among them.
    repeat: () => {
        const r = rewrite([[digit, /** @type {(d: number) => number} */ (d => d - c('0'))]])
        assertStructurallySame(r(twoDigits)([c('1'), c('2')]), [1, 2])
        assertStructurallySame(r(digits)([c('1'), ...cps('234567890')]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 0])
        assertStructurallySame(r(sign)([]), [])
    },
    // A mapping that returns `undefined` has been applied; it is not the
    // absence of a mapping.
    undefined: () => {
        const r = rewrite([[42, /** @type {(n: 42) => undefined} */ (() => undefined)]])
        assertStructurallySame(r(/**@type {const}*/([42]))([42]), [undefined])
    },
    throw: {
        // One rule, one mapping: a second would silently win or lose.
        duplicate: () => rewrite([
            [digit, /** @type {(d: number) => number} */ (d => d)],
            [digit, /** @type {(d: number) => number} */ (d => d + 1)],
        ]),
        // An AST that is not the rule's is refused where the walk reads it.
        // `Ast<R>` already refuses most of these at compile time, which is
        // what the casts step around: the check here is for a tree that
        // arrives untyped.
        eofLeaf: () => none(eof)(/** @type {any} */ ([c('x')])),
        notTheSymbol: () => none(42)(/** @type {any} */ (43)),
        notANumber: () => none(digit)(/** @type {any} */ ('5')),
        outsideTheSet: () => none(digit)(c('a')),
        notTheString: () => none('ab')(cps('a')),
        tupleArity: () => none(/**@type {const}*/(['x', 'y']))(/** @type {any} */ ([cps('x')])),
        tupleNotAnArray: () => none(/**@type {const}*/(['x']))(/** @type {any} */ (cps('x'))),
        variantArity: () => none(variant)(/** @type {any} */ (['a'])),
        variantTagNotAString: () => none(variant)(/** @type {any} */ ([0, cps('x')])),
        variantBranchMissing: () => none(variant)(/** @type {any} */ (['c', cps('x')])),
        // `{}` inherits a `constructor`; a branch is an own entry only. The
        // empty variant's AST is `never`, so the rule is widened to reach it.
        variantInheritedBranch: () => none(/** @type {Rule} */ ({}))(/** @type {any} */ (['constructor', []])),
        tooFewRounds: () => none(twoDigits)([c('1')]),
        tooManyRounds: () => none(sign)(/** @type {any} */ ([cps('-'), cps('-')])),
        roundsNotAnArray: () => none(twoDigits)(/** @type {any} */ (c('1'))),
        // What is no rule is refused as one: a hole in a tuple, a value
        // outside the union, a thunk with a tag nothing spells.
        hole: () => none(/** @type {Rule} */ (sparse))(/** @type {any} */ ([undefined, cps('x')])),
        notARule: () => none(/** @type {Rule} */ (notARule))(/** @type {any} */ (true)),
        unknownTag: () => none(/** @type {Rule} */ (typo))(/** @type {any} */ (0)),
    },
}
