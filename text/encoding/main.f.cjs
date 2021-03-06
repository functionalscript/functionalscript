const result = require('../../types/result/main.f.cjs')
const list = require('../../types/list/main.f.cjs')
const { ok, error } = result

/** @typedef {result.Result<number,number>} Utf8Result */

/** @type {(input:number) => list.List<Utf8Result>} */
const codePointToUtf8 = input =>
{
    if (input >= 0x0000 && input <= 0x007f) { return [ok(input & 0x7f)] }
    if (input >= 0x0080 && input <= 0x07ff) { return [ok(input >> 6 | 0xc0), ok(input & 0x3f | 0x80)] }
    if (input >= 0x0800 && input <= 0xffff) { return [ok(input >> 12 | 0xe0), ok(input >> 6 & 0x3f | 0x80), ok(input & 0x3f | 0x80)] }
    if (input >= 0x10000 && input <= 0x10ffff) { return [ok(input >> 18 | 0xf0), ok(input >> 12 & 0x3f | 0x80), ok(input >> 6 & 0x3f | 0x80), ok(input & 0x3f | 0x80)] }
    return [error(input)]
}

/** @type {(input:number) => list.List<Utf8Result>} */
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

/** @type {(input: list.List<number>) => list.List<Utf8Result>} */
const codePointListToUtf8 = list.flatMap(codePointToUtf8)

/** @type {(input: list.List<number>) => list.List<Utf8Result>} */
const codePointListToUtf16 = list.flatMap(codePointToUtf16)

module.exports = {
    /** @readonly */
    codePointListToUtf8,
    /** @readonly */
    codePointListToUtf16,
}
