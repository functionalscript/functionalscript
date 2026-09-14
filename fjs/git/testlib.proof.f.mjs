/**
 * The proof of [`testlib.f.mjs`](./testlib.f.mjs)'s two functions.
 *
 * Beside the module rather than in a directory of its own, because the module
 * is a bare file: `fjs/git` holds the fixtures every reader here shares, and
 * they are one file rather than one more directory. The `.f.` infix is what
 * loads it, the same as any `proof.f.mjs`.
 *
 * The constants above them are data and prove nothing on their own — what they
 * are is checked wherever they are read, against Git's own answers.
 *
 * @module
 */

import { assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import { hexBytes, latin1 } from './testlib.f.mjs'

export const proof = {
    // The bytes a hex string spells, and the cases a hand-typed fixture gets
    // wrong: a digit dropped, and a letter that is no digit.
    hexBytes: () => {
        assertStructurallySame(hexBytes(''), [])
        assertStructurallySame(hexBytes('00'), [0])
        assertStructurallySame(hexBytes('ff'), [255])
        assertStructurallySame(hexBytes('0f10a5'), [0x0F, 0x10, 0xA5])
        // Upper case reads too, though the fixtures are written lower: the
        // digit rule is `fjs/text/ascii`'s and admits both, and refusing one
        // here would be a rule of this function's own invention.
        assertStructurallySame(hexBytes('FF0A'), [255, 10])
        // a word of a fanout table, which is what these captures mostly are
        assertStructurallySame(hexBytes('000000ff'), [0, 0, 0, 255])
    },
    // One byte per two characters, which is the property the length assertion
    // is for.
    hexBytesLength: () => {
        for (const n of [0, 1, 2, 16, 137]) {
            assertEq(hexBytes('ab'.repeat(n)).length, n)
        }
    },
    // A string's code points, one byte each, which is what the fixtures above
    // `hexBytes` are written as.
    latin1: () => {
        assertStructurallySame(latin1(''), [])
        assertStructurallySame(latin1('PACK'), [0x50, 0x41, 0x43, 0x4B])
        // `\xff` is one byte here and two in UTF-8, which is the whole reason
        // the fixtures are read this way
        assertStructurallySame(latin1('\xFF'), [255])
    },
    throw: {
        // An odd length is a digit dropped while typing a capture, and the
        // bytes it would answer are every byte after the mistake shifted by a
        // nibble — so it is refused rather than read.
        oddLength: () => hexBytes('abc'),
        // And a character that is no hex digit, which `hexDigitValue` answers
        // `null` for: the pair would otherwise read as `NaN`.
        notHex: () => hexBytes('ag'),
        notHexHigh: () => hexBytes('ga'),
        space: () => hexBytes('a '),
    },
}
