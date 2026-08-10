/**
 * Encoding of multi-character token names as single BNF input symbols.
 *
 * A parser built on top of a tokenizer consumes one input symbol per token, so
 * multi-character operators (`>>>=`) and keywords (`instanceof`) each need a
 * symbol of their own. Names are registered as one fixed alphabet and get a
 * symbol from their position in it, above the Unicode range and below `eof`.
 *
 * @module
 */
import { assert } from '../../asserts/module.f.mjs'
import { fromUndefined } from '../../types/nullable/module.f.mjs'
import type { Nullable } from '../../types/nullable/types.js'
import { eof, rangeDecode, unicodeRange } from '../module.f.ts'

const [, unicodeLast] = rangeDecode(unicodeRange)

const [eofSymbol] = rangeDecode(eof)

/**
 * The symbol of the first registered name: `0x110000`, one past the last
 * Unicode scalar value, so a token symbol can never be mistaken for a code
 * point of the layer below.
 */
const start = unicodeLast + 1

/**
 * How many names one encoding holds: every symbol from {@link start} up to but
 * not including `eof` (`0xFFFFFF`, the top of the 24-bit symbol space).
 */
export const capacity: number = eofSymbol - start

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

/**
 * Builds an encoding over the complete list of token names.
 *
 * A name takes the symbol at its index in `names`, so the list is append-only:
 * inserting or reordering names changes the symbols of everything after the
 * edit.
 *
 * @throws When `names` holds more than {@link capacity} entries, or when a name
 * repeats — a repeated name has no single symbol to decode back to.
 */
export const encoding = <T extends string>(names: readonly T[]): Encoding<T> => {
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
