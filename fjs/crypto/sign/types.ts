/**
 * Type-level API for signing helpers built on secp256k1 and SHA-256 primitives.
 *
 * @module
 */

import type { FixedArray } from '../../types/array/types.ts'
import type { Vec } from '../../types/bit_vec/types.ts'
import type { Curve } from '../secp/types.ts'

/** The RFC 6979 conversions, derived from the subgroup order `q` alone. */
export type Rfc6979 = {
    readonly q: bigint
    readonly qlen: bigint
    readonly bits2int: (b: Vec) => bigint
    /** `bits2int` followed by RFC 6979's extra modular reduction. */
    readonly bits2intModQ: (b: Vec) => bigint
    readonly int2octets: (x: bigint) => Vec
    readonly bits2octets: (b: Vec) => Vec
}

/** Everything `sign` needs from a curve: its RFC 6979 conversions and the curve parts it uses. */
export type Signer = {
    readonly rfc6979: Rfc6979
    readonly nf: Curve['nf']
    readonly mul: Curve['mul']
    readonly g: Curve['g']
}

/** An ECDSA signature: the `(r, s)` pair. */
export type _Signature = FixedArray<2, bigint>
