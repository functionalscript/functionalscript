/**
 * Type-level API for the range-set module.
 *
 * @module
 */

import type { Phantom } from '../phantom/types.ts'

/**
 * A set of integers, as a strictly increasing list of boundaries.
 *
 * Reading from the bottom of the universe the set starts *off*, and each
 * boundary toggles it. **Boundaries are half-open**: a boundary starts the next
 * run, so the closed range `a..b` is `[a, b + 1]`.
 *
 * | set | meaning |
 * |---|---|
 * | `[]` | empty |
 * | `[-Infinity]` | every integer |
 * | `[0]` | every integer from `0` up |
 * | `[-Infinity, 0]` | every integer below `0` |
 * | `[0x30, 0x3A]` | `0..9` |
 * | `[0, 0x110000]` | Unicode |
 *
 * The universe is `-Infinity..Infinity`: the set knows no smallest and no
 * largest symbol, so an alphabet's own bounds stay the alphabet's business —
 * imposed by intersecting with the set that spells them. That is why an
 * odd-length set simply runs to `Infinity`, and why `-Infinity`, the one
 * boundary that is not a symbol, is what a set opens with when it has no
 * bottom.
 *
 * A valid set is strictly increasing, and every boundary is a safe integer
 * except the first, which may also be `-Infinity`. Both halves are what make
 * the spelling canonical — one list per set, so structural equality is set
 * equality: `[5, 5]`, `[0.5]` and a trailing `Infinity` would each be a second
 * spelling of a set that already has one. Every operation assumes that and
 * preserves it; {@link ./module.f.mjs | `rangeSet`} is where it is checked.
 *
 * `Eof` is a phantom, with no runtime representation: it records whether the
 * set contains `-1`, the symbol a grammar spends on end of input, because a
 * consumer that reads a set into a type cannot get that from the boundaries.
 * Every operation computes it, `boolean` meaning "unknown" — see
 * {@link ./module.f.mjs | the module} for the table, and
 * `fjs/bnf/todo/ebnf-range-set.md` for what reads it.
 */
export type RangeSet<Eof extends boolean = boolean> = Phantom<readonly number[], Eof>

/**
 * Three-valued negation. `boolean` is "unknown" and stays unknown, here and in
 * {@link _Or} and {@link _And}: each is a distributive conditional, so a
 * `true | false` operand yields the union of both outcomes.
 */
export type _Not<A extends boolean> = A extends true ? false : true

export type _Or<A extends boolean, B extends boolean> = A extends true ? true : B

export type _And<A extends boolean, B extends boolean> = A extends true ? B : false

/**
 * Whether a set opening at boundary `A` contains `-1`.
 *
 * `-1` itself is the one boundary that decides it alone. A boundary below it
 * leaves the answer to the set's second boundary, and a boundary the caller did
 * not write as a literal says nothing at all; both are unknown, which is the
 * conservative side.
 */
export type _EofOfFirst<A extends number> =
    number extends A ? boolean
    : A extends -1 ? true
    : `${A}` extends `-${string}` ? boolean
    : false

/** {@link _EofOfFirst} of a list's first boundary; an empty list contains nothing. */
export type _EofOfList<S extends readonly number[]> =
    S extends readonly [] ? false
    : S extends readonly [infer A extends number, ...(readonly number[])] ? _EofOfFirst<A>
    : boolean
