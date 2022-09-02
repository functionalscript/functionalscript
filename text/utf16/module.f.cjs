const list = require('../../types/list/module.f.cjs')
const operator = require('../../types/function/operator/module.f.cjs')
const array = require('../../types/array/module.f.cjs')
const { contains } = require('../../types/range/module.f.cjs')
const { compose } = require('../../types/function/module.f.cjs')
const { map, flat, stateScan, concat, reduce, flatMap } = list

/** @typedef {u16|undefined} WordOrEof */

/** @typedef {undefined|number} Utf16State */

/** @typedef {number} u16 */

/** @typedef {number} i32 */

/** @type {(a:number) => boolean} */
const isBmpCodePoint = a => a >= 0x0000 && a <= 0xd7ff || a >= 0xe000 && a <= 0xffff

const isHighSurrogate = contains([0xd800, 0xdbff])

/** @type {(a:number) => boolean} */
const isLowSurrogate = contains([0xdc00, 0xdfff])

const errorMask = 0b1000_0000_0000_0000_0000_0000_0000_0000

/** @type {(input:i32) => list.List<u16>} */
const codePointToUtf16 = input =>
{
    if (isBmpCodePoint(input)) { return [input] }
    if (input >= 0x010000 && input <= 0x10ffff) {
        const high = ((input - 0x10000) >> 10) + 0xd800
        const low = ((input - 0x10000) & 0b0011_1111_1111) + 0xdc00
        return [high, low]
    }
    return [input & 0xffff]
}

const fromCodePointList = flatMap(codePointToUtf16)

/** @type {operator.StateScan<u16, Utf16State, list.List<i32>>} */
const utf16ByteToCodePointOp = state => byte => {
    if (byte < 0x00 || byte > 0xffff) {
        return [[0xffffffff], state]
    }
    if (state === undefined) {
        if (isBmpCodePoint(byte)) { return [[byte], undefined] }
        if (isHighSurrogate(byte)) { return [[], byte] }
        return [[byte | errorMask], undefined]
    }
    if (isLowSurrogate(byte)) {
        const high = state - 0xd800
        const low = byte - 0xdc00
        return [[(high << 10) + low + 0x10000], undefined]
    }
    if (isBmpCodePoint(byte)) { return [[state | errorMask, byte], undefined] }
    if (isHighSurrogate(byte)) { return [[state | errorMask], byte] }
    return [[state | errorMask, byte | errorMask], undefined]
}

/** @type {(state: Utf16State) => readonly[list.List<i32>, Utf16State]} */
const utf16EofToCodePointOp = state => [state === undefined ? undefined : [state | errorMask],  undefined]

/** @type {operator.StateScan<WordOrEof, Utf16State, list.List<i32>>} */
const utf16ByteOrEofToCodePointOp = state => input => input === undefined ? utf16EofToCodePointOp(state) : utf16ByteToCodePointOp(state)(input)

/** @type {(input: list.List<u16>) => list.List<i32>} */
const toCodePointList = input => flat(stateScan(utf16ByteOrEofToCodePointOp)(undefined)(concat(/** @type {list.List<WordOrEof>} */(input))([undefined])))

/** @type {(s: string) => list.List<u16>} */
const stringToList = s => {
    /** @type {(i: number) => list.Result<number>} */
    const at = i => {
        const first = s.charCodeAt(i)
        return isNaN(first) ? undefined : { first, tail: () => at(i + 1) }
    }
    return at(0)
}

const listToString = compose(map(String.fromCharCode))(reduce(operator.concat)(''))

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
