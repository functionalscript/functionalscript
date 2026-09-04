/**
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 * @import { Rule, Thunk } from '../types.ts'
 * @import { Ast } from '../ast/types.ts'
 * @import { Mapped, RuleMap } from './types.ts'
 */

import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { eof, join, option, range, rangeEncode, repeat, repeatFrom1, times } from '../module.f.mjs'
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

/** @type {unknown} */
const unsorted = () => ['set', 0, 10, 5]

/** @type {unknown} */
const fractionalBoundary = () => ['set', 0, 0.5]

/** @type {unknown} */
const negativeBoundary = () => ['set', -5, 3]

/** @type {unknown} */
const constTrailing = () => ['const', 42, 'extra']

/** @type {unknown} */
const repeatTrailing = () => ['repeat', 0, 1, 'x', 'extra']

/** @type {unknown} */
const fractionalMax = () => ['repeat', 0, 1.5, 'x']

/** @type {unknown} */
const boundsReversed = () => ['repeat', 3, 2, 'x']

/** @type {unknown} */
const holeThenB = [, c('b')]

const withEnd = /**@type {const}*/({ end: null, x: 'x' })

/** @type {unknown} */
const undefinedBranch = { x: 'x', missing: undefined }

// Two rules that name themselves the same way: one spelling, found by
// coinduction, since comparing what they yield meets the pair again — and
// so two thunks the types may or may not tell apart, refused where one is
// a key and the other is met.
/** @type {Thunk} */
const self1 = () => ['const', { again: self1, x: 'x' }]

/** @type {Thunk} */
const self2 = () => ['const', { again: self2, x: 'x' }]

/** @type {Thunk} */
const selfOther = () => ['const', { again: selfOther, x: 'y' }]


/**
 * The same rule mapped twice, as a map that arrives untyped: `Checked`
 * refuses it at compile time, which is why the value is spelled outside
 * the type system to reach the runtime refusal.
 *
 * @type {RuleMap}
 */
const twice = [
    [digit, /** @type {(d: number) => number} */ (d => d)],
    [digit, /** @type {(d: number) => number} */ (d => d + 1)],
]

const variant = /**@type {const}*/({ a: 'x', b: 42 })

const inner = /**@type {const}*/({ a: 'x' })

/** @type {() => readonly ['const', typeof inner]} */
const outer = () => ['const', inner]

const twoDigits = times(2)(digit)

/** A map with a set key and a repeat key, for the look-alikes below. */
const thunkKeys = rewrite([
    [digit, /** @type {(d: number) => number} */ (d => d - c('0'))],
    [twoDigits, /** @type {(v: readonly [number, number]) => number} */ (([a, b]) => a * 10 + b)],
])

/**
 * A map keyed by a self-naming thunk. Its type is the bare `Thunk`, which
 * says nothing of its parts, so `Checked` refuses it as a key; the value
 * is spelled outside the type system to reach the runtime, which keys a
 * thunk by itself and needs no type.
 */
