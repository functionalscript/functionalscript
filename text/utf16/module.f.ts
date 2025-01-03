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
import { concat, type StateScan } from '../../types/function/operator/module.f.ts'
import { contains } from '../../types/range/module.f.ts'
import { fn } from '../../types/function/module.f.ts'

type WordOrEof = U16 | null

type Utf16State = number | null

export type U16 = number

/**
 * [0, 0x10_FFFF]: 16+5 = 21 bits
 *
 * 121_0000_0000: 16+16+9 = 41 bits
 */
export type CodePoint = number

const lowBmp = contains([0x0000, 0xd7ff])
const highBmp = contains([0xe000, 0xffff])

const isBmpCodePoint = (codePoint: CodePoint) =>
    lowBmp(codePoint) || highBmp(codePoint)

const isHighSurrogate = contains([0xd800, 0xdbff])

const isLowSurrogate = contains([0xdc00, 0xdfff])

const errorMask = 0b1000_0000_0000_0000_0000_0000_0000_0000

const isSupplementaryPlane = contains([0x01_0000, 0x10_ffff])

const codePointToUtf16 = (codePoint: CodePoint): List<U16> => {
    if (isBmpCodePoint(codePoint)) { return [codePoint] }
    if (isSupplementaryPlane(codePoint)) {
        const n = codePoint - 0x1_0000
        const high = (n >> 10) + 0xd800
        const low = (n & 0b0011_1111_1111) + 0xdc00
        return [high, low]
    }
    return [codePoint & 0xffff]
}

export const fromCodePointList: (input: List<CodePoint>) => Thunk<U16>
    = flatMap(codePointToUtf16)

const u16: (i: U16) => boolean = contains([0x0000, 0xFFFF])

const utf16ByteToCodePointOp: StateScan<U16, Utf16State, List<CodePoint>>
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

const utf16EofToCodePointOp = (state: Utf16State): readonly[List<CodePoint>, Utf16State] =>
    [state === null ? empty : [state | errorMask],  null]

const utf16ByteOrEofToCodePointOp: StateScan<WordOrEof, Utf16State, List<CodePoint>>
    = state => input => input === null ? utf16EofToCodePointOp(state) : utf16ByteToCodePointOp(state)(input)

const eofList: List<WordOrEof> = [null]

export const toCodePointList = (input: List<U16>): List<CodePoint> =>
    flat(stateScan(utf16ByteOrEofToCodePointOp)(null)(flat([input, eofList])))

export const stringToList = (s: string): List<U16> => {
    const at = (i: number): Result<number> => {
        const first = s.charCodeAt(i)
        return isNaN(first) ? empty : { first, tail: () => at(i + 1) }
    }
    return at(0)
}

export const stringToCodePointList = (input: string): List<CodePoint> =>
    toCodePointList(stringToList(input))

export const listToString: (input: List<U16>) => string
    = fn(map(String.fromCharCode))
        .then(reduce(concat)(''))
        .result

export const codePointListToString = (input: List<CodePoint>): string =>
    listToString(fromCodePointList(input))
