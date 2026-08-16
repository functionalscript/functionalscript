/**
 * @import { Unknown } from '../../media/json/types.ts'
 */

import {
    toCodePointList,
    fromCodePointList,
    stringToList,
    listToString,
    stringToCodePointList,
    codePointListToString,
    codePointToString
} from './module.f.mjs'
import { stringify as jsonStringify } from '../../media/json/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { assertEq } from '../../asserts/module.f.mjs'

/** @type {(a: readonly Unknown[]) => string} */
const stringify = a =>
    jsonStringify(sort)(a)

export const proof = {
    toCodePointList: [
        () => {
            const result = stringify(toArray(toCodePointList([-1, 65536])))
            assertEq(result, '[2147483648,2147483648]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([0, 36, 8364, 55295, 57344, 65535])))
            assertEq(result, '[0,36,8364,55295,57344,65535]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([56320, 57343])))
            assertEq(result, '[-2147427328,-2147426305]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([55296, 56320, 55297, 56375, 55378, 57186, 56319, 57343])))
            assertEq(result, '[65536,66615,150370,1114111]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([55296, 55296])))
            assertEq(result, '[-2147428352,-2147428352]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([55296, 0])))
            assertEq(result, '[-2147428352,0]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([56320])))
            assertEq(result, '[-2147427328]')
        },
        () => {
            const result = stringify(toArray(toCodePointList([56320, 0])))
            assertEq(result, '[-2147427328,0]')
        },
        // `U16` is just `number`, so a non-integer in [0x0000, 0xFFFF] is a
        // possible (if malformed) input. It must be rejected as invalid, not
        // misclassified by the surrogate/BMP range checks, which only
        // partition the integers in that range.
        () => {
            const result = stringify(toArray(toCodePointList([56319.5])))
            assertEq(result, '[2147483648]')
        },
        // A non-integer word doesn't disturb a pending high surrogate: it is
        // reported invalid on its own, and the surrogate is still flagged
        // unpaired at EOF.
        () => {
            const result = stringify(toArray(toCodePointList([55296, 56319.5])))
            assertEq(result, '[2147483648,-2147428352]')
        }
    ],
    fromCodePointList: [
        () => {
            const result = stringify(toArray(fromCodePointList([0])))
            assertEq(result, '[0]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x24])))
            assertEq(result, '[36]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x20AC])))
            assertEq(result, '[8364]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0xd7ff])))
            assertEq(result, '[55295]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0xe000])))
            assertEq(result, '[57344]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0xffff])))
            assertEq(result, '[65535]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x10000])))
            assertEq(result, '[55296,56320]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x10437])))
            assertEq(result, '[55297,56375]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x24B62])))
            assertEq(result, '[55378,57186]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x10ffff])))
            assertEq(result, '[56319,57343]')
        },
        () => {
            const result = stringify(toArray(fromCodePointList([-1, 0xd800, 0xdfff, 0x110000])))
            assertEq(result, '[65535,55296,57343,0]')
        }
    ],
    string: [
        () => {
            const utf16List = stringToList("Hello world!😂🚜🚲")
            const result = listToString(utf16List)
            assertEq(result, "Hello world!😂🚜🚲")
        },
        () => {
            const cpList = stringToCodePointList("Hello world!😂🚜🚲")
            const result = codePointListToString(cpList)
            assertEq(result, "Hello world!😂🚜🚲")
        },
        () => {
            const a = stringToList("Hello world!😂🚜🚲")
            const b = toCodePointList(a)
            const c = fromCodePointList(b)
            const result = listToString(c)
            assertEq(result, "Hello world!😂🚜🚲")
        }
    ],
    stringToList: [
        () => {
            const inputString = "Hello, i like js"
            const utf16List = stringToList(inputString)
        },
        () => {
            const inputString = "😇🤬🫥😑🫠"
            const utf16List = stringToList(inputString)
        }
    ],
    listToString: [
        () => {
            const utf16List = [0x0041, 0x0042, 0x0043]
            const outputString = listToString(utf16List)
        }
    ],
    stringToCodePointList: [
        () => {
            const inputString = "Hello, 😀"
            const codePoints = stringToCodePointList(inputString)
        }
    ],
    codePointListToString: [
        () => {
            const codePoints = [0x48, 0x65, 0x6C, 0x6C, 0x6F]
            const outputString = codePointListToString(codePoints)
        }
    ],
    codePointToString: [
        () => { assertEq(codePointToString(0x48), 'H') },
        // supplementary plane: one code point, two code units
        () => { assertEq(codePointToString(0x1f600), '😀') },
        // a surrogate is not a code point; it round-trips as its own code unit
        () => { assertEq(codePointToString(0xd800), '\ud800') },
        // above the maximum code point, the low 16 bits are kept
        () => { assertEq(codePointToString(0x110000), '\u0000') },
    ]
}
