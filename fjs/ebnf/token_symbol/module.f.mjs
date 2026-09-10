/**
 * Encoding of multi-character token names as single input symbols.
 *
 * A parser built over a tokenizer consumes one symbol per token, so a
 * multi-character operator (`>>>=`) and a keyword (`instanceof`) each need
 * a symbol of their own. Names are registered as one fixed alphabet and
 * take a symbol from their position in it, above the Unicode range, so a
 * token symbol is never mistaken for a code point of the layer below. A
 * number is a rule of one symbol in the EBNF front end, so the symbol a
 * tokenizer emits is the terminal the grammar above names it by, with no
 * wrapping between the two.
 *
 * Every list holds: a symbol is a non-negative safe integer, and no array
 * is long enough to carry the alphabet past that ceiling, so there is no
 * capacity to check. See `./README.md` for why the alphabet is registered
 * and positional, and `./types.ts` for `Encoding<T>`.
 *
 * @module
 *
 * @import { Encoding } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { fromUndefined } from '../../types/nullable/module.f.mjs'

/**
 * The symbol of the first registered name: `0x110000`, one past the last
 * Unicode scalar value, so a token symbol can never be mistaken for a code
 * point of the layer below.
 *
 * @type {number}
 */
export const start = 0x110000

/**
 * Builds an encoding over the complete list of token names.
 *
 * A name takes the symbol at its index in `names`, so the list is
 * append-only: inserting or reordering names changes the symbols of
 * everything after the edit.
 *
 * @throws When a name repeats — a repeated name has no single symbol to
 * decode back to.
 *
 * @type {<T extends string>(names: readonly T[]) => Encoding<T>}
 */
export const encoding = names => {
    assert(new Set(names).size === names.length, ['duplicate token name', names])
    return {
        encode: name => {
            const index = names.indexOf(name)
            assert(index !== -1, ['unregistered token name', name])
            return start + index
        },
        decode: symbol => fromUndefined(names[symbol - start]),
    }
}
