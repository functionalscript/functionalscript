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
