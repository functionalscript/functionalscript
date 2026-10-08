/**
 * Dotted version numbers, such as `26.1.0`, compared by their numbers rather
 * than as text. A prefix such as the `v` Node's `process.version` prints is
 * the caller's to remove: a version here is decimal parts and dots, nothing
 * else.
 *
 * **Numbers, not text.** `0.11.10` comes before `0.11.2` as text and after it
 * as a version, so a comparison has to split the parts and compare them as
 * numbers.
 *
 * **A missing part is zero.** `0.11` equals `0.11.0`, so versions with
 * different numbers of parts still compare, and `cmp` answers `0` for them
 * instead of ordering them by length.
 *
 * **A part that is not a number is refused.** `Number('bad')` is `NaN`, and
 * `NaN` is neither less than nor greater than anything, so comparing it would
 * answer "equal" for `1.bad` and `1.2`. {@link tryParse} answers `null`
 * for such a version, and {@link cmp} throws on one.
 *
 * @module
 *
 * @example
 *
 * ```js
 * import { cmp, tryParse } from './module.f.mjs'
 *
 * tryParse('26.1.0') // [26, 1, 0]
 * tryParse('1.bad') // null
 * cmp('0.11.2')('0.11.10') // -1
 * ```
 *
 * @import { Sign } from '../function/compare/types.ts'
 * @import { Nullable } from '../nullable/types.ts'
 */

import { cmp as numberCmp } from '../number/module.f.mjs'
import { digitsValue, one } from '../../text/ascii/module.f.mjs'

const decimalValue = digitsValue(10n)

const maxPart = BigInt(Number.MAX_SAFE_INTEGER)

/**
 * The number one or more decimal digits spell, or `null` where `part` is
 * anything else or spells more than a safe integer. A longer run would
 * round, and two different versions would compare equal.
 *
 * @type {(part: string) => Nullable<number>}
 */
const tryParsePart = part => {
    const n = decimalValue([...part].map(one))
    return n !== null && n <= maxPart ? Number(n) : null
}

/**
 * A version as its numbers, or `null` where any dot-separated part is not a
 * run of decimal digits spelling a safe integer.
 *
 * @type {(version: string) => Nullable<readonly number[]>}
 */
export const tryParse = version => {
    const parts = version.split('.').map(tryParsePart)
    return parts.every(p => p !== null) ? parts : null
}

/** @type {(version: string) => readonly number[]} */
const parse = version => {
    const result = tryParse(version)
    if (result === null) { throw ['not a version', version] }
    return result
}

/**
 * Compares two versions part by part. A part that one version lacks counts
 * as zero.
 *
 * @throws If either argument is not a version {@link tryParse} accepts: the
 * caller validates a version where it enters, and an answer for one that is
 * not would be a plausible wrong order.
 *
 * @type {(a: string) => (b: string) => Sign}
 */
export const cmp = a => b => {
    const [p, q] = [parse(a), parse(b)]
    const n = Math.max(p.length, q.length)
    for (let i = 0; i < n; i++) {
        const s = numberCmp(p[i] ?? 0)(q[i] ?? 0)
        if (s !== 0) { return s }
    }
    return 0
}
