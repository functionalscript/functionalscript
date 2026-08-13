/**
 * Sloth verifiable delay function over a fixed 3072-bit safe prime.
 *
 * See `./types.ts` for the `Sloth` type-level API.
 *
 * @module
 *
 * @example
 *
 * ```js
 * import { sloth } from './module.f.mjs'
 *
 * const steps = 4n
 * const x = 42n
 * const y = sloth.eval(steps)(x)
 * if (y === null || !sloth.verify(steps)(x)(y)) { throw y }
 * ```
 */

import { modSqrt, prime_field } from '../../types/prime_field/module.f.mjs'
/** @import { PrimeField } from '../../types/prime_field/types.ts' */
/** @import { Nullable } from '../../types/nullable/types.ts' */
/** @import { Unary } from '../../types/bigint/types.ts' */
/** @import { Sloth } from './types.ts' */

/** Sloth VDF modulus (3072-bit safe prime, same as reference implementations). */
export const p =
    0xf2346eae06a23388_2814ff16f6a076d3_b8f2161c5c92171c_0b7b84eed4e9475b_cce0c13bde34512a_fdf90f41ab9b86dc_f834f85e04b27fad_ee712eed23a1d4e5_8cd1b09d9bfb1069_6d614f119179a40c_49dc8762edc29e81_15263913237e1471_8cbcd4dc6b35bace_13f8cdb1b5156c50_c47b4aaee0820c87_4e2864cb854367c3n

/** @type {(steps: bigint) => (f: Unary) => (value: bigint) => bigint} */
const repeatSeq = steps => f => value => {
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
 *
 * @type {(modulus: bigint) => Sloth}
 */
export const sloth_vdf = modulus => {
    /** @type {PrimeField} */
    const field = prime_field(modulus)
    const { neg, pow2, reduce, quadRes } = field
    const root = modSqrt(field)

    /** @type {(steps: bigint) => (value: bigint) => bigint} */
    const squareLoop = steps => value =>
        repeatSeq(steps)(pow2)(reduce(value))

    /** @type {(steps: bigint) => (value: bigint) => bigint} */
    const modSqrtLoop = steps => value =>
        repeatSeq(steps)(root)(reduce(value))

    /** @type {(steps: bigint) => (x: bigint) => Nullable<bigint>} */
    const evalSteps = steps => x =>
        steps < 0n ? null : modSqrtLoop(steps)(x)

    /** @type {(steps: bigint) => (x: bigint) => (y: bigint) => boolean} */
    const verifySteps = steps => x => y => {
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
