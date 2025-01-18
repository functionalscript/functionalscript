import type { Index3, Index5, Array2 } from '../../array/module.f.ts'

export type Sign = -1|0|1

export type Compare<T> = (_: T) => Sign

export const index3: <T>(cmp: Compare<T>) => (value: T) => Index3
    = cmp => value => (cmp(value) + 1) as Index3

export const index5
    : <T>(cmp: Compare<T>) => (v2: Array2<T>) => Index5
    = cmp => ([v0, v1]) => {
        const _0 = cmp(v0)
        return (_0 <= 0 ? _0 + 1 : cmp(v1) + 3) as Index5
    }

export const unsafeCmp: <T>(a: T) => (b: T) => Sign
    = a => b => a < b ? -1 : a > b ? 1 : 0
