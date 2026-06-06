/**
 * Numeric list reductions (`sum`, `min`, `max`), comparison via `cmp`, and
 * `countOnes` for 32-bit population count using SWAR.
 *
 * @module
 */
import { reduce, type List } from '../list/module.f.ts'
import { addition } from '../function/operator/module.f.ts'
import { type Sign, cmp as uCmp, min as uMin, max as uMax } from '../function/compare/module.f.ts'

export const sum: (input: List<number>) => number
    = reduce(addition)(0)

export const min: (input: List<number>) => number | null
    = reduce(uMin<number>)(null)

export const max: (input: List<number>) => number | null
    = reduce(uMax<number>)(null)

export const cmp: (a: number) => (b: number) => Sign
    = uCmp

type MaskOffset = readonly [number, number]

const mo: readonly MaskOffset[] = [
    [0x5555_5555, 1],
    [0x3333_3333, 2],
    [0x0F0F_0F0F, 4],
    [0x00FF_00FF, 8],
    [0x0000_FFFF, 16],
]

/**
 * Count a number of ones in 32 bit number
 */
export const countOnes = (n: number): number => {
    for (const [mask, offset] of mo) {
        n = (n & mask) + ((n >> offset) & mask)
    }
    return n
}
