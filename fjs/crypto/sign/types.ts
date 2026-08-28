/**
 * Type-level API for signing helpers built on secp256k1 and SHA-256 primitives.
 */

import type { Vec } from '../../types/bit_vec/types.ts'

export type All = {
    readonly q: bigint
    readonly qlen: bigint
    readonly bits2int: (b: Vec) => bigint
    readonly int2octets: (x: bigint) => Vec
    readonly bits2octets: (b: Vec) => Vec
}
