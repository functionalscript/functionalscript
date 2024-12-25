import * as encoding from './module.f.ts'
import * as json from '../../json/module.f.ts'
import * as o from '../../types/object/module.f.ts'
const { sort } = o
import * as list from '../../types/list/module.f.ts'

const stringify = (a: readonly json.Unknown[]) =>
    json.stringify(sort)(a)

export default {
    toCodePointList: [
        () => {
            const result = stringify(list.toArray(encoding.toCodePointList([-1, 65536])))
            if (result !== '[4294967295,4294967295]') { throw result }
        },
        () => {
            const result = stringify(list.toArray(encoding.toCodePointList([0, 36, 8364, 55295, 57344, 65535])))
            if (result !== '[0,36,8364,55295,57344,65535]') { throw result }
        },
        () => {
            const result = stringify(list.toArray(encoding.toCodePointList([56320, 57343])))
            if (result !== '[-2147427328,-2147426305]') { throw result }
        },
        () => {
            const result = stringify(list.toArray(encoding.toCodePointList([55296, 56320, 55297, 56375, 55378, 57186, 56319, 57343])))
            if (result !== '[65536,66615,150370,1114111]') { throw result }
        },
        () => {
            const result = stringify(list.toArray(encoding.toCodePointList([55296, 55296])))
            if (result !== '[-2147428352,-2147428352]') { throw result }
        },
        () => {
            const result = stringify(list.toArray(encoding.toCodePointList([55296, 0])))
            if (result !== '[-2147428352,0]') { throw result }
        },
        () => {
            const result = stringify(list.toArray(encoding.toCodePointList([56320])))
            if (result !== '[-2147427328]') { throw result }
        },
        () => {
            const result = stringify(list.toArray(encoding.toCodePointList([56320, 0])))
            if (result !== '[-2147427328,0]') { throw result }
        }
    ],
    fromCodePointList: [
        () => {
            const result = stringify(list.toArray(encoding.fromCodePointList([0])))
            if (result !== '[0]') { throw result }
        },
        () => {
            const result = stringify(list.toArray(encoding.fromCodePointList([0x24])))
            if (result !== '[36]') { throw result }
        },
        () => {
            const result = stringify(list.toArray(encoding.fromCodePointList([0x20AC])))
            if (result !== '[8364]') { throw result }
        },
        () => {
            const result = stringify(list.toArray(encoding.fromCodePointList([0xd7ff])))
            if (result !== '[55295]') { throw result }
        },
        () => {
            const result = stringify(list.toArray(encoding.fromCodePointList([0xe000])))
            if (result !== '[57344]') { throw result }
        },
        () => {
            const result = stringify(list.toArray(encoding.fromCodePointList([0xffff])))
            if (result !== '[65535]') { throw result }
        },
        () => {
            const result = stringify(list.toArray(encoding.fromCodePointList([0x10000])))
            if (result !== '[55296,56320]') { throw result }
        },
        () => {
            const result = stringify(list.toArray(encoding.fromCodePointList([0x10437])))
            if (result !== '[55297,56375]') { throw result }
        },
        () => {
            const result = stringify(list.toArray(encoding.fromCodePointList([0x24B62])))
            if (result !== '[55378,57186]') { throw result }
        },
        () => {
            const result = stringify(list.toArray(encoding.fromCodePointList([0x10ffff])))
            if (result !== '[56319,57343]') { throw result }
        },
        () => {
            const result = stringify(list.toArray(encoding.fromCodePointList([-1, 0xd800, 0xdfff, 0x110000])))
            if (result !== '[65535,55296,57343,0]') { throw result }
        }
    ],
    string: [
        () => {
            const utf16List = encoding.stringToList("Hello world!😂🚜🚲")
            const result = encoding.listToString(utf16List)
            if (result !== "Hello world!😂🚜🚲") { throw result }
        },
        () => {
            const a = encoding.stringToList("Hello world!😂🚜🚲")
            const b = encoding.toCodePointList(a)
            const c = encoding.fromCodePointList(b)
            const result = encoding.listToString(c)
            if (result !== "Hello world!😂🚜🚲") { throw result }

        }
    ]
}
