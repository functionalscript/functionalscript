const list = require('../../types/list/module.f.cjs')
const operator = require('../../types/function/operator/module.f.cjs')
const array = require('../../types/array/module.f.cjs')
const { contains } = require('../../types/range/module.f.cjs')
const { compose } = require('../../types/function/module.f.cjs')
const { map, flat, stateScan, concat, reduce, toArray, flatMap } = list
const { ok, error } = result

/** @typedef {u8|undefined} ByteOrEof */

/** @typedef {u16|undefined} WordOrEof */

/** @typedef {array.Array1<number>|array.Array2<number>|array.Array3<number>} Utf8NonEmptyState */

/** @typedef {undefined|Utf8NonEmptyState} Utf8State */

/** @typedef {undefined|number} Utf16State */

/** @typedef {number} u8 */

/** @typedef {number} u16 */

/** @typedef {number} i32 */

/** @type {(a:number) => boolean} */
const isBmpCodePoint = a => a >= 0x0000 && a <= 0xd7ff || a >= 0xe000 && a <= 0xffff

const isHighSurrogate = contains([0xd800, 0xdbff])

/** @type {(a:number) => boolean} */
const isLowSurrogate = contains([0xdc00, 0xdfff])

const errorMask = 0b1000_0000_0000_0000_0000_0000_0000_0000

/** @type {(input:number) => list.List<u8>} */
const codePointToUtf8 = input =>
{
    if (input >= 0x0000 && input <= 0x007f) { return [input & 0x7f] }
    if (input >= 0x0080 && input <= 0x07ff) { return [input >> 6 | 0xc0, input & 0x3f | 0x80] }
    if (input >= 0x0800 && input <= 0xffff) { return [input >> 12 | 0xe0, input >> 6 & 0x3f | 0x80, input & 0x3f | 0x80] }
    if (input >= 0x10000 && input <= 0x10ffff) { return [input >> 18 | 0xf0, input >> 12 & 0x3f | 0x80, input >> 6 & 0x3f | 0x80, input & 0x3f | 0x80] }
    return todo()
}

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

const codePointListToUtf8List = flatMap(codePointToUtf8)

const codePointListToUtf16List = flatMap(codePointToUtf16)

/** @type {(state: Utf8NonEmptyState) => i32}*/
const utf8StateToError = state => {
    switch(state.length) {
        case 1:
             return state[0] | errorMask
        case 2:
            if (state[0] < 0b1111_0000) return (((state[0] & 0b0000_1111) << 6) + (state[1] & 0b0011_1111) + 0b0000_0100_0000_0000) | errorMask
            return (((state[0] & 0b0000_0111) << 6) + (state[1] & 0b0011_1111) + 0b0000_0010_0000_0000) | errorMask
        case 3:
            return (((state[0] & 0b0000_0111) << 12) + ((state[1] & 0b0011_1111) << 6) + (state[2] & 0b0011_1111) + 0b1000_0000_0000_0000) | errorMask
    }
}

/** @type {operator.StateScan<number, Utf8State, list.List<i32>>} */
const utf8ByteToCodePointOp = state => byte => {
    if (byte < 0x00 || byte > 0xff) {
        return [[0xffffffff], state]
    }
    if (state == undefined) {
        if (byte < 0b1000_0000) { return [[byte], undefined] }
        if (byte >= 0b1100_0010 && byte <= 0b1111_0100) { return [[], [byte]] }
        return [[byte | errorMask], undefined]
    }
    if (byte >= 0b1000_0000 && byte < 0b1100_0000) {
        switch(state.length) {
            case 1:
                if (state[0] < 0b1110_0000) { return [[((state[0] & 0b0001_1111) << 6) + (byte & 0b0011_1111)], undefined] }
                if (state[0] < 0b1111_1000) { return [[], [state[0], byte]] }
                break
            case 2:
                if (state[0] < 0b1111_0000) { return [[((state[0] & 0b0000_1111) << 12) + ((state[1] & 0b0011_1111) << 6) + (byte & 0b0011_1111)], undefined] }
                if (state[0] < 0b1111_1000) { return [[], [state[0], state[1], byte]] }
                break
            case 3:
                return [[((state[0] & 0b0000_0111) << 18) + ((state[1] & 0b0011_1111) << 12) + ((state[2] & 0b0011_1111) << 6) + (byte & 0b0011_1111)], undefined]
        }
    }
    const error = utf8StateToError(state)
    if (byte < 0b1000_0000) { return [[error, byte], undefined] }
    if (byte >= 0b1100_0010 && byte <= 0b1111_0100) { return [[error], [byte]] }
    return [[error, byte | errorMask], undefined]
}

/** @type {(state: Utf8State) => readonly[list.List<i32>, Utf8State]} */
const utf8EofToCodePointOp = state => {
    if (state === undefined) { return [undefined, undefined] }
    return [[utf8StateToError(state)], undefined]
}

/** @type {operator.StateScan<ByteOrEof, Utf8State, list.List<i32>>} */
const utf8ByteOrEofToCodePointOp = state => input => input === undefined ? utf8EofToCodePointOp(state) : utf8ByteToCodePointOp(state)(input)

/** @type {(input: list.List<u8>) => list.List<i32>} */
const utf8ListToCodePointList = input => list.flat(list.stateScan(utf8ByteOrEofToCodePointOp)(undefined)(list.concat(/** @type {list.List<ByteOrEof>} */(input))([undefined])))

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
const utf16ListToCodePointList = input => flat(stateScan(utf16ByteOrEofToCodePointOp)(undefined)(concat(/** @type {list.List<WordOrEof>} */(input))([undefined])))

/** @type {(s: string) => list.List<u16>} */
const stringToUtf16List = s => {
    /** @type {(i: number) => list.Result<number>} */
    const at = i => {
        const first = s.charCodeAt(i)
        return isNaN(first) ? undefined : { first, tail: () => at(i + 1) }
    }
    return at(0)
}

const utf16ListToString = compose(map(String.fromCharCode))(reduce(operator.concat)(''))

module.exports = {
    /** @readonly */
    codePointListToUtf8List,
    /** @readonly */
    codePointListToUtf16List,
    /** @readonly */
    utf8ListToCodePointList,
    /** @readonly */
    utf16ListToCodePointList,
    /** @readonly */
    stringToUtf16List,
    /** @readonly */
    utf16ListToString
}
