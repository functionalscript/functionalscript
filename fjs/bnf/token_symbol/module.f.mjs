/**
 * Encoding of multi-character token names as single BNF input symbols.
 *
 * A parser built on top of a tokenizer consumes one input symbol per token, so
 * multi-character operators (`>>>=`) and keywords (`instanceof`) each need a
 * symbol of their own. Names are registered as one fixed alphabet and get a
 * symbol from their position in it, above the Unicode range and up to the last
 * ordinary symbol.
 *
 * See `./types.ts` for the `Encoding<T>` type-level API.
 *
 * @module
 *
 * @import { Encoding } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { fromUndefined } from '../../types/nullable/module.f.mjs'
import { fullRange, rangeDecode, unicodeRange } from '../module.f.mjs'

const [, unicodeLast] = rangeDecode(unicodeRange)

const [, lastOrdinary] = rangeDecode(fullRange)

/**
 * The symbol of the first registered name: `0x110000`, one past the last
 * Unicode scalar value, so a token symbol can never be mistaken for a code
 * point of the layer below.
 */
const start = unicodeLast + 1

/**
 * How many names one encoding holds: every symbol from {@link start} up to and
 * including the last ordinary symbol (`0xFFFFFE`, the top of `fullRange`).
 *
 * @type {number}
 */
export const capacity = lastOrdinary - start + 1

/**
 * Builds an encoding over the complete list of token names.
 *
 * A name takes the symbol at its index in `names`, so the list is append-only:
 * inserting or reordering names changes the symbols of everything after the
 * edit.
 *
 * @throws When `names` holds more than {@link capacity} entries, or when a name
 * repeats — a repeated name has no single symbol to decode back to.
 *
 * @type {<T extends string>(names: readonly T[]) => Encoding<T>}
 */
export const encoding = names => {
    assert(names.length <= capacity, ['too many token names', names.length])
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
