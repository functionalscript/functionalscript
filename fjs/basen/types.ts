/**
 * Types for the shared bit-codec factory.
 */

import type { Vec } from '../types/bit_vec/types.ts'
import type { Nullable } from '../types/nullable/types.ts'

/**
 * The encode/decode pair returned by `baseN` in `./module.f.mjs`.
 */
export type BaseN = {
    readonly vecToString: (v: Vec) => string
    readonly stringToVec: (s: string) => Nullable<Vec>
}
