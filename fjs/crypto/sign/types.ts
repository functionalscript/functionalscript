/**
 * Type-level API for signing helpers built on secp256k1 and SHA-256 primitives.
 *
 * @module
 */

import type { FixedArray } from '../../types/array/types.ts'
import type { Vec } from '../../types/bit_vec/types.ts'
import type { Curve, Point, Point2D } from '../secp/types.ts'
import type { Sha2 } from '../sha2/types.ts'

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

/**
 * Alice's editable signing inputs. Keys are hexadecimal; algorithm names
 * come from the demo's selectors. This private draft is never transmitted.
 */
export type DemoDraft = {
    readonly curve: string
    readonly hash: string
    readonly key: string
    readonly message: string
}

/** Public packet sent at a button press; no private key or nonce. */
export type DemoPacket = {
    readonly curve: string
    readonly hash: string
    readonly message: string
    readonly u: Point2D
    readonly r: bigint
    readonly s: bigint
}

export type DemoAttack = 'Modify message' | 'Modify signature' | 'Replace public key'

/** Eve's edits, always based on the untouched intercepted public packet. */
export type DemoIntercepted = {
    readonly original: DemoPacket
    readonly attack: DemoAttack
    readonly message: string
    readonly r: string
    readonly s: string
    readonly key: string
}

/** Bob's last delivery and the actual verification results computed then. */
export type DemoReceived = {
    readonly packet: DemoPacket
    readonly trusted: Point2D
    readonly attack: DemoAttack
    readonly valid: boolean
    readonly receivedValid: boolean | null
}

/** Independent Alice draft, Eve workspace and Bob delivery snapshots. */
export type DemoState = DemoDraft & {
    readonly eve: DemoIntercepted | null
    readonly bob: DemoReceived | null
}

/**
 * A named curve as the demo binds it once: its signer, verifier and nonce
 * generator, and the hexadecimal widths of its scalars and coordinates.
 */
export type DemoCurve = {
    readonly name: string
    readonly curve: Curve
    readonly sign: (hf: Sha2) => (x: bigint) => (m: Vec) => _Signature
    readonly verify: (hf: Sha2) => (u: Point) => (m: Vec) => (sig: _Signature) => boolean
    readonly computeK: (hf: Sha2) => (x: bigint) => (m: Vec) => bigint
    readonly q: bigint
    readonly scalarDigits: number
    readonly coordinateDigits: number
}

/** What the demo's Sign half derives: the public key, the message's bits, `k`, and `(r, s)`. */
export type DemoSigned = {
    readonly u: Point2D
    readonly m: Vec
    readonly k: bigint
    readonly r: bigint
    readonly s: bigint
}
