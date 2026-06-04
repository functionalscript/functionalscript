/**
 * Sloth verifiable delay function over a fixed 3072-bit safe prime.
 *
 * @module
 *
 * @example
 *
 * ```ts
 * import { sloth } from './module.f.ts'
 *
 * const steps = 4n
 * const x = 42n
 * const y = sloth.eval(steps)(x)
 * if (y === null || !sloth.verify(steps)(x)(y)) { throw y }
 * ```
 */
import {
    modSqrt,
    prime_field,
    quadRes,
    reduce,
    type PrimeField,
} from '../../types/prime_field/module.f.ts'
import type { Nullable } from '../../types/nullable/module.f.ts'
import type { Unary } from '../../types/bigint/module.f.ts'

const pLimbs = [
    0xf2346eae06a23388n,
    0x2814ff16f6a076d3n,
    0xb8f2161c5c92171cn,
    0x0b7b84eed4e9475bn,
    0xcce0c13bde34512an,
    0xfdf90f41ab9b86dcn,
    0xf834f85e04b27fadn,
    0xee712eed23a1d4e5n,
    0x8cd1b09d9bfb1069n,
    0x6d614f119179a40cn,
    0x49dc8762edc29e81n,
    0x15263913237e1471n,
    0x8cbcd4dc6b35bacen,
    0x13f8cdb1b5156c50n,
    0xc47b4aaee0820c87n,
    0x4e2864cb854367c3n,
] as const

/** Sloth VDF modulus (3072-bit safe prime, same as reference implementations). */
export const p = pLimbs.reduce((v, limb) => (v << 64n) | limb, 0n)

/**
 * Sloth VDF over prime `modulus` (`p ≡ 3 (mod 4)`).
 */
export type Sloth = {
    readonly p: bigint
    readonly quadRes: (x: bigint) => boolean
    readonly modSqrt: (x: bigint) => bigint
    /** Sequential Sloth permutation; `null` when `steps < 0`. */
    readonly eval: (steps: bigint) => (x: bigint) => Nullable<bigint>
    /** Fast verification of {@link Sloth.eval}; `false` when `steps < 0`. */
    readonly verify: (steps: bigint) => (x: bigint) => (y: bigint) => boolean
}

const repeatSeq = (steps: bigint) => (f: Unary) => (value: bigint): bigint => {
    let v = value
    let i = 0n
    while (i < steps) {
        v = f(v)
        i = i + 1n
    }
    return v
}

/**
 * Builds Sloth VDF operations over `modulus`.
 */
export const sloth_vdf = (modulus: bigint): Sloth => {
    const field: PrimeField = prime_field(modulus)
    const { neg, pow2 } = field
    const red = reduce(field)
    const qr = quadRes(field)
    const root = modSqrt(field)

    const squareLoop = (steps: bigint) => (value: bigint): bigint =>
        repeatSeq(steps)(pow2)(red(value))

    const modSqrtLoop = (steps: bigint) => (value: bigint): bigint =>
        repeatSeq(steps)(root)(red(value))

    const evalSteps = (steps: bigint) => (x: bigint): Nullable<bigint> =>
        steps < 0n ? null : modSqrtLoop(steps)(x)

    const verifySteps = (steps: bigint) => (x: bigint) => (y: bigint): boolean => {
        if (steps < 0n) {
            return false
        }
        const input = red(x)
        const squared = squareLoop(steps)(y)
        const value = qr(squared) ? squared : neg(squared)
        return input === value || neg(input) === value
    }

    return {
        p: modulus,
        quadRes: qr,
        modSqrt: root,
        eval: evalSteps,
        verify: verifySteps,
    }
}

/** Sloth VDF over {@link p}. */
export const sloth = sloth_vdf(p)
