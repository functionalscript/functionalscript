import { toCodePointList, fromCodePointList, fromVec, utf8ByteToCodePointOp } from './module.f.ts'
import { stringify as jsonStringify } from '../../media/json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import { msb, u8ListToVec, vec } from '../../types/bit_vec/module.f.ts'
import { assert, assertEq } from '../../asserts/module.f.ts'

const stringify = jsonStringify(sort)

export const proof = {
    toCodePoint: [
        () => {
            const result = stringify(toArray(toCodePointList([-1, 256])))
            assert(result === '[2147483648,2147483648]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([128, 193, 245, 255])))
            assert(result === '[-2147483520,-2147483455,-2147483403,-2147483393]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([0, 1, 127])))
            assert(result === '[0,1,127]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([194, 128, 194, 169, 223, 191])))
            assert(result === '[128,169,2047]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([194, 194, 127, 194, 192, 194])))
            assert(result === '[-2147483454,-2147483454,127,-2147483454,-2147483456,-2147483454]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([224, 160, 128, 224, 160, 129, 239, 191, 191])))
            assert(result === '[2048,2049,65535]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([224, 224, 160, 127, 239, 191])))
            assert(result === '[-2147483424,-2147482592,127,-2147481601]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([240, 144, 128, 128, 240, 144, 128, 129, 244, 143, 191, 191])))
            assert(result === '[65536,65537,1114111]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([240, 240, 160, 127, 244, 191])))
            assert(result === '[-2147483408,-2147483104,127,-2147482817]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([240, 160, 160, 244, 160, 160])))
            assert(result === '[-2147448800,-2147432416]', result)
        },
        // Overlong 3-byte encodings (E0 80..9F ..) are rejected, not decoded.
        () => {
            const result = stringify(toArray(toCodePointList([224, 128, 128])))
            assert(result === '[-2147483424,-2147483520,-2147483520]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([224, 159, 191])))
            assert(result === '[-2147483424,-2147483489,-2147483457]', result)
        },
        // Overlong 4-byte encodings (F0 80..8F .. ..) are rejected, not decoded.
        () => {
            const result = stringify(toArray(toCodePointList([240, 128, 128, 128])))
            assert(result === '[-2147483408,-2147483520,-2147483520,-2147483520]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([240, 143, 191, 191])))
            assert(result === '[-2147483408,-2147483505,-2147483457,-2147483457]', result)
        },
        // Valid boundary cases still decode: E0 A0 80 -> U+0800, F0 90 80 80 -> U+10000.
        () => {
            const result = stringify(toArray(toCodePointList([224, 160, 128])))
            assert(result === '[2048]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([240, 144, 128, 128])))
            assert(result === '[65536]', result)
        },
        // A byte stream never accumulates a 2-byte state whose lead is >= F8
        // (isLeadByte caps leads at F4), so this defensive fallthrough is
        // only reachable by calling the scan op directly with such a state.
        () => {
            const result = stringify(utf8ByteToCodePointOp(0x80, [0xf8, 0x80]))
            assert(result === '[[-2147483136,-2147483520],null]', result)
        }
    ],
    fromCodePointList: [
        () => {
            const result = stringify(toArray(fromCodePointList([0, 1, 0x7F])))
            assert(result === '[0,1,127]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x80])))
            assert(result === '[194,128]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0xa9])))
            assert(result === '[194,169]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x7ff])))
            assert(result === '[223,191]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x800])))
            assert(result === '[224,160,128]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x801])))
            assert(result === '[224,160,129]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0xffff])))
            assert(result === '[239,191,191]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x10000])))
            assert(result === '[240,144,128,128]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x10001])))
            assert(result === '[240,144,128,129]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x10FFFF])))
            assert(result === '[244,143,191,191]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x110000, 2147483648])))
            assert(result === '[2147483648,2147483648]', result)
        }
    ],
    toFrom: [
        () => {
            const codePointList = toCodePointList([128, 193, 245, 255])
            const result = stringify(toArray(fromCodePointList(codePointList)))
            assert(result === '[128,193,245,255]', result)
        },
        () => {
            const codePointList = toCodePointList([194, 194, 127, 194, 192, 194])
            const result = stringify(toArray(fromCodePointList(codePointList)))
            assert(result === '[194,194,127,194,192,194]', result)
        },
        () => {
            const codePointList = toCodePointList([224, 224, 160, 127, 239, 191])
            const result = stringify(toArray(fromCodePointList(codePointList)))
            assert(result === '[224,224,160,127,239,191]', result)
        },
        () => {
            const codePointList = toCodePointList([240, 240, 160, 127, 244, 191])
            const result = stringify(toArray(fromCodePointList(codePointList)))
            assert(result === '[240,240,160,127,244,191]', result)
        },
        () => {
            const codePointList = toCodePointList([240, 160, 160, 244, 160, 160])
            const result = stringify(toArray(fromCodePointList(codePointList)))
            assert(result === '[240,160,160,244,160,160]', result)
        }
    ],
    fromVec: [
        // Valid ASCII → decoded string
        () => {
            const v = u8ListToVec(msb)([0x68, 0x65, 0x6c, 0x6c, 0x6f]) // "hello"
            assert(fromVec(v) === 'hello', 'expected "hello"')
        },
        // Valid multi-byte UTF-8 → decoded string (U+00A9 COPYRIGHT SIGN, 2-byte)
        () => {
            const v = u8ListToVec(msb)([0xc2, 0xa9]) // "©"
            assert(fromVec(v) === '©', 'expected copyright sign')
        },
        // Valid 3-byte UTF-8 (U+4E2D CJK)
        () => {
            const v = u8ListToVec(msb)([0xe4, 0xb8, 0xad]) // "中"
            assert(fromVec(v) === '中', 'expected CJK character')
        },
        // Valid 4-byte UTF-8 (U+1F600 GRINNING FACE)
        () => {
            const v = u8ListToVec(msb)([0xf0, 0x9f, 0x98, 0x80])
            if (fromVec(v) !== '\u{1f600}') { throw 'expected emoji' }
        },
        // Invalid byte sequence → null
        () => {
            const v = u8ListToVec(msb)([0xff, 0xfe]) // not valid UTF-8
            assert(fromVec(v) === null, 'expected null for invalid UTF-8')
        },
        // Lone continuation byte → null
        () => {
            const v = u8ListToVec(msb)([0x80])
            assert(fromVec(v) === null, 'expected null for lone continuation byte')
        },
        // Surrogate half (U+D800, encoded as CESU-8 0xED 0xA0 0x80) → null
        () => {
            const v = u8ListToVec(msb)([0xed, 0xa0, 0x80])
            assert(fromVec(v) === null, 'expected null for surrogate')
        },
        // Empty Vec → empty string
        () => {
            const v = u8ListToVec(msb)([])
            assert(fromVec(v) === '', 'expected empty string')
        },
        // Overlong 3-byte encoding (E0 80 80, would decode to U+0000) → null
        () => {
            const v = u8ListToVec(msb)([0xe0, 0x80, 0x80])
            assert(fromVec(v) === null, 'expected null for overlong 3-byte encoding')
        },
        // Overlong 4-byte encoding (F0 80 80 80, would decode to U+0000) → null
        () => {
            const v = u8ListToVec(msb)([0xf0, 0x80, 0x80, 0x80])
            assert(fromVec(v) === null, 'expected null for overlong 4-byte encoding')
        },
        // Vec length not a multiple of 8 bits → null
        () => {
            const v = vec(4n)(0n)
            assertEq(fromVec(v), null)
        },
    ]
}
