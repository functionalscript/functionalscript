/**
 * Type-level API for signing helpers built on secp256k1 and SHA-256 primitives.
 *
 * @module
 */

import type { FixedArray } from '../../types/array/types.ts'
import type { Vec } from '../../types/bit_vec/types.ts'

export type All = {
    readonly q: bigint
    readonly qlen: bigint
    readonly bits2int: (b: Vec) => bigint
    readonly int2octets: (x: bigint) => Vec
    readonly bits2octets: (b: Vec) => Vec
}

/** An ECDSA signature: the `(r, s)` pair. */
export type _Signature = FixedArray<2, bigint>
