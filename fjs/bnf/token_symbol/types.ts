/**
 * Types for encoding multi-character token names as single BNF input symbols.
 *
 * @module
 */

import type { Nullable } from '../../types/nullable/types.ts'

/**
 * A bidirectional map between a fixed alphabet of token names and the symbol
 * range reserved for them.
 */
export type Encoding<T extends string> = {
    /**
     * The input symbol standing for `name`.
     *
     * The result is a bare symbol, the form a tokenizer emits. Wrap it in
     * `oneEncode` to use it as a terminal of a grammar rule — a symbol and a
     * `TerminalRange` are both plain numbers, so passing one where the other
     * belongs is not a type error.
     */
    readonly encode: (name: T) => number
    /**
     * The name a symbol stands for, or `null` when the symbol belongs to no
     * registered name — a code point, `eof`, or a symbol past the end of the
     * alphabet.
     */
    readonly decode: (symbol: number) => Nullable<T>
}
