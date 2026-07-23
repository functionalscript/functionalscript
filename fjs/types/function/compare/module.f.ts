/**
 * Comparison function types and helpers.
 *
 * @module
 */
import type { Index3, Index5, Array2 } from '../../array/module.f.ts'

export type Sign = -1|0|1

export type Compare<T> = (_: T) => Sign

export type Cmp<T> = (a: T) => Compare<T>

export const index3: <T>(cmp: Compare<T>) => (value: T) => Index3
    = cmp => value => (cmp(value) + 1) as Index3

export const index5
    : <T>(cmp: Compare<T>) => (v2: Array2<T>) => Index5
    = cmp => ([v0, v1]) => {
        const _0 = cmp(v0)
        return (_0 <= 0 ? _0 + 1 : cmp(v1) + 3) as Index5
    }

export type Cmp1 = boolean | string | number | bigint

export type Cmp2<A, B> =
    [A, B] extends [boolean, boolean] ? boolean :
    [A, B] extends [string, string] ? string :
    [A, B] extends [number, number] ? number :
    [A, B] extends [bigint, bigint] ? bigint :
    never

export const cmp = <A extends Cmp1>(a: A) => <B extends Cmp2<A, B>>(b: B): Sign =>
    a as any < b ? -1 : a as any > b ? 1 : 0

/**
 * Returns the smaller of two comparable values. The `Cmp2<A, B>` constraint
 * is the same one `cmp` uses: it rejects calls that mix incompatible primitive
 * types (e.g. `min(1)("a")`) at compile time.
 */
export const min = <A extends Cmp1>(a: A) => <B extends Cmp2<A, B>>(b: B): A | B =>
    cmp(a)(b) < 0 ? a : b

/**
 * Returns the larger of two comparable values. The `Cmp2<A, B>` constraint
 * is the same one `cmp` uses: it rejects calls that mix incompatible primitive
 * types (e.g. `max(1)("a")`) at compile time.
 */
export const max = <A extends Cmp1>(a: A) => <B extends Cmp2<A, B>>(b: B): A | B =>
    cmp(a)(b) > 0 ? a : b

/**
 * Binary search over `[0, len)`. `probe(mid)` returns the sign of the search
 * key relative to the element at `mid` (`-1` before, `0` at, `1` after). On a
 * hit it returns the matching index; on a miss it returns the converged lower
 * bound `b` (the insertion point), which may equal `len`.
 *
 * `probe` must be monotonic over `[0, len)`: scanning indices left to right its
 * result is non-increasing — a run of `1`s, then `0`s, then `-1`s. A
 * non-monotonic probe yields an undefined position.
 */
export const bsearch
    = (len: number) => (probe: (mid: number) => Sign): number => {
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
