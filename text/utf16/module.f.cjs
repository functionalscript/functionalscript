const list = require('../../types/list/module.f.cjs')
const operator = require('../../types/function/operator/module.f.cjs')
const { contains } = require('../../types/range/module.f.cjs')
const { fn } = require('../../types/function/module.f.cjs')
const { map, flat, stateScan, reduce, flatMap } = list

/** @typedef {u16|null} WordOrEof */

/** @typedef {undefined|number} Utf16State */

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

/** @type {(input: i32) => list.List<u16>} */
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

const fromCodePointList = flatMap(codePointToUtf16)

const u16 = contains([0x0000, 0xFFFF])

/** @type {operator.StateScan<u16, Utf16State, list.List<i32>>} */
const utf16ByteToCodePointOp = state => word => {
    if (!u16(word)) {
        return [[0xffffffff], state]
    }
    if (state === undefined) {
        if (isBmpCodePoint(word)) { return [[word], undefined] }
        if (isHighSurrogate(word)) { return [[], word] }
        return [[word | errorMask], undefined]
    }
    if (isLowSurrogate(word)) {
        const high = state - 0xd800
        const low = word - 0xdc00
        return [[(high << 10) + low + 0x10000], undefined]
    }
    if (isBmpCodePoint(word)) { return [[state | errorMask, word], undefined] }
    if (isHighSurrogate(word)) { return [[state | errorMask], word] }
    return [[state | errorMask, word | errorMask], undefined]
}

/** @type {(state: Utf16State) => readonly[list.List<i32>, Utf16State]} */
const utf16EofToCodePointOp = state => [state === undefined ? undefined : [state | errorMask],  undefined]

/** @type {operator.StateScan<WordOrEof, Utf16State, list.List<i32>>} */
const utf16ByteOrEofToCodePointOp = state => input => input === null ? utf16EofToCodePointOp(state) : utf16ByteToCodePointOp(state)(input)

/** @type {list.List<WordOrEof>} */
const eofList = [null]

/** @type {(input: list.List<u16>) => list.List<i32>} */
const toCodePointList = input => flat(stateScan(utf16ByteOrEofToCodePointOp)(undefined)(flat([input, eofList])))

/** @type {(s: string) => list.List<u16>} */
const stringToList = s => {
    /** @type {(i: number) => list.Result<number>} */
    const at = i => {
        const first = s.charCodeAt(i)
        return isNaN(first) ? undefined : { first, tail: () => at(i + 1) }
    }
    return at(0)
}

/** @type {(input: list.List<u16>) => string} */
const listToString = fn(map(String.fromCharCode))
    .then(reduce(operator.concat)(''))
    .result

module.exports = {
    /** @readonly */
    fromCodePointList,
    /** @readonly */
    toCodePointList,
    /** @readonly */
    stringToList,
    /** @readonly */
    listToString
}
