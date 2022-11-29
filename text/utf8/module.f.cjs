const list = require('../../types/list/module.f.cjs')
const operator = require('../../types/function/operator/module.f.cjs')
const array = require('../../types/array/module.f.cjs')
const { flatMap, flat, stateScan } = list

/** @typedef {u8|null} ByteOrEof */

/** @typedef {array.Array1<number>|array.Array2<number>|array.Array3<number>} Utf8NonEmptyState */

/** @typedef {null|Utf8NonEmptyState} Utf8State */

/** @typedef {number} u8 */

/** @typedef {number} i32 */

const errorMask = 0b1000_0000_0000_0000_0000_0000_0000_0000

/** @type {(input:number) => list.List<u8>} */
const codePointToUtf8 = input => {
    if (input >= 0x0000 && input <= 0x007f) { return [input & 0b01111_1111] }
    if (input >= 0x0080 && input <= 0x07ff) { return [input >> 6 | 0b1100_0000, input & 0b0011_1111 | 0b1000_0000] }
    if (input >= 0x0800 && input <= 0xffff) { return [input >> 12 | 0b1110_0000, input >> 6 & 0b0011_1111 | 0b1000_0000, input & 0b0011_1111 | 0b1000_0000] }
    if (input >= 0x10000 && input <= 0x10ffff) { return [input >> 18 | 0b1111_0000, input >> 12 & 0b0011_1111 | 0b1000_0000, input >> 6 & 0b0011_1111 | 0b1000_0000, input & 0b0011_1111 | 0b1000_0000] }
    if ((input & errorMask) !== 0) {
        if ((input & 0b1000_0000_0000_0000) !== 0) { return [input >> 12 & 0b0000_0111 | 0b1111_0000, input >> 6 & 0b0011_1111 | 0b1000_0000, input & 0b0011_1111 | 0b1000_0000] }
        if ((input & 0b0000_0100_0000_0000) !== 0) { return [input >> 6 & 0b0000_1111 | 0b1110_0000, input & 0b0011_1111 | 0b1000_0000] }
        if ((input & 0b0000_0010_0000_0000) !== 0) { return [input >> 6 & 0b0000_0111 | 0b1111_0000, input & 0b0011_1111 | 0b1000_0000] }
        if ((input & 0b0000_0000_1000_0000) !== 0) { return [input & 0b1111_1111] }
    }
    return [errorMask]
}

const fromCodePointList = flatMap(codePointToUtf8)

/** @type {(state: Utf8NonEmptyState) => i32}*/
const utf8StateToError = state => {
    switch (state.length) {
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
        return [[errorMask], state]
    }
    if (state === null) {
        if (byte < 0b1000_0000) { return [[byte], null] }
        if (byte >= 0b1100_0010 && byte <= 0b1111_0100) { return [[], [byte]] }
        return [[byte | errorMask], null]
    }
    if (byte >= 0b1000_0000 && byte < 0b1100_0000) {
        switch (state.length) {
            case 1:
                if (state[0] < 0b1110_0000) { return [[((state[0] & 0b0001_1111) << 6) + (byte & 0b0011_1111)], null] }
                if (state[0] < 0b1111_1000) { return [[], [state[0], byte]] }
                break
            case 2:
                if (state[0] < 0b1111_0000) { return [[((state[0] & 0b0000_1111) << 12) + ((state[1] & 0b0011_1111) << 6) + (byte & 0b0011_1111)], null] }
                if (state[0] < 0b1111_1000) { return [[], [state[0], state[1], byte]] }
                break
            case 3:
                return [[((state[0] & 0b0000_0111) << 18) + ((state[1] & 0b0011_1111) << 12) + ((state[2] & 0b0011_1111) << 6) + (byte & 0b0011_1111)], null]
        }
    }
    const error = utf8StateToError(state)
    if (byte < 0b1000_0000) { return [[error, byte], null] }
    if (byte >= 0b1100_0010 && byte <= 0b1111_0100) { return [[error], [byte]] }
    return [[error, byte | errorMask], null]
}

/** @type {(state: Utf8State) => readonly[list.List<i32>, Utf8State]} */
const utf8EofToCodePointOp = state => {
    if (state === null) { return [null, null] }
    return [[utf8StateToError(state)], null]
}

/** @type {operator.StateScan<ByteOrEof, Utf8State, list.List<i32>>} */
const utf8ByteOrEofToCodePointOp = state => input => input === null ? utf8EofToCodePointOp(state) : utf8ByteToCodePointOp(state)(input)

/** @type {list.List<ByteOrEof>} */
const eofList = [null]

/** @type {(input: list.List<u8>) => list.List<i32>} */
const toCodePointList = input => flat(stateScan(utf8ByteOrEofToCodePointOp)(null)(flat([input, eofList])))

module.exports = {
    /** @readonly */
    fromCodePointList,
    /** @readonly */
    toCodePointList
}
