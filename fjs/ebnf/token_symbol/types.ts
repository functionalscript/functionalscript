/**
 * Types for encoding multi-character token names as single input symbols.
 *
 * @module
 */

import type { Nullable } from '../../types/nullable/types.ts'

/**
 * A bidirectional map between a fixed alphabet of token names and the
 * symbols reserved for them.
 */
export type Encoding<T extends string> = {
    /**
     * The symbol standing for `name`: what a tokenizer emits for the token,
     * and, since a number is a rule of one symbol, the terminal a grammar
     * over the tokens names it by — the same value in both places.
     */
    readonly encode: (name: T) => number
    /**
     * The name a symbol stands for, or `null` when the symbol belongs to no
     * registered name — a code point, the end of input, or a symbol past
     * the end of the alphabet.
     */
    readonly decode: (symbol: number) => Nullable<T>
}
