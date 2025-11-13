import {
    toCodePointList,
    fromCodePointList,
    stringToList,
    listToString,
    stringToCodePointList,
    codePointListToString
} from './module.f.ts'
import { stringify as jsonStringify, type Unknown } from '../../json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'

const stringify = (a: readonly Unknown[]) =>
    jsonStringify(sort)(a)

export default {
    toCodePointList: [
        () => {
            const result = stringify(toArray(toCodePointList([-1, 65536])))
            if (result !== '[4294967295,4294967295]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([0, 36, 8364, 55295, 57344, 65535])))
            if (result !== '[0,36,8364,55295,57344,65535]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([56320, 57343])))
            if (result !== '[-2147427328,-2147426305]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([55296, 56320, 55297, 56375, 55378, 57186, 56319, 57343])))
            if (result !== '[65536,66615,150370,1114111]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([55296, 55296])))
            if (result !== '[-2147428352,-2147428352]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([55296, 0])))
            if (result !== '[-2147428352,0]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([56320])))
            if (result !== '[-2147427328]') { throw result }
        },
        () => {
            const result = stringify(toArray(toCodePointList([56320, 0])))
            if (result !== '[-2147427328,0]') { throw result }
        }
    ],
    fromCodePointList: [
        () => {
            const result = stringify(toArray(fromCodePointList([0])))
            if (result !== '[0]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x24])))
            if (result !== '[36]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x20AC])))
            if (result !== '[8364]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0xd7ff])))
            if (result !== '[55295]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0xe000])))
            if (result !== '[57344]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0xffff])))
            if (result !== '[65535]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x10000])))
            if (result !== '[55296,56320]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x10437])))
            if (result !== '[55297,56375]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x24B62])))
            if (result !== '[55378,57186]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([0x10ffff])))
            if (result !== '[56319,57343]') { throw result }
        },
        () => {
            const result = stringify(toArray(fromCodePointList([-1, 0xd800, 0xdfff, 0x110000])))
            if (result !== '[65535,55296,57343,0]') { throw result }
        }
    ],
    string: [
        () => {
            const utf16List = stringToList("Hello world!😂🚜🚲")
            const result = listToString(utf16List)
            if (result !== "Hello world!😂🚜🚲") { throw result }
        },
        () => {
            const cpList = stringToCodePointList("Hello world!😂🚜🚲")
            const result = codePointListToString(cpList)
            if (result !== "Hello world!😂🚜🚲") { throw result }
        },
        () => {
            const a = stringToList("Hello world!😂🚜🚲")
            const b = toCodePointList(a)
            const c = fromCodePointList(b)
            const result = listToString(c)
            if (result !== "Hello world!😂🚜🚲") { throw result }
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
