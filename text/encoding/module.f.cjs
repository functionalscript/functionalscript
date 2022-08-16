const result = require('../../types/result/module.f.cjs')
const list = require('../../types/list/module.f.cjs')
const operator = require('../../types/function/operator/module.f.cjs')
const array = require('../../types/array/module.f.cjs')
const { contains } = require('../../types/range/module.f.cjs')
const { compose } = require('../../types/function/module.f.cjs')
const { map, flat, stateScan, concat, fold, toArray, flatMap } = list
const { ok, error } = result

/** @typedef {result.Result<number,number>} ByteResult */

/** @typedef {result.Result<number,readonly number[]>} CodePointResult */

/** @typedef {number|undefined} ByteOrEof */

/** @typedef {u16|undefined} WordOrEof */

/** @typedef {undefined|array.Array1<number>|array.Array2<number>|array.Array3<number>} Utf8State */

/** @typedef {undefined|number} Utf16State */

/** @typedef {number} u16 */

/** @typedef {number} i32 */

/** @type {(a:number) => boolean} */
const isBmpCodePoint = a => a >= 0x0000 && a <= 0xd7ff || a >= 0xe000 && a <= 0xffff

const isHighSurrogate = contains([0xd800, 0xdbff])

/** @type {(a:number) => boolean} */
const isLowSurrogate = contains([0xdc00, 0xdfff])

const errorMask = 0b1000_0000_0000_0000_0000_0000_0000_0000

/** @type {(input:number) => list.List<ByteResult>} */
const codePointToUtf8 = input =>
{
    if (input >= 0x0000 && input <= 0x007f) { return [ok(input & 0x7f)] }
    if (input >= 0x0080 && input <= 0x07ff) { return [ok(input >> 6 | 0xc0), ok(input & 0x3f | 0x80)] }
    if (input >= 0x0800 && input <= 0xffff) { return [ok(input >> 12 | 0xe0), ok(input >> 6 & 0x3f | 0x80), ok(input & 0x3f | 0x80)] }
    if (input >= 0x10000 && input <= 0x10ffff) { return [ok(input >> 18 | 0xf0), ok(input >> 12 & 0x3f | 0x80), ok(input >> 6 & 0x3f | 0x80), ok(input & 0x3f | 0x80)] }
    return [error(input)]
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

/** @type {operator.StateScan<number, Utf8State, list.List<CodePointResult>>} */
const utf8ByteToCodePointOp = state => byte => {
    if (byte < 0x00 || byte > 0xff) {
        return [[error([byte])], state]
    }
    if (state == undefined) {
        if (byte < 0x80) { return [[ok(byte)], undefined] }
        if (byte >= 0xc2 && byte <= 0xf4) { return [[], [byte]] }
        return [[error([byte])], undefined]
    }
    if (byte >= 0x80 && byte < 0xc0)
    {
        switch(state.length)
        {
            case 1:
                if (state[0] < 0xe0) { return [[ok(((state[0] & 0x1f) << 6) + (byte & 0x3f))], undefined] }
                if (state[0] < 0xf8) { return [[], [state[0], byte]] }
                break
            case 2:
                if (state[0] < 0xf0) { return [[ok(((state[0] & 0x0f) << 12) + ((state[1] & 0x3f) << 6) + (byte & 0x3f))], undefined] }
                if (state[0] < 0xf8) { return [[], [state[0], state[1], byte]] }
                break
            case 3:
                return [[ok(((state[0] & 0x07) << 18) + ((state[1] & 0x3f) << 12) + ((state[2] & 0x3f) << 6) + (byte & 0x3f))], undefined]
        }
    }
    return [[error(toArray(concat(state)([byte])))], undefined]
}

/** @type {(state: Utf8State) => readonly[list.List<CodePointResult>, Utf8State]} */
const utf8EofToCodePointOp = state => [state === undefined ? undefined : [error(state)],  undefined]

/** @type {operator.StateScan<ByteOrEof, Utf8State, list.List<CodePointResult>>} */
const utf8ByteOrEofToCodePointOp = state => input => input === undefined ? utf8EofToCodePointOp(state) : utf8ByteToCodePointOp(state)(input)

/** @type {(input: list.List<number>) => list.List<CodePointResult>} */
const utf8ListToCodePointList = input => flat(stateScan(utf8ByteOrEofToCodePointOp)(undefined)(concat(/** @type {list.List<ByteOrEof>} */(input))([undefined])))

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

const utf16ListToString = compose(map(String.fromCharCode))(fold(operator.concat)(''))

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
