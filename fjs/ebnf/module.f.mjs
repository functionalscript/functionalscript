/**
 * The EBNF front end: the constructors a grammar is written with.
 *
 * A terminal is a set of symbol ranges rather than a single symbol, so the
 * range-set algebra in `types/range_set` is what `set`, `union` and `remove`
 * lift here. Everything else is `repeat` with its bounds fixed. See
 * `./types.ts` for what the constructors build.
 *
 * @module
 *
 * @import { RangeSet } from '../types/range_set/types.ts'
 * @import { StringMap } from '../types/object/types.ts'
 * @import { Info, Set, Rule, Repeat, Option, RepeatFrom, Times } from './types.ts'
 */

import { assert } from "../asserts/module.f.mjs"
import { codePointListToString, stringToCodePointList } from "../text/utf16/module.f.mjs"
import { isFixedArray } from "../types/array/module.f.mjs"
import { toArray } from "../types/list/module.f.mjs"
import { definedEntries } from "../types/object/module.f.mjs"
import { complement, empty, fromRange, intersection, union as setUnion } from "../types/range_set/module.f.mjs"

const { isSafeInteger } = Number
const { fromEntries } = Object

const isFixedArray2 =
    isFixedArray(2)

/**
 * An ordinary symbol is a non-negative safe integer. The ceiling is
 * arithmetic rather than alphabetic: `b + 1` below is exact only for safe
 * integers — `2 ** 53 + 1` is `2 ** 53` — so a boundary outside that range
 * would name a different range than the one asked for.
 *
 * @type {(a: number) => boolean}
 */
const isSymbol = a => isSafeInteger(a) && a >= 0

/**
 * The range `rangeEncode` and `range` both return: one function, so the
 * check is made once, and each export types it as a `Set` carrying its own
 * spelling. What it refuses is documented on `rangeEncode`.
 *
 * @type {(a: number, b: number) => Info<readonly ['set', ...readonly number[]]>}
 */
const rangeInfo = (a, b) => {
    assert(isSymbol(a) && isSymbol(b) && a <= b && isSymbol(b + 1))
    const r = /**@type {const}*/(['set', a, b + 1])
    return () => r
}

/**
 * Encodes a two-symbol string into a terminal range.
 *
 * @throws If `ab` does not contain exactly two unicode code points.
 *
 * @type {<const S extends string>(ab: S) => Set<readonly ['range', S]>}
 */
export const range = ab => {
    const a = toArray(stringToCodePointList(ab))
    assert(isFixedArray2(a))
    return rangeInfo(...a)
}

/**
 * Encodes a closed range of symbols as a terminal, exclusive above.
 *
 * @throws If either endpoint is not an ordinary symbol, if the range runs
 * backwards, or if the exclusive boundary above `b` is not a symbol either —
 * a call site that hands over one of those has made a mistake, and answering
 * it with a plausible range would hide that.
 *
 * @type {<const A extends number, const B extends number>(a: A, b: B) => Set<readonly ['rangeEncode', A, B]>}
 */
export const rangeEncode = rangeInfo

/** @type {(a: Set) => RangeSet} */
const rangeSet = a => {
    const [, ...r] = a()
    return r
}

/**
 * @type {<T>(f: (v: T) => RangeSet) =>
 *  (v: readonly T[]) =>
 *  Info<readonly ['set', ...readonly number[]]>}
 */
const unionX = f => v => {
    const r = /**@type {const}*/([
        'set',
        ...v.map(f).reduce(
            (a, b) => setUnion(a)(b),
            empty)])
    return () => r
}

const setUnionX = unionX(b => fromRange([b, b + 1]))

/** @type {<const S extends string>(a: S) => Set<readonly ['set', S]>} */
export const set = a => setUnionX(toArray(stringToCodePointList(a)))

const infoUnionX = unionX(rangeSet)

/** @type {<const A extends readonly Set[]>(...a: A) => Set<readonly ['union', ...A]>} */
export const union = (...a) => infoUnionX(a)

/**
 * @type {<A extends Set, B extends Set>(a: A, b: B) =>
 *  Set<readonly ['remove', A, B]>}
 */
