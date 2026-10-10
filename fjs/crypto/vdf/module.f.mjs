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
 *
 * @import { PrimeField } from '../../types/prime_field/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Unary } from '../../types/bigint/types.ts'
 * @import { Sloth } from './types.ts'
 */

import { iterate } from '../../types/function/module.f.mjs'
import { modSqrt, prime_field } from '../../types/prime_field/module.f.mjs'

/** Sloth VDF modulus (3072-bit safe prime, same as reference implementations). */
export const p =
    0xf234_6eae_06a2_3388_2814_ff16_f6a0_76d3_b8f2_161c_5c92_171c_0b7b_84ee_d4e9_475b_cce0_c13b_de34_512a_fdf9_0f41_ab9b_86dc_f834_f85e_04b2_7fad_ee71_2eed_23a1_d4e5_8cd1_b09d_9bfb_1069_6d61_4f11_9179_a40c_49dc_8762_edc2_9e81_1526_3913_237e_1471_8cbc_d4dc_6b35_bace_13f8_cdb1_b515_6c50_c47b_4aae_e082_0c87_4e28_64cb_8543_67c3n

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

    /**
     * Iterates `op` `steps` times from `value` reduced into the field. `eval`
     * iterates the square root and `verify` the square over one field
     * reduction; only the operator differs. The two are inverse only up to
     * sign: a non-residue's root squares to its negation, which `verify`
     * accounts for.
     *
     * @type {(op: Unary) => (steps: bigint) => (value: bigint) => bigint}
     */
    const loop = op => steps => value =>
        iterate(steps)(reduce(value))(op)

    const squareLoop = loop(pow2)
    const modSqrtLoop = loop(root)

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
