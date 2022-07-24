const { todo } = require('../../dev/main.f.js')
const operator = require('../../types/function/operator/main.f.js')
const result = require('../../types/result/main.f.js')
const list = require('../../types/list/main.f.js')

/** @typedef {result.Result<number,number>} Utf8Result */

/** @type {(input:number) => list.List<Utf8Result>} */
const codePointToUtf8 = input =>
{
    if (input >= 0x0000 && input <= 0x007f)
        return [['ok', input & 0x7f]]
    else if (input >= 0x0080 && input <= 0x07ff)
        return [['ok', input >> 6 | 0xc0],['ok', input & 0x3f | 0x80]]
    else if (input >= 0x0800 && input <= 0xffff)
        return [['ok', input >> 12 | 0xe0],['ok', input >> 6 & 0x3f | 0x80],['ok', input & 0x3f | 0x80]]
    else if (input >= 0x10000 && input <= 0x10ffff)
        return [['ok', input >> 18 | 0xf0],['ok', input >> 12 & 0x3f | 0x80],['ok', input >> 6 & 0x3f | 0x80],['ok', input & 0x3f | 0x80]]
    else
        return [['error', input]]
}

/** @type {(input:number) => list.List<Utf8Result>} */
const codePointToUtf16 = input =>
{
    if (input >= 0x0000 && input <= 0xd7ff || input >= 0xe000 && input <= 0xffff)
        return [['ok', input >> 8 & 0xff], ['ok', input & 0xff]]
    else
        return todo()
}

/** @type {(input: list.List<number>) => list.List<Utf8Result>} */
const codePointsToUtf8 = list.flatMap(codePointToUtf8)

/** @type {(input: list.List<number>) => list.List<Utf8Result>} */
const codePointsToUtf16 = list.flatMap(codePointToUtf16)

module.exports = {
    /** @readonly */
    codePointsToUtf8,
    /** @readonly */
    codePointsToUtf16,
}