const selfKeys = rewrite(/** @type {any} */ ([
    [self1, /** @type {(v: unknown) => string} */ (() => 'self')],
]))

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
    // EOF is a branch, though its rule is `null`; a branch explicitly
    // `undefined` is not.
    eofBranch: () => {
        assertStructurallySame(none(withEnd)(['end', []]), ['end', []])
        const r = rewrite([[eof, /** @type {(v: readonly []) => string} */ (() => 'end')]])
        assertStructurallySame(r(withEnd)(['end', []]), ['end', 'end'])
    },
    // A key is the rule as the types see it: a tuple or a variant spelled
    // the same as a key is mapped, one spelled differently is not, whatever
    // the two share, and a thunk is its own key — a rule holding the key's
    // thunk is the key's spelling, one holding another set is not.
    spelling: () => {
        const r = rewrite([
            [/**@type {const}*/(['x', 42, digit]), /** @type {(v: readonly [readonly number[], 42, number]) => string} */ (() => 'triple')],
            [inner, /** @type {(v: readonly ['a', readonly number[]]) => string} */ (() => 'inner')],
        ])
        assertEq(r(/**@type {const}*/(['x', 42, digit]))([cps('x'), 42, c('7')]), 'triple')
        assertStructurallySame(r(/**@type {const}*/(['x', 43, digit]))([cps('x'), 43, c('7')]), [cps('x'), 43, c('7')])
        assertStructurallySame(r(/**@type {const}*/(['x', 42]))([cps('x'), 42]), [cps('x'), 42])
        assertStructurallySame(r(/**@type {const}*/({ 0: 'x', 1: 42, 2: digit }))(['1', 42]), ['1', 42])
        assertStructurallySame(r(/**@type {const}*/(['x', 42, range('az')]))([cps('x'), 42, c('a')]), [cps('x'), 42, c('a')])
        assertEq(r({ a: 'x' })(['a', cps('x')]), 'inner')
        assertStructurallySame(r({ b: 'x' })(['b', cps('x')]), ['b', cps('x')])
        assertStructurallySame(r({ a: 'x', b: 'x' })(['a', cps('x')]), ['a', cps('x')])
        // A thunk that is no look-alike of any key is left as it is.
        assertEq(thunkKeys(range('az'))(c('a')), c('a'))
        assertStructurallySame(selfKeys(selfOther)(['x', cps('y')]), ['x', cps('y')])
        assertEq(selfKeys(self1)(['x', cps('x')]), 'self')
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
        duplicate: () => rewrite(/** @type {any} */ (twice)),
        // An AST that is not the rule's is refused where the walk reads it.
        // `Ast<R>` already refuses most of these at compile time, which is
        // what the casts step around: the check here is for a tree that
        // arrives untyped.
        eofLeaf: () => none(eof)(/** @type {any} */ ([c('x')])),
        notTheSymbol: () => none(42)(/** @type {any} */ (43)),
        notANumber: () => none(digit)(/** @type {any} */ ('5')),
        // A symbol is a non-negative safe integer: a number between two
        // boundaries is not one for being between them.
        fractionalSymbol: () => none(digit)(/** @type {any} */ (c('0') + 0.5)),
        fractionalRule: () => none(/** @type {Rule} */ (48.5))(/** @type {any} */ (48.5)),
        // `-0` is `0`'s second spelling and no symbol, as the lowering says.
        negativeZeroRule: () => none(/** @type {Rule} */ (-0))(/** @type {any} */ (-0)),
        negativeZeroLeaf: () => none(0)(/** @type {any} */ (-0)),
        // A lone surrogate is no string of symbols, as the lowering says.
        malformedString: () => none(/** @type {Rule} */ ('\uD800'))(/** @type {any} */ ([])),
        outsideTheSet: () => none(digit)(c('a')),
        notTheString: () => none('ab')(cps('a')),
        // A hole is no symbol and no round, however long the list.
        stringHole: () => none('ab')(/** @type {any} */ (holeThenB)),
        roundsHole: () => none(twoDigits)(/** @type {any} */ (holeThenB)),
        tupleArity: () => none(/**@type {const}*/(['x', 'y']))(/** @type {any} */ ([cps('x')])),
        tupleNotAnArray: () => none(/**@type {const}*/(['x']))(/** @type {any} */ (cps('x'))),
        variantArity: () => none(variant)(/** @type {any} */ (['a'])),
        variantTagNotAString: () => none(variant)(/** @type {any} */ ([0, cps('x')])),
        variantBranchMissing: () => none(variant)(/** @type {any} */ (['c', cps('x')])),
        variantBranchUndefined: () => none(/** @type {Rule} */ (undefinedBranch))(/** @type {any} */ (['missing', cps('x')])),
        // A thunk that spells like a key without being it: the types may
        // see one rule or two, so the walk refuses rather than choose. The
        // same set by another constructor, the same set by the same
        // constructor again, a self-naming rule written again, and a tuple
        // holding such a look-alike.
        setByAnotherSpelling: () => thunkKeys(range('09'))(c('7')),
        setSpelledAgain: () => thunkKeys(/** @type {Rule} */ (range('09')))(c('7')),
        setByEncode: () => thunkKeys(/** @type {Rule} */ (rangeEncode(c('0'), c('9'))))(c('7')),
        selfSpelledAgain: () => selfKeys(self2)(['x', cps('x')]),
        repeatSpelledAgain: () => thunkKeys(times(2)(digit))([c('1'), c('2')]),
        // Two keys of one spelling are one key twice.
        spelledTwice: () => rewrite(/** @type {any} */ ([
            [/**@type {const}*/(['x']), /** @type {(v: readonly [readonly number[]]) => string} */ (() => 'a')],
            [/**@type {const}*/(['x']), /** @type {(v: readonly [readonly number[]]) => string} */ (() => 'b')],
        ])),
        // `{}` inherits a `constructor`; a branch is an own entry only. The
        // empty variant's AST is `never`, so the rule is widened to reach it.
        variantInheritedBranch: () => none(/** @type {Rule} */ ({}))(/** @type {any} */ (['constructor', []])),
        tooFewRounds: () => none(twoDigits)(/** @type {any} */ ([c('1')])),
        tooManyRounds: () => none(sign)(/** @type {any} */ ([cps('-'), cps('-')])),
        roundsNotAnArray: () => none(twoDigits)(/** @type {any} */ (c('1'))),
        // What is no rule is refused as one: a hole in a tuple, a value
        // outside the union, a thunk with a tag nothing spells.
        hole: () => none(/** @type {Rule} */ (sparse))(/** @type {any} */ ([undefined, cps('x')])),
        notARule: () => none(/** @type {Rule} */ (notARule))(/** @type {any} */ (true)),
        unknownTag: () => none(/** @type {Rule} */ (typo))(/** @type {any} */ (0)),
        // A set whose boundaries are no range set would answer membership
        // wrong, so it is refused before any symbol is read.
        unsortedSet: () => none(/** @type {Rule} */ (unsorted))(/** @type {any} */ (20)),
        // A boundary is a symbol too: a fractional or negative one would
        // hold the symbols between it and the next.
        fractionalBoundarySet: () => none(/** @type {Rule} */ (fractionalBoundary))(/** @type {any} */ (0)),
        negativeBoundarySet: () => none(/** @type {Rule} */ (negativeBoundary))(/** @type {any} */ (0)),
        // An info's arity is the lowering's: a field past it is refused
        // rather than dropped, since a rule read from part of what it
        // spells is not that rule.
        constTrailingField: () => none(/** @type {Rule} */ (constTrailing))(/** @type {any} */ (42)),
        repeatTrailingField: () => none(/** @type {Rule} */ (repeatTrailing))(/** @type {any} */ ([])),
        // A repetition's bounds are the lowering's too, and `-0` reaches
        // the constructor because `tsc` reads it as the literal `0`.
        negativeZeroMin: () => none(repeat(-0, 1)(42))([]),
        fractionalMaxRepeat: () => none(/** @type {Rule} */ (fractionalMax))(/** @type {any} */ ([])),
        reversedBoundsRepeat: () => none(/** @type {Rule} */ (boundsReversed))(/** @type {any} */ ([])),
    },
}
