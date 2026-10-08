/**
 * UTF-8 byte ordering for virtual directory names, without a bit-vector size cap.
 *
 * @module
 */

import { stringToCodePointList } from '../../../../text/utf16/module.f.mjs'
import { fromCodePointList } from '../../../../text/utf8/module.f.mjs'
import { next } from '../../../../types/list/module.f.mjs'

/**
 * Compare the same byte streams `utf8` encodes, but consume them directly rather
 * than collecting each name in a bounded `Vec`. The virtual filesystem currently
 * admits names longer than `maxLengthBytes`; listing them must not introduce a
 * new size limit. Stop at the first differing byte, or put the shorter prefix
 * first. Filename admission is separate: ../todo/no-name-length-limit.md.
 *
 * @type {(a: string, b: string) => number}
 */
export const compareNames = (a, b) => {
    let left = next(fromCodePointList(stringToCodePointList(a)))
    let right = next(fromCodePointList(stringToCodePointList(b)))
    while (left !== null && right !== null) {
        const difference = left.first - right.first
        if (difference !== 0) { return difference }
        left = next(left.tail)
        right = next(right.tail)
    }
    return left === null ? right === null ? 0 : -1 : 1
}
