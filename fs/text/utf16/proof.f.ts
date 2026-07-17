import {
    toCodePointList,
    fromCodePointList,
    stringToList,
    listToString,
    stringToCodePointList,
    codePointListToString
} from './module.f.ts'
import { stringify as jsonStringify, type Unknown } from '../../media/json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import { assertEq } from '../../asserts/module.f.ts'

const stringify = (a: readonly Unknown[]) =>
    jsonStringify(sort)(a)

export const proof = {
    toCodePointList: [
        () => {
            const result = stringify(toArray(toCodePointList([-1, 65536])))
            assertEq(result, '[4294967295,4294967295]')
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
    ]
}
