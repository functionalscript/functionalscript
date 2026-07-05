import { toCodePointList, fromCodePointList, fromVec } from './module.f.ts'
import { stringify as jsonStringify } from '../../json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import { msb, u8ListToVec } from '../../types/bit_vec/module.f.ts'

const stringify = jsonStringify(sort)

export const proof = {
    toCodePoint: [
        () => {
            const result = stringify(toArray(toCodePointList([-1, 256])))
            if (result !== '[2147483648,2147483648]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([128, 193, 245, 255])))
            if (result !== '[-2147483520,-2147483455,-2147483403,-2147483393]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([0, 1, 127])))
            if (result !== '[0,1,127]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([194, 128, 194, 169, 223, 191])))
            if (result !== '[128,169,2047]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([194, 194, 127, 194, 192, 194])))
            if (result !== '[-2147483454,-2147483454,127,-2147483454,-2147483456,-2147483454]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([224, 160, 128, 224, 160, 129, 239, 191, 191])))
            if (result !== '[2048,2049,65535]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([224, 224, 160, 127, 239, 191])))
            if (result !== '[-2147483424,-2147482592,127,-2147481601]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([240, 144, 128, 128, 240, 144, 128, 129, 244, 143, 191, 191])))
            if (result !== '[65536,65537,1114111]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([240, 240, 160, 127, 244, 191])))
            if (result !== '[-2147483408,-2147483104,127,-2147482817]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([240, 160, 160, 244, 160, 160])))
            if (result !== '[-2147448800,-2147432416]') { throw result }
        },
        // Overlong 3-byte encodings (E0 80..9F ..) are rejected, not decoded.
        () => {
            const result = stringify(toArray(toCodePointList([224, 128, 128])))
            if (result !== '[-2147483424,-2147483520,-2147483520]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([224, 159, 191])))
            if (result !== '[-2147483424,-2147483489,-2147483457]') { throw result }
        },
        // Overlong 4-byte encodings (F0 80..8F .. ..) are rejected, not decoded.
        () => {
            const result = stringify(toArray(toCodePointList([240, 128, 128, 128])))
            if (result !== '[-2147483408,-2147483520,-2147483520,-2147483520]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([240, 143, 191, 191])))
            if (result !== '[-2147483408,-2147483505,-2147483457,-2147483457]') { throw result }
        },
        // Valid boundary cases still decode: E0 A0 80 -> U+0800, F0 90 80 80 -> U+10000.
        () => {
            const result = stringify(toArray(toCodePointList([224, 160, 128])))
            if (result !== '[2048]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([240, 144, 128, 128])))
            if (result !== '[65536]') { throw result }
        }
    ],
    fromCodePointList: [
        () => {
            const result = stringify(toArray(fromCodePointList([0, 1, 0x7F])))
            if (result !== '[0,1,127]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x80])))
            if (result !== '[194,128]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0xa9])))
            if (result !== '[194,169]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x7ff])))
            if (result !== '[223,191]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x800])))
            if (result !== '[224,160,128]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x801])))
            if (result !== '[224,160,129]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0xffff])))
            if (result !== '[239,191,191]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x10000])))
            if (result !== '[240,144,128,128]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x10001])))
            if (result !== '[240,144,128,129]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x10FFFF])))
            if (result !== '[244,143,191,191]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x110000, 2147483648])))
            if (result !== '[2147483648,2147483648]') { throw result }
        }
    ],
    toFrom: [
        () => {
            const codePointList = toCodePointList([128, 193, 245, 255])
            const result = stringify(toArray(fromCodePointList(codePointList)))
            if (result !== '[128,193,245,255]') { throw result }
        },
        () => {
            const codePointList = toCodePointList([194, 194, 127, 194, 192, 194])
            const result = stringify(toArray(fromCodePointList(codePointList)))
            if (result !== '[194,194,127,194,192,194]') { throw result }
        },
        () => {
            const codePointList = toCodePointList([224, 224, 160, 127, 239, 191])
            const result = stringify(toArray(fromCodePointList(codePointList)))
            if (result !== '[224,224,160,127,239,191]') { throw result }
        },
        () => {
            const codePointList = toCodePointList([240, 240, 160, 127, 244, 191])
            const result = stringify(toArray(fromCodePointList(codePointList)))
            if (result !== '[240,240,160,127,244,191]') { throw result }
        },
        () => {
            const codePointList = toCodePointList([240, 160, 160, 244, 160, 160])
            const result = stringify(toArray(fromCodePointList(codePointList)))
            if (result !== '[240,160,160,244,160,160]') { throw result }
        }
    ],
    fromVec: [
        // Valid ASCII → decoded string
        () => {
            const v = u8ListToVec(msb)([0x68, 0x65, 0x6c, 0x6c, 0x6f]) // "hello"
            if (fromVec(v) !== 'hello') { throw 'expected "hello"' }
        },
        // Valid multi-byte UTF-8 → decoded string (U+00A9 COPYRIGHT SIGN, 2-byte)
        () => {
            const v = u8ListToVec(msb)([0xc2, 0xa9]) // "©"
            if (fromVec(v) !== '©') { throw 'expected copyright sign' }
        },
        // Valid 3-byte UTF-8 (U+4E2D CJK)
        () => {
            const v = u8ListToVec(msb)([0xe4, 0xb8, 0xad]) // "中"
            if (fromVec(v) !== '中') { throw 'expected CJK character' }
        },
        // Valid 4-byte UTF-8 (U+1F600 GRINNING FACE)
        () => {
            const v = u8ListToVec(msb)([0xf0, 0x9f, 0x98, 0x80])
            if (fromVec(v) !== '\u{1f600}') { throw 'expected emoji' }
        },
        // Invalid byte sequence → null
        () => {
            const v = u8ListToVec(msb)([0xff, 0xfe]) // not valid UTF-8
            if (fromVec(v) !== null) { throw 'expected null for invalid UTF-8' }
        },
        // Lone continuation byte → null
        () => {
            const v = u8ListToVec(msb)([0x80])
            if (fromVec(v) !== null) { throw 'expected null for lone continuation byte' }
        },
        // Surrogate half (U+D800, encoded as CESU-8 0xED 0xA0 0x80) → null
        () => {
            const v = u8ListToVec(msb)([0xed, 0xa0, 0x80])
            if (fromVec(v) !== null) { throw 'expected null for surrogate' }
        },
        // Empty Vec → empty string
        () => {
            const v = u8ListToVec(msb)([])
            if (fromVec(v) !== '') { throw 'expected empty string' }
        },
        // Overlong 3-byte encoding (E0 80 80, would decode to U+0000) → null
        () => {
            const v = u8ListToVec(msb)([0xe0, 0x80, 0x80])
            if (fromVec(v) !== null) { throw 'expected null for overlong 3-byte encoding' }
        },
        // Overlong 4-byte encoding (F0 80 80 80, would decode to U+0000) → null
        () => {
            const v = u8ListToVec(msb)([0xf0, 0x80, 0x80, 0x80])
            if (fromVec(v) !== null) { throw 'expected null for overlong 4-byte encoding' }
        },
    ]
}
