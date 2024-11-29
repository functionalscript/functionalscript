import list from '../../types/list/module.f.cjs'
import * as operator from '../../types/function/operator/module.f.mjs'
import * as arrayT from '../../types/array/module.f.mjs'
const { flatMap, flat, stateScan } = list

/** @typedef {u8|null} ByteOrEof */

/** @typedef {arrayT.Array1<number>|arrayT.Array2<number>|arrayT.Array3<number>} Utf8NonEmptyState */

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
    let x
    switch (state.length) {
        case 1: {
            [x] = state
            break
        }
        case 2: {
            const [s0, s1] = state
            x = s0 < 0b1111_0000
                ? ((s0 & 0b0000_1111) << 6) + (s1 & 0b0011_1111) + 0b0000_0100_0000_0000
                : ((s0 & 0b0000_0111) << 6) + (s1 & 0b0011_1111) + 0b0000_0010_0000_0000
            break
        }
        case 3: {
            const [s0, s1, s2] = state
            x = ((s0 & 0b0000_0111) << 12) + ((s1 & 0b0011_1111) << 6) + (s2 & 0b0011_1111) + 0b1000_0000_0000_0000
            break
        }
        default:
            throw 'invalid state'
    }
    return x | errorMask
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
            case 1: {
                const [s0] = state
                if (s0 < 0b1110_0000) { return [[((s0 & 0b0001_1111) << 6) + (byte & 0b0011_1111)], null] }
                if (s0 < 0b1111_1000) { return [[], [s0, byte]] }
                break
            }
            case 2: {
                const [s0, s1] = state
                if (s0 < 0b1111_0000) { return [[((s0 & 0b0000_1111) << 12) + ((s1 & 0b0011_1111) << 6) + (byte & 0b0011_1111)], null] }
                if (s0 < 0b1111_1000) { return [[], [s0, s1, byte]] }
                break
            }
            case 3: {
                const [s0, s1, s2] = state
                return [[((s0 & 0b0000_0111) << 18) + ((s1 & 0b0011_1111) << 12) + ((s2 & 0b0011_1111) << 6) + (byte & 0b0011_1111)], null]
            }
        }
    }
    const error = utf8StateToError(state)
    if (byte < 0b1000_0000) { return [[error, byte], null] }
    if (byte >= 0b1100_0010 && byte <= 0b1111_0100) { return [[error], [byte]] }
    return [[error, byte | errorMask], null]
}

/** @type {(state: Utf8State) => readonly[list.List<i32>, Utf8State]} */
const utf8EofToCodePointOp = state =>
    [state === null ? null : [utf8StateToError(state)], null]

/** @type {operator.StateScan<ByteOrEof, Utf8State, list.List<i32>>} */
const utf8ByteOrEofToCodePointOp = state => input => input === null ? utf8EofToCodePointOp(state) : utf8ByteToCodePointOp(state)(input)

/** @type {list.List<ByteOrEof>} */
const eofList = [null]

/** @type {(input: list.List<u8>) => list.List<i32>} */
const toCodePointList = input => flat(stateScan(utf8ByteOrEofToCodePointOp)(null)(flat([input, eofList])))

export default {
    /** @readonly */
    fromCodePointList,
    /** @readonly */
    toCodePointList
}
