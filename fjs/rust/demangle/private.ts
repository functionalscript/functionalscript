/**
 * The demangler's own types.
 *
 * @module
 */

/**
 * What a reader produced and the offset it stopped at, or `null` where the
 * symbol does not follow the grammar.
 */
export type _Read<T> = readonly [T, number] | null

/** A path reader tied to one symbol's source. */
export type _PathReader = (i: number, inValue: boolean, bound: number, depth: number) => _Read<string>

/** A type reader tied to one symbol's source. */
export type _TypeReader = (i: number, bound: number, depth: number) => _Read<string>
