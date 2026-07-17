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
import { assert } from '../../asserts/module.f.ts'

const stringify = (a: readonly Unknown[]) =>
    jsonStringify(sort)(a)

export const proof = {
    toCodePointList: [
        () => {
            const result = stringify(toArray(toCodePointList([-1, 65536])))
            assert(result === '[4294967295,4294967295]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([0, 36, 8364, 55295, 57344, 65535])))
            assert(result === '[0,36,8364,55295,57344,65535]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([56320, 57343])))
            assert(result === '[-2147427328,-2147426305]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([55296, 56320, 55297, 56375, 55378, 57186, 56319, 57343])))
            assert(result === '[65536,66615,150370,1114111]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([55296, 55296])))
            assert(result === '[-2147428352,-2147428352]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([55296, 0])))
            assert(result === '[-2147428352,0]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([56320])))
            assert(result === '[-2147427328]', result)
        },
        () => {
            const result = stringify(toArray(toCodePointList([56320, 0])))
            assert(result === '[-2147427328,0]', result)
        }
    ],
    fromCodePointList: [
        () => {
            const result = stringify(toArray(fromCodePointList([0])))
            assert(result === '[0]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x24])))
            assert(result === '[36]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x20AC])))
            assert(result === '[8364]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0xd7ff])))
            assert(result === '[55295]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0xe000])))
            assert(result === '[57344]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0xffff])))
            assert(result === '[65535]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x10000])))
            assert(result === '[55296,56320]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x10437])))
            assert(result === '[55297,56375]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x24B62])))
            assert(result === '[55378,57186]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x10ffff])))
            assert(result === '[56319,57343]', result)
        },
        () => {
            const result = stringify(toArray(fromCodePointList([-1, 0xd800, 0xdfff, 0x110000])))
            assert(result === '[65535,55296,57343,0]', result)
        }
    ],
    string: [
        () => {
            const utf16List = stringToList("Hello world!😂🚜🚲")
            const result = listToString(utf16List)
            assert(result === "Hello world!😂🚜🚲", result)
        },
        () => {
            const cpList = stringToCodePointList("Hello world!😂🚜🚲")
            const result = codePointListToString(cpList)
            assert(result === "Hello world!😂🚜🚲", result)
        },
        () => {
            const a = stringToList("Hello world!😂🚜🚲")
            const b = toCodePointList(a)
            const c = fromCodePointList(b)
            const result = listToString(c)
            assert(result === "Hello world!😂🚜🚲", result)
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
