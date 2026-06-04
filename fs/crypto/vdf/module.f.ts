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
import { modSqrt, prime_field, type PrimeField } from '../../types/prime_field/module.f.ts'
import type { Nullable } from '../../types/nullable/module.f.ts'
import type { Unary } from '../../types/bigint/module.f.ts'

/** Sloth VDF modulus (3072-bit safe prime, same as reference implementations). */
export const p =
    0xf2346eae06a23388_2814ff16f6a076d3_b8f2161c5c92171c_0b7b84eed4e9475b_cce0c13bde34512a_fdf90f41ab9b86dc_f834f85e04b27fad_ee712eed23a1d4e5_8cd1b09d9bfb1069_6d614f119179a40c_49dc8762edc29e81_15263913237e1471_8cbcd4dc6b35bace_13f8cdb1b5156c50_c47b4aaee0820c87_4e2864cb854367c3n

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
    const { neg, pow2, reduce, quadRes } = field
    const root = modSqrt(field)

    const squareLoop = (steps: bigint) => (value: bigint): bigint =>
        repeatSeq(steps)(pow2)(reduce(value))

    const modSqrtLoop = (steps: bigint) => (value: bigint): bigint =>
        repeatSeq(steps)(root)(reduce(value))

    const evalSteps = (steps: bigint) => (x: bigint): Nullable<bigint> =>
        steps < 0n ? null : modSqrtLoop(steps)(x)

    const verifySteps = (steps: bigint) => (x: bigint) => (y: bigint): boolean => {
        if (steps < 0n) {
            return false
        }
        const input = reduce(x)
        const squared = squareLoop(steps)(y)
        const value = quadRes(squared) ? squared : neg(squared)
        return input === value || neg(input) === value
    }

    return {
        p: modulus,
        quadRes,
        modSqrt: root,
        eval: evalSteps,
        verify: verifySteps,
    }
}

/** Sloth VDF over {@link p}. */
export const sloth = sloth_vdf(p)
