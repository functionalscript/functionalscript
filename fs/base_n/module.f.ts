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
import { msb, lsb, type Vec, vec, chunkList, unpack } from '../types/bit_vec/module.f.ts'
import { fold, type List } from '../types/list/module.f.ts'
import type { Nullable } from '../types/nullable/module.f.ts'

const { unpackSplit } = msb

const { tryListToVec: reversedListToVec } = lsb

/**
 * The encode/decode pair returned by {@link baseN}.
 */
export type BaseN = {
    /**
     * Encodes a bit vector by splitting it into `bits`-wide MSB chunks
     * (`chunkList`, a balanced divide-and-conquer split, not a linear scan)
     * and indexing each into the alphabet. A trailing partial chunk shorter
     * than `bits` is left-padded with zeros.
     */
    readonly vecToString: (v: Vec) => string
    /**
     * Decodes a string by mapping each character to its alphabet index and
     * concatenating the resulting `bits`-wide chunks. Returns `null` on the
     * first character that is not in the alphabet (after `normalize`, when
     * provided).
     */
    readonly stringToVec: (s: string) => Nullable<Vec>
}

/**
 * Builds a {@link BaseN} codec for a fixed chunk width and alphabet.
 *
 * @param bits The chunk width in bits. `alphabet.length` must equal `2 ** bits`.
 * @param alphabet The character used for each unsigned `bits`-bit value, in
 *   ascending order (index `0` → first character).
 * @param normalize Optional pre-lookup transform applied to each input
 *   character on decode — e.g. Crockford base32 lowercases and folds
 *   `i`/`l`→`1`, `o`→`0`.
 */
export const baseN = (
    bits: bigint,
    alphabet: string,
    normalize?: (c: string) => string,
): BaseN => {
    const vecN = vec(bits)
    const toIndex = normalize === undefined
        ? (c: string) => alphabet.indexOf(c)
        : (c: string) => alphabet.indexOf(normalize(c))
    const unpackSplitBits = unpackSplit(bits)
    // Converts one `<= bits`-wide chunk (as yielded by `chunkList`, already
    // masked to its own length) to its alphabet index. A trailing partial
    // chunk shorter than `bits` is left-padded with zeros: `unpackSplit`'s
    // shift amount goes negative, which per spec becomes a left shift.
    const chunkToIndex = (chunk: Vec): number => {
        const u = unpack(chunk)
        return Number(u.length < bits ? unpackSplitBits(u)[0] : u.uint)
    }
    // Folds directly over `chunkList`'s lazy list in one pass — faster than
    // `map` into a second lazy list before joining, since there's no second
    // list to allocate/traverse.
    const chunkToString = (chunk: Vec) => (acc: string): string =>
        acc + alphabet[chunkToIndex(chunk)]
    return {
        vecToString: v => fold(chunkToString)('')(chunkList(msb)(bits)(v)),
        stringToVec: s => {
            // Build a reversed chunk list, bailing out at the first invalid
            // character so malformed input is rejected in O(prefix) time and
            // `normalize` is never run past it. `listToVec` then concatenates in
            // O(n log n).
            let chunks: List<Vec> = null
            for (const c of s) {
                const index = toIndex(c)
                if (index < 0) { return null }
                chunks = { first: vecN(BigInt(index)), tail: chunks }
            }
            return reversedListToVec(chunks)
        },
    }
}
