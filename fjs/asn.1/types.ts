/**
 * Types for ASN.1 BER/DER encoding and decoding over bit vectors.
 */

import type { Vec } from '../types/bit_vec/types.ts'
import type {
    boolean as booleanTag,
    constructedSequence,
    constructedSet,
    integer,
    objectIdentifier,
    octetString,
} from './module.f.mjs'

/**
 * ASN.1 tag number.
 */
export type _Tag = bigint

/**
 * Raw ASN.1 TLV tuple.
 */
export type Raw = readonly [_Tag, Vec]

/**
 * ASN.1 OBJECT IDENTIFIER components.
 */
export type ObjectIdentifier = readonly bigint[]

/**
 * ASN.1 ordered collection of records.
 */
export type Sequence = readonly Record[]

/**
 * ASN.1 SET represented as a sequence of records.
 */
export type Set = Sequence

/**
 * Supported ASN.1 record variants.
 */
export type SupportedRecord =
    | readonly [typeof booleanTag, boolean]
    | readonly [typeof integer, bigint]
    | readonly [typeof octetString, Vec]
    | readonly [typeof objectIdentifier, ObjectIdentifier]
    | readonly [typeof constructedSequence, Sequence]
    | readonly [typeof constructedSet, Set]

// Alternative:
//
// export type SupportedRecord =
//     | boolean
//     | bigint                                                    // integer
//     | { tag: typeof octetString, value: Vec }
//     | { tag: typeof objectIdentifier, value: ObjectIdentifier }
//     | readonly Record[]                                         // sequence
//     | { tag: typeof constructedSet, value: readonly Record[] }
//
// export type UnsupportedRecord =
//     | { tag: null, value: Vec }

/**
 * For unsupported tags, we just store the raw value including the tag and
 * length, so that it can be re-encoded without loss of information.
 */
export type UnsupportedRecord = Vec

export type Record = SupportedRecord | UnsupportedRecord
