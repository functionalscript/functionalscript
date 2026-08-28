/**
 * Implementation-private types for ASN.1 tag encoding.
 *
 * @module
 */

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
