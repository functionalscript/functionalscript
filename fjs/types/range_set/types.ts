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
 * The universe is every integer — the set knows no smallest and no largest
 * symbol, so an alphabet's own bounds stay the alphabet's business. That is why
 * an odd-length set simply runs to `Infinity`, why `-Infinity` is a boundary a
 * set may open with, and why only {@link ./module.f.mjs | `toRangeMap`}, whose
 * entries are bounded above, asks for a maximum.
 *
 * A valid set is strictly increasing, and every boundary is a safe integer
 * except the first, which may also be `-Infinity`. That makes the spelling
 * canonical — one list per set, so structural equality is set equality — and
 * every operation both assumes and preserves it.
 * {@link ./module.f.mjs | `rangeSet`} is where it is checked.
 */
export type RangeSet = readonly number[]
