// @ts-self-types="./module.f.d.mts"
import list, * as List from '../../types/list/module.f.mjs'
import operator, * as Operator from '../../types/function/operator/module.f.mjs'
import range from '../../types/range/module.f.mjs'
const { contains } = range
import f from '../../types/function/module.f.mjs'
const { fn } = f
const { map, flat, stateScan, reduce, flatMap, empty } = list

/** @typedef {u16|null} WordOrEof */

/** @typedef {number|null} Utf16State */

/** @typedef {number} u16 */

/** @typedef {number} i32 */

const lowBmp = contains([0x0000, 0xd7ff])
const highBmp = contains([0xe000, 0xffff])

/** @type {(codePoint: i32) => boolean} */
const isBmpCodePoint = codePoint => lowBmp(codePoint) || highBmp(codePoint)

/** @type {(codePoint: i32) => boolean} */
const isHighSurrogate = contains([0xd800, 0xdbff])

/** @type {(codePoint: i32) => boolean} */
const isLowSurrogate = contains([0xdc00, 0xdfff])

const errorMask = 0b1000_0000_0000_0000_0000_0000_0000_0000

/** @type {(a: i32) => boolean} */
const isSupplementaryPlane = contains([0x01_0000, 0x10_ffff])

/** @type {(input: i32) => List.List<u16>} */
const codePointToUtf16 = codePoint => {
    if (isBmpCodePoint(codePoint)) { return [codePoint] }
    if (isSupplementaryPlane(codePoint)) {
        const n = codePoint - 0x1_0000
        const high = (n >> 10) + 0xd800
        const low = (n & 0b0011_1111_1111) + 0xdc00
        return [high, low]
    }
    return [codePoint & 0xffff]
}

export const fromCodePointList = flatMap(codePointToUtf16)

const u16 = contains([0x0000, 0xFFFF])

/** @type {Operator.StateScan<u16, Utf16State, List.List<i32>>} */
const utf16ByteToCodePointOp = state => word => {
    if (!u16(word)) {
        return [[0xffffffff], state]
    }
    if (state === null) {
        if (isBmpCodePoint(word)) { return [[word], null] }
        if (isHighSurrogate(word)) { return [[], word] }
        return [[word | errorMask], null]
    }
    if (isLowSurrogate(word)) {
        const high = state - 0xd800
        const low = word - 0xdc00
        return [[(high << 10) + low + 0x10000], null]
    }
    if (isBmpCodePoint(word)) { return [[state | errorMask, word], null] }
    if (isHighSurrogate(word)) { return [[state | errorMask], word] }
    return [[state | errorMask, word | errorMask], null]
}

/** @type {(state: Utf16State) => readonly[List.List<i32>, Utf16State]} */
const utf16EofToCodePointOp = state => [state === null ? empty : [state | errorMask],  null]

/** @type {Operator.StateScan<WordOrEof, Utf16State, List.List<i32>>} */
const utf16ByteOrEofToCodePointOp = state => input => input === null ? utf16EofToCodePointOp(state) : utf16ByteToCodePointOp(state)(input)

/** @type {List.List<WordOrEof>} */
const eofList = [null]

/** @type {(input: List.List<u16>) => List.List<i32>} */
export const toCodePointList = input => flat(stateScan(utf16ByteOrEofToCodePointOp)(null)(flat([input, eofList])))

/** @type {(s: string) => List.List<u16>} */
export const stringToList = s => {
    /** @type {(i: number) => List.Result<number>} */
    const at = i => {
        const first = s.charCodeAt(i)
        return isNaN(first) ? empty : { first, tail: () => at(i + 1) }
    }
    return at(0)
}

/** @type {(input: List.List<u16>) => string} */
export const listToString = fn(map(String.fromCharCode))
    .then(reduce(operator.concat)(''))
    .result
