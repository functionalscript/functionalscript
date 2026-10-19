/**
 * Types for the Huffman codes of DEFLATE.
 *
 * @module
 */

/**
 * A canonical Huffman code (RFC 1951 section 3.2.2), as `puff` holds one: how
 * many codes there are of each length, and the symbols in code order.
 */
export type Code = {
    /** `count[length]` codes have that many bits; `count[0]` is the symbols with no code. */
    readonly count: readonly number[]
    readonly symbol: readonly number[]
    /** Not every bit string is a code: a lone one-bit code, or none at all. */
    readonly incomplete: boolean
}

/** The two codes a block of codes is read with. */
export type Codes = {
    readonly literals: Code
    readonly distances: Code
}
