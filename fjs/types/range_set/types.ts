/**
 * Type-level API for the range-set module.
 *
 * @module
 */

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
 */
export type RangeSet = readonly number[]
