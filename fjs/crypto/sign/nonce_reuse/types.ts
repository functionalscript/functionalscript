/**
 * Types for the shared-nonce signing and private-key recovery experiment.
 * @module
 */

import type { Result } from '../../../types/result/types.ts'

/** Public scalars for one signature made with the shared nonce. */
export type NonceSignature = {
    readonly h: bigint
    readonly r: bigint
    readonly s: bigint
}

/** Two signatures and the key recovered using their public scalars alone. */
export type ReusedNonce = {
    readonly q: bigint
    readonly key: bigint
    readonly k: bigint
    readonly signatures: readonly [NonceSignature, NonceSignature]
    readonly recovered: Result<bigint, string>
}
