/**
 * Executable model of H2b comparison-narrowing: the interval lattice and
 * the transfer table from
 * [comparison-refinement.md](../../../../doc/sasha-gil/ir/comparison-refinement.md).
 * The [checker](../module.f.js) uses {@link compared} for branch refinement;
 * proofs here pin the lattice and table so the shipped behaviour stays
 * checkable against the note, without redesigning H2b.
 *
 * - **Lattice.** `⊥` is `null`. `int(a, b) ⊑ int(c, d)` iff `c ≤ a` and
 *   `b ≤ d`. Join is the convex hull; meet is intersection (empty → `⊥`).
 * - **Transfer.** `compared(op, holds, A, B)` is the note's table for
 *   `lt` / `le` / `eq` and both outcomes. Each result is a sound
 *   over-approximation of the pairs with that outcome.
 *
 * @module
 *
 * @import { Int } from '../../types.ts'
 * @import { CompareOp, Range } from './types.ts'
 */

import { equal, int } from '../../module.f.js'

/** @type {(xs: readonly bigint[]) => bigint} */
const least = xs => xs.reduce((a, b) => a < b ? a : b)

/** @type {(xs: readonly bigint[]) => bigint} */
const greatest = xs => xs.reduce((a, b) => a > b ? a : b)

/**
 * The closed interval `int(lo, hi)`, or `⊥` where `lo > hi`.
 *
 * @type {(lo: bigint, hi: bigint) => Range}
 */
export const range = (lo, hi) => lo <= hi ? int(lo, hi) : null

/**
 * Whether every value of `a` is a value of `b` (lattice inclusion).
 * `⊥ ⊑ R` for every range `R`.
 *
 * @type {(a: Range, b: Range) => boolean}
 */
export const sub = (a, b) => a === null || (b !== null && b[1] <= a[1] && a[2] <= b[2])

/**
 * Least upper bound by inclusion: the convex hull of two non-empty ranges,
 * and `⊥` with anything is the other side.
 *
 * @type {(a: Range, b: Range) => Range}
 */
export const join = (a, b) => a === null ? b
    : b === null ? a
    : int(a[1] < b[1] ? a[1] : b[1], a[2] > b[2] ? a[2] : b[2])

/**
 * Meet: intersection; empty intersection is `⊥`.
 *
 * @type {(a: Range, b: Range) => Range}
 */
export const meet = (a, b) => a === null || b === null ? null
    : range(greatest([a[1], b[1]]), least([a[2], b[2]]))

/**
 * `lo` to `hi` without `c` where `c` is an end of that interval
 * (false-`eq` end-only removal).
 *
 * @type {(lo: bigint, hi: bigint, c: bigint | null) => Range}
 */
const apart = (lo, hi, c) => range(lo === c ? lo + 1n : lo, hi === c ? hi - 1n : hi)

/**
 * The ranges of two integers `a` and `b` where `op(a, b)` is `holds`, each
 * `⊥` where none is left — the note's transfer table.
 *
 * @type {(op: CompareOp, holds: boolean, a: Int, b: Int) => readonly [Range, Range]}
 */
export const compared = (op, holds, [, al, ah], [, bl, bh]) => {
    switch (op) {
        case 'lt': {
            return holds
                ? [range(al, least([ah, bh - 1n])), range(greatest([bl, al + 1n]), bh)]
                : [range(greatest([al, bl]), ah), range(bl, least([bh, ah]))]
        }
        case 'le': {
            return holds
                ? [range(al, least([ah, bh])), range(greatest([bl, al]), bh)]
                : [range(greatest([al, bl + 1n]), ah), range(bl, least([bh, ah - 1n]))]
        }
        default: {
            const both = meet(int(al, ah), int(bl, bh))
            return holds
                ? [both, both]
                : [apart(al, ah, bl === bh ? bl : null), apart(bl, bh, al === ah ? al : null)]
        }
    }
}

/**
 * Whether two ranges are the same lattice element.
 *
 * @type {(a: Range, b: Range) => boolean}
 */
export const same = (a, b) => a === null ? b === null : b !== null && equal(a, b)
