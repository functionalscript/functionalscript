const result = require('../../types/result/main.f.cjs')
const list = require('../../types/list/main.f.cjs')
const operator = require('../../types/function/operator/main.f.cjs')
const array = require('../../types/array/main.f.cjs')
const { todo } = require('../../dev/main.f.cjs')
const { ok, error } = result

/** @typedef {result.Result<number,number>} ByteResult */

/** @typedef {result.Result<number,readonly number[]>} CodePointResult */

/** @typedef {number|undefined} ByteOrEof */

/** @typedef {undefined|array.Array1<number>|array.Array2<number>|array.Array3<number>} Utf8State */

/** @type {(input:number) => list.List<ByteResult>} */
const codePointToUtf8 = input =>
{
    if (input >= 0x0000 && input <= 0x007f) { return [ok(input & 0x7f)] }
    if (input >= 0x0080 && input <= 0x07ff) { return [ok(input >> 6 | 0xc0), ok(input & 0x3f | 0x80)] }
    if (input >= 0x0800 && input <= 0xffff) { return [ok(input >> 12 | 0xe0), ok(input >> 6 & 0x3f | 0x80), ok(input & 0x3f | 0x80)] }
    if (input >= 0x10000 && input <= 0x10ffff) { return [ok(input >> 18 | 0xf0), ok(input >> 12 & 0x3f | 0x80), ok(input >> 6 & 0x3f | 0x80), ok(input & 0x3f | 0x80)] }
    return [error(input)]
}

/** @type {(input:number) => list.List<ByteResult>} */
const codePointToUtf16 = input =>
{
    if (input >= 0x0000 && input <= 0xd7ff || input >= 0xe000 && input <= 0xffff) { return [ok(input >> 8), ok(input & 0xff)] }
    if (input >= 0x010000 && input <= 0x10ffff) {
        const high = ((input - 0x10000) >> 10) + 0xd800
        const low = ((input - 0x10000) & 0x3ff) + 0xdc00
        return [ok(high >> 8), ok(high & 0xff), ok(low >> 8), ok(low & 0xff)]
    }
    return [error(input)]
}

/** @type {(input: list.List<number>) => list.List<ByteResult>} */
const codePointListToUtf8 = list.flatMap(codePointToUtf8)

/** @type {(input: list.List<number>) => list.List<ByteResult>} */
const codePointListToUtf16 = list.flatMap(codePointToUtf16)

/** @type {operator.StateScan<number, Utf8State, list.List<CodePointResult>>} */
const utf8ByteToCodePointOp = state => byte => {
    if (byte < 0 || byte > 255) {
        return [[error(list.toArray(list.concat(state)([byte])))], undefined]
    }    
    if (state == undefined) {
        if (byte < 0x80) return [[ok(byte)], undefined]
        if (byte >= 0xc0 && byte < 0xf7) return [[], [byte]]
        return todo()
    }
    switch(state.length)
    {
        case 1:
            if (state[0] < 0xe0 && byte >= 0x80 && byte < 0xc0) return [[ok(((state[0] & 0x1f) << 6) + (byte & 0x3f))], undefined]
            return [[error(list.toArray(list.concat(state)([byte])))], undefined]
        case 2: return todo()
        case 3: return todo()
    }
}

/** @type {(state: Utf8State) => readonly[list.List<CodePointResult>, Utf8State]} */
const utf8EofToCodePointOp = state => [state == undefined ? undefined : [error(state)],  undefined]

/** @type {operator.StateScan<ByteOrEof, Utf8State, list.List<CodePointResult>>} */
const utf8ByteOrEofToCodePointOp = state => input => input === undefined ? utf8EofToCodePointOp(state) : utf8ByteToCodePointOp(state)(input)

/** @type {(input: list.List<number>) => list.List<CodePointResult>} */
const utf8ListToCodePoint = input => list.flat(list.stateScan(utf8ByteOrEofToCodePointOp)(undefined)(list.concat(/** @type {list.List<ByteOrEof>} */(input))([undefined])))

module.exports = {
    /** @readonly */
    codePointListToUtf8,
    /** @readonly */
    codePointListToUtf16,
    /** @readonly */
    utf8ListToCodePoint
}
