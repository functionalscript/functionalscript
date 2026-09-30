/**
 * Dotted version numbers, such as `26.1.0` or `v26.1.0` (the form Node's
 * `process.version` prints), compared by their numbers rather than as text.
 *
 * **Numbers, not text.** `0.11.10` comes before `0.11.2` as text and after it
 * as a version, so a comparison has to split the parts and compare them as
 * numbers.
 *
 * **A missing part is zero.** `0.11` equals `0.11.0`, so versions with
 * different numbers of parts still compare, and `cmp` answers `0` for them
 * instead of ordering them by length.
 *
 * @module
 *
 * @example
 *
 * ```js
 * import { cmp, parse } from './module.f.mjs'
 *
 * parse('v26.1.0') // [26, 1, 0]
 * cmp('0.11.2')('0.11.10') // -1
 * ```
 *
 * @import { Sign } from '../function/compare/types.ts'
 */

import { cmp as numberCmp } from '../number/module.f.mjs'

/**
 * A version as its numbers, ignoring a leading `v`.
 *
 * @type {(version: string) => readonly number[]}
 */
export const parse = version =>
    (version.startsWith('v') ? version.slice(1) : version).split('.').map(Number)

/**
 * Compares two versions part by part. A part that one version lacks counts
 * as zero.
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
