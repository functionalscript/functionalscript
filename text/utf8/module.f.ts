import * as list from '../../types/list/module.f.mjs'
import * as operator from '../../types/function/operator/module.f.mjs'
import * as Array from '../../types/array/module.f.ts'
const { flatMap, flat, stateScan } = list

type ByteOrEof = u8|null

type Utf8NonEmptyState = Array.Array1<number>|Array.Array2<number>|Array.Array3<number>

type Utf8State = null|Utf8NonEmptyState

type u8 = number

type i32 = number

const errorMask = 0b1000_0000_0000_0000_0000_0000_0000_0000

const codePointToUtf8
    : (input:number) => list.List<u8>
    = input => {
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

export const fromCodePointList = flatMap(codePointToUtf8)

const utf8StateToError
    : (state: Utf8NonEmptyState) => i32
    = state => {
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

const utf8ByteToCodePointOp
    : operator.StateScan<number, Utf8State, list.List<i32>>
    = state => byte => {
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

const utf8EofToCodePointOp
    : (state: Utf8State) => readonly[list.List<i32>, Utf8State]
    = state =>
    [state === null ? null : [utf8StateToError(state)], null]

const utf8ByteOrEofToCodePointOp
    : operator.StateScan<ByteOrEof, Utf8State, list.List<i32>>
    = state => input => input === null ? utf8EofToCodePointOp(state) : utf8ByteToCodePointOp(state)(input)

const eofList
    : list.List<ByteOrEof>
    = [null]

export const toCodePointList
    : (input: list.List<u8>) => list.List<i32>
    = input => flat(stateScan(utf8ByteOrEofToCodePointOp)(null)(flat([input, eofList])))
