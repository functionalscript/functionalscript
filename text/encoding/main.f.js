const { todo } = require('../../dev/main.f.js')
const operator = require('../../types/function/operator/main.f.js')
const result = require('../../types/result/main.f.js')
const list = require('../../types/list/main.f.js')

/** @typedef {result.Result<number,number>} Utf8Result */

/** @type {(input:number) => list.List<Utf8Result>} */
const codePointToUtf8Map = input =>
{
    if (input >= 0x0000 && input <= 0x007f)
        return [['ok', input & 0x7f]]
    else if (input >= 0x0080 && input <= 0x07ff)
        return [['ok', input >> 6 | 0xc0],['ok', input & 0x3f | 0x80]]
    else
        return todo()
}

/** @type {(input: list.List<number>) => list.List<Utf8Result>} */
const codePointToUtf8 = list.flatMap(codePointToUtf8Map)

module.exports = {
    /** @readonly */
    codePointToUtf8
}
