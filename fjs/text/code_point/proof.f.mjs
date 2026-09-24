import {
    assertEq,
    assertNotNullish,
    assertStructurallySame,
} from '../../asserts/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import {
    bmpMax,
    eofFlush,
    isBmpCodePoint,
    isHighSurrogate,
    isLowSurrogate,
    isSupplementaryPlane,
    isTextCodePoint,
    isValidCodePoint,
    tryFromSurrogatePair,
    tryToSurrogatePair,
} from './module.f.mjs'

/**
 * A stand-in for a codec's state-to-error function.
 *
 * @type {(state: number) => number}
 */
const negate = state => -state

const flush = eofFlush(negate)

export const proof = {
    eofFlush: [
        // no leftover state: nothing is flushed, the state stays empty
        () => {
            const [out, next] = flush(null)
            assertEq(toArray(out).length, 0)
            assertEq(next, null)
        },
        // leftover state: exactly one error unit, then the state resets
        () => {
            const [out, next] = flush(42)
            const [first, ...rest] = toArray(out)
            assertEq(first, -42)
            assertEq(rest.length, 0)
            assertEq(next, null)
        },
    ],
    isHighSurrogate: [
        () => assertEq(isHighSurrogate(0xd800), true),
        () => assertEq(isHighSurrogate(0xdbff), true),
        () => assertEq(isHighSurrogate(0xd7ff), false),
        () => assertEq(isHighSurrogate(0xdc00), false),
    ],
    isLowSurrogate: [
        () => assertEq(isLowSurrogate(0xdc00), true),
        () => assertEq(isLowSurrogate(0xdfff), true),
        () => assertEq(isLowSurrogate(0xdbff), false),
        () => assertEq(isLowSurrogate(0xe000), false),
    ],
    isBmpCodePoint: [
        // lowBmp branch true
        () => assertEq(isBmpCodePoint(0x0000), true),
        () => assertEq(isBmpCodePoint(0xd7ff), true),
        // lowBmp false, highBmp true
        () => assertEq(isBmpCodePoint(0xe000), true),
        () => assertEq(isBmpCodePoint(0xffff), true),
        // both false: surrogate and supplementary
        () => assertEq(isBmpCodePoint(0xd800), false),
        () => assertEq(isBmpCodePoint(0x10000), false),
    ],
    bmpMax: [
        // The exported boundary and the predicates derived from it must agree:
        // `bmpMax` is the last BMP code point, and the next one starts the
        // supplementary planes. This is the pairing the UTF-8 encoder relies
        // on to split its 3-byte and 4-byte forms.
        () => assertEq(isBmpCodePoint(bmpMax), true),
        () => assertEq(isSupplementaryPlane(bmpMax), false),
        () => assertEq(isSupplementaryPlane(bmpMax + 1), true),
        () => assertEq(isBmpCodePoint(bmpMax + 1), false),
    ],
    isSupplementaryPlane: [
        () => assertEq(isSupplementaryPlane(0x10000), true),
        () => assertEq(isSupplementaryPlane(0x10ffff), true),
        () => assertEq(isSupplementaryPlane(0xffff), false),
        () => assertEq(isSupplementaryPlane(0x110000), false),
    ],
    tryToSurrogatePair: [
        // the first, a middle, and the last supplementary code point
        () => assertStructurallySame(tryToSurrogatePair(0x10000), [0xd800, 0xdc00]),
        () => assertStructurallySame(tryToSurrogatePair(0x1f600), [0xd83d, 0xde00]),
        () => assertStructurallySame(tryToSurrogatePair(0x10ffff), [0xdbff, 0xdfff]),
        // outside the supplementary planes: refused
        () => assertEq(tryToSurrogatePair(0xffff), null),
        () => assertEq(tryToSurrogatePair(0x110000), null),
        () => assertEq(tryToSurrogatePair(-1), null),
    ],
    tryFromSurrogatePair: [
        () => assertEq(tryFromSurrogatePair(0xd800, 0xdc00), 0x10000),
        () => assertEq(tryFromSurrogatePair(0xd83d, 0xde00), 0x1f600),
        () => assertEq(tryFromSurrogatePair(0xdbff, 0xdfff), 0x10ffff),
        // `high` is not a high surrogate: refused
        () => assertEq(tryFromSurrogatePair(0xdc00, 0xdc00), null),
        () => assertEq(tryFromSurrogatePair(0xd7ff, 0xdc00), null),
        // `low` is not a low surrogate: refused
        () => assertEq(tryFromSurrogatePair(0xd800, 0xe000), null),
        () => assertEq(tryFromSurrogatePair(0xd800, 0xd800), null),
    ],
    surrogatePairRoundTrip: () => {
        // Each half of a pair is a surrogate of its kind, and the two
        // functions invert each other across the supplementary planes.
        /** @type {(cp: number) => void} */
        const roundTrip = cp => {
            const [high, low] = assertNotNullish(tryToSurrogatePair(cp))
            assertEq(isHighSurrogate(high), true)
            assertEq(isLowSurrogate(low), true)
            assertEq(tryFromSurrogatePair(high, low), cp)
        }
        roundTrip(0x10000)
        roundTrip(0x103ff)
        roundTrip(0x10400)
        roundTrip(0x1f600)
        roundTrip(0x10fc00)
        roundTrip(0x10ffff)
    },
    isValidCodePoint: [
        // in range, not surrogate
        () => assertEq(isValidCodePoint(0x0000), true),
        () => assertEq(isValidCodePoint(0x10ffff), true),
        // in range, surrogate -> invalid
        () => assertEq(isValidCodePoint(0xd800), false),
        () => assertEq(isValidCodePoint(0xdfff), false),
        // out of range -> validRange short-circuits false
        () => assertEq(isValidCodePoint(-1), false),
        () => assertEq(isValidCodePoint(0x110000), false),
    ],
    isTextCodePoint: [
        // C0 controls are binary...
        () => assertEq(isTextCodePoint(0x00), false), // NUL
        () => assertEq(isTextCodePoint(0x08), false), // BS
        () => assertEq(isTextCodePoint(0x1b), false), // ESC
        () => assertEq(isTextCodePoint(0x1f), false), // US
        // ...except the whitespace block 0x09 - 0x0D
        () => assertEq(isTextCodePoint(0x09), true), // TAB
        () => assertEq(isTextCodePoint(0x0a), true), // LF
        () => assertEq(isTextCodePoint(0x0b), true), // VT
        () => assertEq(isTextCodePoint(0x0c), true), // FF
        () => assertEq(isTextCodePoint(0x0d), true), // CR
        // printable ASCII is text
        () => assertEq(isTextCodePoint(0x20), true), // space
        () => assertEq(isTextCodePoint(0x41), true), // 'A'
        () => assertEq(isTextCodePoint(0x7e), true), // '~'
        // DEL and the C1 controls are binary
        () => assertEq(isTextCodePoint(0x7f), false), // DEL
        () => assertEq(isTextCodePoint(0x80), false), // C1 start
        () => assertEq(isTextCodePoint(0x9f), false), // C1 end
        // above C1 is text again
        () => assertEq(isTextCodePoint(0xa0), true), // NBSP
        () => assertEq(isTextCodePoint(0x10ffff), true),
    ],
}
