/**
 * Implementation-private types for the base-N demo.
 *
 * @module
 */

/**
 * How an encoding cuts bits into groups: the group width, how many groups a
 * number of bits makes, and the fill bits that complete a short last group.
 */
export type _Scheme = {
    readonly width: number
    readonly count: (n: number) => number
    readonly fill: (k: number) => string
}

/**
 * One encoding of a text: the groups its bits are cut into, each with any fill
 * bits after a `·`, and the codec's own output, one character per group plus
 * any `=` padding.
 */
export type _Encoding = {
    readonly groups: readonly string[]
    readonly encoded: string
}

/** What the demo shows for a text: its UTF-8 bytes in binary, and both encodings. */
export type _Encodings = {
    readonly bytes: readonly string[]
    readonly base64: _Encoding
    readonly cBase32: _Encoding
}
