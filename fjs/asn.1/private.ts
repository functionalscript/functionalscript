/**
 * Implementation-private types for ASN.1 tag encoding and the codec table.
 *
 * @module
 */

import type { Vec } from '../types/bit_vec/types.ts'
import type { SupportedRecord } from './types.ts'

/** The top three bits of a tag's first byte: class and constructed flag. */
export type _ClassPc =
    | 0b000_00000n
    | 0b001_00000n
    | 0b010_00000n
    | 0b011_00000n
    | 0b100_00000n
    | 0b101_00000n
    | 0b110_00000n
    | 0b111_00000n

/**
 * Note: the tag number (the second element) can be arbitrarily large,
 * so we can't just use a single byte to represent it.
 */
export type _ParsedTag = readonly [_ClassPc, bigint]

/**
 * Each supported record, keyed by its tag's decimal spelling. A `bigint` is
 * not a property key, so the codec table is keyed by the string.
 */
export type _Records = {
    readonly [R in SupportedRecord as `${R[0]}`]: R
}

/**
 * One row of the codec table per supported tag: the encoder of the record's
 * value, and the decoder of a payload into the whole record.
 */
export type _Codecs = {
    readonly [K in keyof _Records]: {
        readonly encode: (value: _Records[K][1]) => Vec
        readonly decode: (v: Vec) => _Records[K]
    }
}
