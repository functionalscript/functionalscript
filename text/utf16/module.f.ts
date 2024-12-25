import {
    map,
    flat,
    stateScan,
    reduce,
    flatMap,
    empty,
    type List,
    type Result,
    type Thunk,
} from '../../types/list/module.f.ts'
import * as operator from '../../types/function/operator/module.f.ts'
import { contains } from '../../types/range/module.f.ts'
import * as f from '../../types/function/module.f.ts'
const { fn } = f

type WordOrEof = u16|null

type Utf16State = number|null

type u16 = number

type i32 = number

const lowBmp = contains([0x0000, 0xd7ff])
const highBmp = contains([0xe000, 0xffff])

const isBmpCodePoint = (codePoint: i32) =>
    lowBmp(codePoint) || highBmp(codePoint)

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

const codePointToUtf16 = (codePoint: i32): List<u16> => {
    if (isBmpCodePoint(codePoint)) { return [codePoint] }
    if (isSupplementaryPlane(codePoint)) {
        const n = codePoint - 0x1_0000
        const high = (n >> 10) + 0xd800
        const low = (n & 0b0011_1111_1111) + 0xdc00
        return [high, low]
    }
    return [codePoint & 0xffff]
}

export const fromCodePointList
    : (input: List<number>) => Thunk<number>
    = flatMap(codePointToUtf16)

const u16
    : (i: number) => boolean
    = contains([0x0000, 0xFFFF])

const utf16ByteToCodePointOp
    : operator.StateScan<u16, Utf16State, List<i32>>
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

const utf16EofToCodePointOp = (state: Utf16State): readonly[List<i32>, Utf16State] =>
    [state === null ? empty : [state | errorMask],  null]

const utf16ByteOrEofToCodePointOp
    : operator.StateScan<WordOrEof, Utf16State, List<i32>>
    = state => input => input === null ? utf16EofToCodePointOp(state) : utf16ByteToCodePointOp(state)(input)

const eofList: List<WordOrEof> = [null]

export const toCodePointList
    : (input: List<u16>) => List<i32>
    = input => flat(stateScan(utf16ByteOrEofToCodePointOp)(null)(flat([input, eofList])))

export const stringToList = (s: string): List<u16> => {
    const at = (i: number): Result<number> => {
        const first = s.charCodeAt(i)
        return isNaN(first) ? empty : { first, tail: () => at(i + 1) }
    }
    return at(0)
}

export const listToString
    : (input: List<u16>) => string
    = fn(map(String.fromCharCode))
        .then(reduce(operator.concat)(''))
        .result
