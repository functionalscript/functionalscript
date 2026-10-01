/**
 * @import { DemoEvent } from '../../website/demo/types.ts'
 */

import { toCodePointList, fromCodePointList, fromVec, utf8ByteToCodePointOp, vecToCodePointList } from './module.f.mjs'
import { stringify as jsonStringify } from '../../media/json/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { u8ListToVecMsb, vec } from '../../types/bit_vec/module.f.mjs'
import { assert, assertEq, assertNotNullish } from '../../asserts/module.f.mjs'
import { demo, codePoints } from './demo.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'

const stringify = jsonStringify(sort)

export const proof = {
    toCodePoint: [
        () => {
            const result = stringify(toArray(toCodePointList([-1, 256])))
            assertEq(result, '[2147483648,2147483648]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([128, 193, 245, 255])))
            assertEq(result, '[-2147483520,-2147483455,-2147483403,-2147483393]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([0, 1, 127])))
            assertEq(result, '[0,1,127]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([194, 128, 194, 169, 223, 191])))
            assertEq(result, '[128,169,2047]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([194, 194, 127, 194, 192, 194])))
            assertEq(result, '[-2147483454,-2147483454,127,-2147483454,-2147483456,-2147483454]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([224, 160, 128, 224, 160, 129, 239, 191, 191])))
            assertEq(result, '[2048,2049,65535]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([224, 224, 160, 127, 239, 191])))
            assertEq(result, '[-2147483424,-2147482592,127,-2147481601]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([240, 144, 128, 128, 240, 144, 128, 129, 244, 143, 191, 191])))
            assertEq(result, '[65536,65537,1114111]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([240, 240, 160, 127, 244, 191])))
            assertEq(result, '[-2147483408,-2147483104,127,-2147482817]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([240, 160, 160, 244, 160, 160])))
            assertEq(result, '[-2147448800,-2147432416]')
        },
        // Overlong 3-byte encodings (E0 80..9F ..) are rejected, not decoded.
        () => {
            const result = stringify(toArray(toCodePointList([224, 128, 128])))
            assertEq(result, '[-2147483424,-2147483520,-2147483520]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([224, 159, 191])))
            assertEq(result, '[-2147483424,-2147483489,-2147483457]')
        },
        // Overlong 4-byte encodings (F0 80..8F .. ..) are rejected, not decoded.
        () => {
            const result = stringify(toArray(toCodePointList([240, 128, 128, 128])))
            assertEq(result, '[-2147483408,-2147483520,-2147483520,-2147483520]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([240, 143, 191, 191])))
            assertEq(result, '[-2147483408,-2147483505,-2147483457,-2147483457]')
        },
        // Valid boundary cases still decode: E0 A0 80 -> U+0800, F0 90 80 80 -> U+10000.
        () => {
            const result = stringify(toArray(toCodePointList([224, 160, 128])))
            assertEq(result, '[2048]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([240, 144, 128, 128])))
            assertEq(result, '[65536]')
        },
        // A byte stream never accumulates a 2-byte state whose lead is >= F8
        // (isLeadByte caps leads at F4), so this defensive fallthrough is
        // only reachable by calling the scan op directly with such a state.
        () => {
            const result = stringify(utf8ByteToCodePointOp(0x80, [0xf8, 0x80]))
            assertEq(result, '[[-2147483136,-2147483520],null]')
        },
        // `U8` is just `number`, so a non-integer in [0x00, 0xff] is a
        // possible (if malformed) input. The dispatch partitions only the
        // integers in that range, so a fraction has to be rejected here rather
        // than misclassified: below `contTag` it would otherwise be emitted as
        // a code point, and above it tagged with a fractional payload.
        () => {
            const result = stringify(toArray(toCodePointList([1.5])))
            assertEq(result, '[2147483648]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([200.5])))
            assertEq(result, '[2147483648]')
        },
        // `NaN` is flagged either way — the old guard let it past and the
        // payload arithmetic tagged it anyway, as `errorMask | 0`. Pinned for
        // the spelling: rejecting it up front gives the canonical `errorMask`
        // rather than its `| 0` form.
        () => {
            const result = stringify(toArray(toCodePointList([NaN])))
            assertEq(result, '[2147483648]')
        },
        // A fractional continuation byte is the case that hides: the bitwise
        // payload arithmetic truncates it, so `C3 A9.5` decoded as U+00E9 —
        // the same character `C3 A9` spells — with nothing reported. It is now
        // invalid on its own, and the pending lead is flagged incomplete.
        () => {
            const result = stringify(toArray(toCodePointList([0xc3, 0xa9])))
            assertEq(result, '[233]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([0xc3, 169.5])))
            assertEq(result, '[2147483648,-2147483453]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([0xf0, 0x90, 128.5])))
            assertEq(result, '[2147483648,-2147483120]')
        }
    ],
    fromCodePointList: [
        () => {
            const result = stringify(toArray(fromCodePointList([0, 1, 0x7F])))
            assertEq(result, '[0,1,127]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x80])))
            assertEq(result, '[194,128]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0xa9])))
            assertEq(result, '[194,169]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x7ff])))
            assertEq(result, '[223,191]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x800])))
            assertEq(result, '[224,160,128]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x801])))
            assertEq(result, '[224,160,129]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0xffff])))
            assertEq(result, '[239,191,191]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x10000])))
            assertEq(result, '[240,144,128,128]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x10001])))
            assertEq(result, '[240,144,128,129]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x10FFFF])))
            assertEq(result, '[244,143,191,191]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x110000, 2147483648])))
            assertEq(result, '[2147483648,2147483648]')
        }
    ],
    toFrom: [
        () => {
            const codePointList = toCodePointList([128, 193, 245, 255])
            const result = stringify(toArray(fromCodePointList(codePointList)))
            assertEq(result, '[128,193,245,255]')
        },
        () => {
            const codePointList = toCodePointList([194, 194, 127, 194, 192, 194])
            const result = stringify(toArray(fromCodePointList(codePointList)))
            assertEq(result, '[194,194,127,194,192,194]')
        },
        () => {
            const codePointList = toCodePointList([224, 224, 160, 127, 239, 191])
            const result = stringify(toArray(fromCodePointList(codePointList)))
            assertEq(result, '[224,224,160,127,239,191]')
        },
        () => {
            const codePointList = toCodePointList([240, 240, 160, 127, 244, 191])
            const result = stringify(toArray(fromCodePointList(codePointList)))
            assertEq(result, '[240,240,160,127,244,191]')
        },
        () => {
            const codePointList = toCodePointList([240, 160, 160, 244, 160, 160])
            const result = stringify(toArray(fromCodePointList(codePointList)))
            assertEq(result, '[240,160,160,244,160,160]')
        }
    ],
    vecToCodePointList: [
        // Valid bytes → their code points
        () => {
            const v = u8ListToVecMsb([0x68, 0xc2, 0xa9])
            assertEq(stringify(toArray(vecToCodePointList(v))), '[104,169]')
        },
        // Unchecked: a lone continuation byte becomes an error-tagged code point
        () => {
            const v = u8ListToVecMsb([0x80])
            assertEq(stringify(toArray(vecToCodePointList(v))), '[-2147483520]')
        },
        // Unchecked: a surrogate and a value above U+10FFFF come back untagged
        () => {
            const v = u8ListToVecMsb([0xed, 0xa0, 0x80, 0xf4, 0x90, 0x80, 0x80])
            assertEq(stringify(toArray(vecToCodePointList(v))), '[55296,1114112]')
        },
    ],
    fromVec: [
        // Valid ASCII → decoded string
        () => {
            const v = u8ListToVecMsb([0x68, 0x65, 0x6c, 0x6c, 0x6f]) // "hello"
            assertEq(fromVec(v), 'hello', 'expected "hello"')
        },
        // Valid multi-byte UTF-8 → decoded string (U+00A9 COPYRIGHT SIGN, 2-byte)
        () => {
            const v = u8ListToVecMsb([0xc2, 0xa9]) // "©"
            assertEq(fromVec(v), '©', 'expected copyright sign')
        },
        // Valid 3-byte UTF-8 (U+4E2D CJK)
        () => {
            const v = u8ListToVecMsb([0xe4, 0xb8, 0xad]) // "中"
            assertEq(fromVec(v), '中', 'expected CJK character')
        },
        // Valid 4-byte UTF-8 (U+1F600 GRINNING FACE)
        () => {
            const v = u8ListToVecMsb([0xf0, 0x9f, 0x98, 0x80])
            if (fromVec(v) !== '\u{1f600}') { throw 'expected emoji' }
        },
        // Invalid byte sequence → null
        () => {
            const v = u8ListToVecMsb([0xff, 0xfe]) // not valid UTF-8
            assertEq(fromVec(v), null, 'expected null for invalid UTF-8')
        },
        // Lone continuation byte → null
        () => {
            const v = u8ListToVecMsb([0x80])
            assertEq(fromVec(v), null, 'expected null for lone continuation byte')
        },
        // Surrogate half (U+D800, encoded as CESU-8 0xED 0xA0 0x80) → null
        () => {
            const v = u8ListToVecMsb([0xed, 0xa0, 0x80])
            assertEq(fromVec(v), null, 'expected null for surrogate')
        },
        // Empty Vec → empty string
        () => {
            const v = u8ListToVecMsb([])
            assertEq(fromVec(v), '', 'expected empty string')
        },
        // Overlong 3-byte encoding (E0 80 80, would decode to U+0000) → null
        () => {
            const v = u8ListToVecMsb([0xe0, 0x80, 0x80])
            assertEq(fromVec(v), null, 'expected null for overlong 3-byte encoding')
        },
        // Overlong 4-byte encoding (F0 80 80 80, would decode to U+0000) → null
        () => {
            const v = u8ListToVecMsb([0xf0, 0x80, 0x80, 0x80])
            assertEq(fromVec(v), null, 'expected null for overlong 4-byte encoding')
        },
        // Vec length not a multiple of 8 bits → null
        () => {
            const v = vec(4n)(0n)
            assertEq(fromVec(v), null)
        },
    ],
    demo: {
        /**
         * **The bytes the demo shows are this module's own.** Pinned here so
         * a change to the encoder, or to the way the demo prints it, lands on
         * a test rather than only on a page nobody is looking at. The
         * expected bytes are what `printf '%s' 'hé€😀' | od -An -tx1` prints.
         */
        codePoints: () => {
            assertEq(codePoints(''), '')
            assertEq(codePoints('hé€😀'), [
                'U+0068   68',
                'U+00E9   c3 a9',
                'U+20AC   e2 82 ac',
                'U+1F600  f0 9f 98 80',
            ].join('\n'))
        },
        /**
         * **An unpaired surrogate is refused, not encoded.** No UTF-8
         * sequence encodes one, so its line names it and says so; the code
         * points around it are unaffected.
         */
        unpairedSurrogate: () => {
            assertEq(codePoints('a\uD800b'), [
                'U+0061   61',
                'U+D800   error: unpaired surrogate, no UTF-8',
                'U+0062   62',
            ].join('\n'))
            assertEq(codePoints('\uDC00'), 'U+DC00   error: unpaired surrogate, no UTF-8')
        },
        // Typing replaces the text; every other event leaves it alone.
        update: () => {
            /** @type {(event: DemoEvent) => (state: string) => string} */
            const step = event => state => unwrap(assertNotNullish(
                runPure(demo.update(state)(event))[0],
                'expected the demo to reach a value without asking for an operation'))
            assertEq(step({ kind: 'input', name: 'text', value: 'a' })(''), 'a')
            assertEq(step({ kind: 'start' })('kept'), 'kept')
        },
        view: () => {
            const html = htmlToString(demo.view(demo.init))
            assert(html.includes('name="text"'), html)
            assert(html.includes(codePoints(demo.init)), html)
        },
    },
}
