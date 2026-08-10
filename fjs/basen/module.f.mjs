/**
 * Shared bit-codec factory for alphabet-based encodings such as `base64` and
 * `cbase32`.
 *
 * Each call returns the raw `Vec ↔ string` codec parameterised by the chunk
 * width (`bits`) and the alphabet (and an optional input-character
 * normalisation step on the decode side). Padding strategies — RFC 4648 `=`
 * octet-alignment, Crockford-style stop-bit sentinels, etc. — are deliberately
 * out of scope: they vary per format and are handled by the caller around
 * `vecToString` / `stringToVec`.
 *
 * @module
 */

import { msb, lsb, vec, chunkList, unpack } from '../types/bit_vec/module.f.mjs'
/** @import { Vec } from '../types/bit_vec/module.f.mjs' */

import { fold } from '../types/list/module.f.mjs'
/** @import { List } from '../types/list/module.f.mjs' */

import { compose } from '../types/function/module.f.mjs'

/** @import { Nullable } from '../types/nullable/types.ts' */

const { unpackSplit } = msb

const { tryListToVec: reversedListToVec } = lsb

// `chunkList(msb)` doesn't depend on `bits` or `v` — shared across every
// `baseN(...)` codec (base64, cbase32, ...).
const chunkListMsb = chunkList(msb)

/**
 * The encode/decode pair returned by {@link baseN}.
 *
 * @typedef {{
 *  readonly vecToString: (v: Vec) => string
 *  readonly stringToVec: (s: string) => Nullable<Vec>
 * }} BaseN
 */

/**
 * Builds a {@link BaseN} codec for a fixed chunk width and alphabet.
 *
 * @param {bigint} bits The chunk width in bits. `alphabet.length` must equal `2 ** bits`.
 * @param {string} alphabet The character used for each unsigned `bits`-bit value, in
 *   ascending order (index `0` → first character).
 * @param {undefined | ((c: string) => string)} normalize Optional pre-lookup transform applied to each input
 *   character on decode — e.g. Crockford base32 lowercases and folds
 *   `i`/`l`→`1`, `o`→`0`.
 * @return {BaseN}
 */
export const baseN = (
    bits,
    alphabet,
    normalize = undefined,
) => {
    const vecN = vec(bits)
    const toIndex = normalize === undefined
        ? (/** @type {string} */c) => alphabet.indexOf(c)
        : (/** @type {string} */c) => alphabet.indexOf(normalize(c))
    const unpackSplitBits = unpackSplit(bits)
    // Converts one `<= bits`-wide chunk (as yielded by `chunkList`, already
    // masked to its own length) to its alphabet index. A trailing partial
    // chunk shorter than `bits` is left-padded with zeros: `unpackSplit`'s
    // shift amount goes negative, which per spec becomes a left shift.
    /** @type {(chunk: Vec) => number} */
    const chunkToIndex = chunk => {
        const u = unpack(chunk)
        return Number(u.length < bits ? unpackSplitBits(u)[0] : u.uint)
    }
    // Folds directly over `chunkList`'s lazy list in one pass — faster than
    // `map` into a second lazy list before joining, since there's no second
    // list to allocate/traverse.
    /** @type {(chunk: Vec) => (acc: string) => string} */
    const chunkToString = chunk => acc =>
        acc + alphabet[chunkToIndex(chunk)]
    return {
        // `chunkListMsb(bits)` then `fold(chunkToString)('')` — neither half
        // depends on `v`, so `compose` builds (and this closure captures)
        // the composed function once per `baseN(...)` codec; no need to name
        // the halves separately just to get that one-time build.
        vecToString: compose(chunkListMsb(bits))(fold(chunkToString)('')),
        stringToVec: s => {
            // Build a reversed chunk list, bailing out at the first invalid
            // character so malformed input is rejected in O(prefix) time and
            // `normalize` is never run past it. `listToVec` then concatenates in
            // O(n log n).
            /** @type {List<Vec>} */
            let chunks = null
            for (const c of s) {
                const index = toIndex(c)
                if (index < 0) { return null }
                chunks = { first: vecN(BigInt(index)), tail: chunks }
            }
            return reversedListToVec(chunks)
        },
    }
}
