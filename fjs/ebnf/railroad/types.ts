/**
 * Type-level API for `fjs/ebnf/railroad/module.f.mjs`.
 *
 * @module
 */

import type { Diagram } from '../../website/demo/railroad/types.ts'
import type { RangeSet } from '../../types/range_set/types.ts'

/**
 * What a grammar's symbols are to a reader: the labels a diagram draws its
 * terminals with. A symbol is only a number, and which text it stands for
 * is the alphabet's, not the grammar's — a code point, a token, a byte.
 *
 * - `labels` — a set of ordinary symbols as the pieces it is the choice of,
 *   at least one;
 * - `letter` — the text a symbol adds to a literal when a sequence of such
 *   symbols is drawn as one terminal, as a string of characters is, or
 *   `null` when it is never part of one.
 */
export type Alphabet = {
    readonly labels: (s: RangeSet) => readonly Diagram[]
    readonly letter: (symbol: number) => string | null
}
