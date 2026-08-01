/**
 * Comparison function types and helpers.
 *
 * @module
 */

/**
 * @import { Index3, Index5, Array2 } from '../../array/module.f.mjs'
 */

/**
 * @typedef {-1 | 0 | 1} Sign
 */

/**
 * @template T
 * @typedef {(_: T) => Sign} Compare
 */

/**
 * @template T
 * @typedef {(_: T) => Compare<T>} Cmp
 */

/**
 * @type {<T>(cmp: Compare<T>) => (_: T) => Index3}
 */
export const index3 = cmp => value => /** @type {Index3} */(cmp(value) + 1)

/**
 * @type {<T>(cmp: Compare<T>) => (_: Array2<T>) => Index5}
 */
export const index5 = cmp => ([v0, v1]) => {
    const _0 = cmp(v0)
    return /** @type {Index5} */(_0 <= 0 ? _0 + 1 : cmp(v1) + 3)
}

/**
 * @typedef {boolean | string | number | bigint} Cmp1
 */

/**
 * @template A, B
 * @typedef {[A, B] extends [boolean, boolean] ? boolean :
 *  [A, B] extends [string, string] ? string :
 *  [A, B] extends [number, number] ? number :
 *  [A, B] extends [bigint, bigint] ? bigint :
 * never
 * } Cmp2
 */

/**
 * @type {<A extends Cmp1>(a: A) => <B extends Cmp2<A, B>>(b: B) => Sign}
 */
export const cmp = a => b =>
    /** @type {any} */(a) < b ? -1 : /** @type {any} */(a) > b ? 1 : 0

/**
 * Returns the smaller of two comparable values. The `Cmp2<A, B>` constraint
 * is the same one `cmp` uses: it rejects calls that mix incompatible primitive
 * types (e.g. `min(1)("a")`) at compile time.
 *
 * @type {<A extends Cmp1>(a: A) => <B extends Cmp2<A, B>>(b: B) => A | B}
 */
export const min = a => b => cmp(a)(b) < 0 ? a : b

/**
 * Returns the larger of two comparable values. The `Cmp2<A, B>` constraint
 * is the same one `cmp` uses: it rejects calls that mix incompatible primitive
 * types (e.g. `max(1)("a")`) at compile time.
 *
 * @type {<A extends Cmp1>(a: A) => <B extends Cmp2<A, B>>(b: B) => A | B}
 */
export const max = a => b => cmp(a)(b) > 0 ? a : b

/**
 * Binary search over `[0, len)`. `probe(mid)` returns the sign of the search
 * key relative to the element at `mid` (`-1` before, `0` at, `1` after). On a
 * hit it returns the matching index; on a miss it returns the converged lower
 * bound `b` (the insertion point), which may equal `len`.
 *
 * `probe` must be monotonic over `[0, len)`: scanning indices left to right its
 * result is non-increasing — a run of `1`s, then `0`s, then `-1`s. A
 * non-monotonic probe yields an undefined position.
 *
 * @type {(len: number) => (probe: (mid: number) => Sign) => number}
 */
export const bsearch = len => probe => {
    let b = 0
    let e = len - 1
    while (true) {
        if (e < b) { return b }
        const mid = b + (e - b >> 1)
        switch (probe(mid)) {
            case -1: {
                e = mid - 1
                break
            }
            case 0: { return mid }
            case 1: {
                b = mid + 1
                break
            }
        }
    }
}
