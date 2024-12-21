import * as list from '../../types/list/module.f.ts'
import * as operator from '../../types/function/operator/module.f.ts'
import * as range from '../../types/range/module.f.ts'
const { contains } = range
import * as f from '../../types/function/module.f.ts'
const { fn } = f
const { map, flat, stateScan, reduce, flatMap, empty } = list

type WordOrEof = u16|null

type Utf16State = number|null

type u16 = number

type i32 = number

const lowBmp = contains([0x0000, 0xd7ff])
const highBmp = contains([0xe000, 0xffff])

const isBmpCodePoint
    : (codePoint: i32) => boolean
    = codePoint => lowBmp(codePoint) || highBmp(codePoint)

const isHighSurrogate
    : (codePoint: i32) => boolean
    = contains([0xd800, 0xdbff])

const isLowSurrogate
    : (codePoint: i32) => boolean
    = contains([0xdc00, 0xdfff])

const errorMask = 0b1000_0000_0000_0000_0000_0000_0000_0000

const isSupplementaryPlane
    : (a: i32) => boolean
    = contains([0x01_0000, 0x10_ffff])

const codePointToUtf16
    : (input: i32) => list.List<u16>
    = codePoint => {
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

const utf16ByteToCodePointOp
    : operator.StateScan<u16, Utf16State, list.List<i32>>
    = state => word => {
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

const utf16EofToCodePointOp
    : (state: Utf16State) => readonly[list.List<i32>, Utf16State]
    = state => [state === null ? empty : [state | errorMask],  null]

const utf16ByteOrEofToCodePointOp
    : operator.StateScan<WordOrEof, Utf16State, list.List<i32>>
    = state => input => input === null ? utf16EofToCodePointOp(state) : utf16ByteToCodePointOp(state)(input)

const eofList
    : list.List<WordOrEof>
    = [null]

export const toCodePointList
    : (input: list.List<u16>) => list.List<i32>
    = input => flat(stateScan(utf16ByteOrEofToCodePointOp)(null)(flat([input, eofList])))

export const stringToList
    : (s: string) => list.List<u16>
    = s => {
    const at
        : (i: number) => list.Result<number>
        = i => {
        const first = s.charCodeAt(i)
        return isNaN(first) ? empty : { first, tail: () => at(i + 1) }
    }
    return at(0)
}

export const listToString
    : (input: list.List<u16>) => string
    = fn(map(String.fromCharCode))
    .then(reduce(operator.concat)(''))
    .result
