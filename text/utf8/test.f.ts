import { toCodePointList, fromCodePointList } from './module.f.ts'
import * as json from '../../json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'

const stringify = json.stringify(sort)

export default {
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
    ]
}
