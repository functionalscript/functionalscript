import { codePointListToString, stringToCodePointList } from '../text/utf16/module.f.ts'
import { type Array2, isArray2 } from '../types/array/module.f.ts'
import { map, toArray, repeat as listRepeat } from '../types/list/module.f.ts'

// Types

/**
 * A range of symbols. Two 24-bit numbers are stored in one JS number (48 bits).
 *
 * For example: 0xBBBBBB_EEEEEE
 * - 0xBBBBBB is the first symbol (24 bits)
 * - 0xEEEEEE is the last symbol (24 bits)
 */
export type TerminalRange = number

export const fullRange: TerminalRange = 0x000000_FFFFFF

export const eof = 0x110000

/** A sequence of rules. */
export type Sequence = readonly Rule[]

/** A variant */
export type Variant = {
    readonly[k in string]: Rule
}

export type DataRule = Variant | Sequence | TerminalRange | string

export type LazyRule = () => DataRule

export type Rule = DataRule | LazyRule

// Internals:

const { fromEntries, values } = Object

const { fromCodePoint } = String

/**
 * Two 24 bit numbers can be fit into one JS number (53 bit).
 */
const offset = 24

const mask = (1 << offset) - 1

const isValid = (r: number): boolean => r >= 0 && r <= mask

export const max: string = codePointListToString([0x10FFFF])

export const rangeEncode = (a: number, b: number): TerminalRange => {
    if (!isValid(a) || !isValid(b) || a > b) {
        throw `Invalid range ${a} ${b}.`
    }
    return (a << offset) | b
}

export const oneEncode = (a: number): TerminalRange => rangeEncode(a, a)

export const rangeDecode = (r: number): Array2<number> =>
    [r >> offset, r & mask]

const mapOneEncode = map(oneEncode)

export const toSequence = (s: string): readonly TerminalRange[] =>
    toArray(mapOneEncode(stringToCodePointList(s)))

export const str = (s: string): readonly TerminalRange[] | TerminalRange => {
    const x = toSequence(s)
    return x.length === 1 ? x[0] : x
}

const mapEntry = map((v: number) => [fromCodePoint(v), oneEncode(v)])

export const set = (s: string): RangeVariant =>
    fromEntries(toArray(mapEntry(stringToCodePointList(s))))

export const range = (ab: string): TerminalRange => {
    const a = toArray(stringToCodePointList(ab))
    if (!isArray2(a)) {
        throw `Invalid range ${ab}.`
    }
    return rangeEncode(...a)
}

type RangeList = readonly TerminalRange[]

/**
 * A set of terminal ranges compatible with the `Variant` rule.
 */
export type RangeVariant = { readonly [k in string]: TerminalRange }

export const rangeToId = (r: TerminalRange): string => {
    const ab = rangeDecode(r)
    const [a, b] = ab
    const cp = a === b ? [a] : ab
    return fromCodePoint(...cp)
}

const rangeToEntry = (r: TerminalRange): readonly [string, TerminalRange] =>
    [rangeToId(r), r]

const toVariantRangeSet = (r: RangeList): RangeVariant =>
    fromEntries(r.map(rangeToEntry))

const removeOne = (list: RangeList, ab: number): RangeList => {
    const [a, b] = rangeDecode(ab)
    let result: RangeList = []
    for (const ab0 of list) {
        const [a0, b0] = rangeDecode(ab0)
        if (a0 < a) {
            // [a0
            //     ]a
            result = [...result, rangeEncode(a0, Math.min(b0, a - 1))]
        }
        if (b < b0) {
            //    b0]
            // b[
            result = [...result, rangeEncode(Math.max(b + 1, a0), b0)]
        }
    }
    return result
}

export const remove = (range: TerminalRange, v: RangeVariant): RangeVariant => {
    let result: RangeList = [range]
    for (const r of values(v)) {
        result = removeOne(result, r)
    }
    return toVariantRangeSet(result)
}

export const notSet = (s: string): RangeVariant =>
    remove(fullRange, set(s))

export const not = (v: RangeVariant): RangeVariant =>
    remove(fullRange, v)

export type None = readonly[]

export const none: None = []

export type Option<S> = {
    some: S
    none: None
}

export const option = <S extends Rule>(some: S): Option<S> => ({
    some,
    none,
})

export type Repeat0Plus<T> = () => Option<readonly[T, Repeat0Plus<T>]>

/**
 * Repeat zero or more times.
 *
 * https://english.stackexchange.com/questions/506480/single-word-quantifiers-for-zero-or-more-like-cardinalities
 * - zero or more - any, 0Plus
 * - one or more - several, 1Plus
 *
 * Also see: https://arbs.nzcer.org.nz/types-numbers
 */
export const repeat0Plus = <T extends Rule>(some: T): Repeat0Plus<T> => {
    const r = () => option([some, r] as const)
    return r
}

export type Repeat1Plus<T> = readonly[T, Repeat0Plus<T>]

/**
 * Repeat one or more times.
 */
export const repeat1Plus = <T extends Rule>(some: T): Repeat1Plus<T> =>
    [some, repeat0Plus(some)]

export type Join1Plus<T, S> = readonly[T, Repeat0Plus<readonly[S, T]>]

export const join1Plus = <T extends Rule, S extends Rule>(some: T, separator: S): Join1Plus<T, S> =>
    [some, repeat0Plus([separator, some])]

export type Join0Plus<T, S> = Option<readonly[T, Repeat0Plus<readonly[S, T]>]>

export const join0Plus = <T extends Rule, S extends Rule>(some: T, separator: S): Rule =>
    option(join1Plus(some, separator))

export type Repeat<T> = readonly T[]

export const repeat = (n: number) => <T extends Rule>(some: T): Repeat<T> =>
    toArray(listRepeat(some)(n))

export const isEmpty = (rule: Rule): boolean => {
    const d = typeof rule === 'function' ? rule() : rule
    return d === '' || (d instanceof Array && d.length === 0)
}
