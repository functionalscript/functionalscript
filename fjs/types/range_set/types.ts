/**
 * Type-level API for the range-set module.
 *
 * @module
 */

/**
 * A set of numbers, as a strictly increasing list of boundaries.
 *
 * Reading from the bottom of the universe the set starts *off*, and each
 * boundary toggles it. **Boundaries are half-open**: a boundary starts the next
 * run, so a set of two boundaries is the run `[a, b)`.
 *
 * | set | meaning |
 * |---|---|
 * | `[]` | empty |
 * | `[-Infinity]` | every number |
 * | `[0]` | every number from `0` up |
 * | `[-Infinity, 0]` | every number below `0` |
 * | `[0.5, 1.5]` | the numbers `0.5 <= x < 1.5` |
 * | `[0x30, 0x3A]` | the integers `0..9` |
 *
 * The universe is `-Infinity..Infinity`, and a boundary is any number in it —
 * integers are a caller's subject, not this type's. The algebra only ever
 * *compares* boundaries and never adds one, so nothing here knows what the
 * successor of a number is; a consumer whose symbols are integers writes
 * `[a, b + 1]` for the closed range `a..b` itself.
 *
 * A valid set is strictly increasing, with no `NaN` (it has no order), no
 * `Infinity` (the run above it is empty, so `[Infinity]` would be a second
 * spelling of `[]`) and no `-0` (a second spelling of `0`). `-Infinity` needs
 * no rule of its own: strictly increasing already confines it to the first
 * position, where it opens a set at the bottom of the universe.
 *
 * Those rules are what make the spelling canonical — one list per set, so
 * structural equality is set equality. Every operation assumes that and
 * preserves it; {@link ./module.f.mjs | `rangeSet`} is where it is checked.
 */
export type RangeSet = readonly number[]