export const remove = (a, b) => {
    const r = /**@type {const}*/([
        'set',
        ...intersection(rangeSet(a))(complement(rangeSet(b)))])
    return () => r
}
/**
 * `min..max` copies of a rule. A bound is spelled or refused: a literal
 * type says which bound is meant, where `number` — the type `Infinity` has,
 * and the type a bound widens to — would read as unbounded to whatever
 * matches rules by their types (`./map`). So a bound that is not a literal
 * is refused here, and `repeatFrom` spells the unbounded case.
 *
 * @type {<const A extends number, const B extends number>(
 *  a: number extends A ? never : A,
 *  b: number extends B ? never : B) =>
 *  <const R extends Rule>(rule: R) =>
 *  Repeat<A, B, R>}
 */
export const repeat =
    (a, b) => rule => () => ['repeat', a, b, rule]

/**
 * `n` or more copies of a rule: the one repetition whose `max` is
 * `Infinity`, spelled `number` in its type.
 *
 * @type {<const N extends number>(n: number extends N ? never : N) =>
 *  <const R extends Rule>(rule: R) =>
 *  RepeatFrom<N, R>}
 */
export const repeatFrom = n => rule => () => ['repeat', n, Infinity, rule]

export const repeatFrom0 = repeatFrom(0)
export const repeatFrom1 = repeatFrom(1)

/**
 * @type {<const N extends number>(n: number extends N ? never : N) =>
 *  <const R extends Rule>(rule: R) => Times<N, R>}
 */
export const times = n => rule => () => ['repeat', n, n, rule]

/** @type {<const R extends Rule>(rule: R) => Option<R>} */
export const option = rule => () => ['repeat', 0, 1, rule]

/**
 * @type {<const S extends Rule>(s: S) =>
 *  <const R extends Rule>(r: R) =>
 *  Option<readonly[R, RepeatFrom<0, readonly[S, R]>]>}
 */
export const join = s => r => option([r, repeatFrom0([s, r])])

/**
 * The subtree of the words that begin here: each word is the tail left
 * after the characters above, and an empty tail marks a word that ends
 * here. At least one word, and no word twice.
 *
 * @type {(words: readonly (readonly number[])[]) => Rule}
 */
const node = words => {
    /** @type {StringMap<readonly (readonly number[])[]>} */
    const groups = words
        .filter(w => w.length !== 0)
        .reduce(
            /** @type {(m: StringMap<readonly (readonly number[])[]>, w: readonly number[]) => StringMap<readonly (readonly number[])[]>} */
            ((m, [c, ...tail]) => {
                const k = codePointListToString([c])
                return { ...m, [k]: [...(m[k] ?? []), tail] }
            }),
            {})
    // A branch is its character alone where the one word through it ends
    // right there, and the character then the subtree of what goes on.
    const branches = fromEntries(definedEntries(groups).map(([k, tails]) =>
        [k, tails.every(tail => tail.length === 0) ? k : [k, node(tails)]]))
    return words.some(w => w.length === 0) ? option(branches) : branches
}

/**
 * One of the words, the longest that matches: the words as a prefix tree.
 *
 * A variant of the words is not LL(1) where two share a first character —
 * `=`, `==` and `===` begin alike, and one symbol of lookahead cannot pick
 * one — but it can decide whether to go on, so the tree asks that instead:
 * each node is a variant keyed by the next character, optional where a
 * word ends there and longer words continue. An optional round starts
 * whenever the lookahead is in its first set, so a parse reads the longest
 * word, which is what a tokenizer means by maximal munch.
 *
 * What follows the rule in a grammar may not begin with a character that
 * continues a word: `literals(['a', 'ab'])` then `'b'` reads `ab` two
 * ways, and the backend refuses it as the first/follow conflict it is. A
 * one-token grammar has nothing after it, and that is where this belongs.
 *
 * The tree is the words' own structure, so the node a match builds is
 * nested — the word's characters down its branches — and a mapping reads
 * the word back as the symbols under the node, as `lexeme` in
 * `fjs/media/json/parser` does.
 *
 * @throws On no words, on an empty word — a rule that may match nothing
 * decides nothing, and a token is never empty — and on a word spelled
 * twice.
 *
 * @type {(words: readonly string[]) => Rule}
 */
export const literals = words => {
    assert(words.length !== 0)
    assert(words.every(w => w !== ''))
    assert(new Set(words).size === words.length)
    return node(words.map(w => toArray(stringToCodePointList(w))))
}

/**
 * The end of input, as a rule. A grammar that must consume the whole input
 * ends in it: `[value, eof]`.
 *
 * @type {null}
 */
export const eof = null

export const unicodeMax =
    codePointListToString([0x10FFFF])
