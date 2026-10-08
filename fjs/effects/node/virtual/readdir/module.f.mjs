/**
 * UTF-8 byte ordering for virtual directory names, without a bit-vector size cap.
 *
 * @module
 */

import { stringToCodePointList } from '../../../../text/utf16/module.f.mjs'
import { fromCodePointList } from '../../../../text/utf8/module.f.mjs'
import { isValidCodePoint } from '../../../../text/code_point/module.f.mjs'
import { map, next } from '../../../../types/list/module.f.mjs'

/**
 * Node path conversion replaces each lone UTF-16 surrogate with U+FFFD.
 * The shared decoder tags these units and the lossless encoder preserves them,
 * so replace the tagged code points before encoding, not the encoded bytes.
 * Valid surrogate pairs remain one supplementary-plane code point.
 *
 * @param {string} name
 */
const pathBytes = name => fromCodePointList(
    map(cp => isValidCodePoint(cp) ? cp : 0xfffd)(stringToCodePointList(name)))

/**
 * Compare host-path UTF-8 byte streams directly rather than collecting each
 * name in a bounded `Vec`. The virtual filesystem currently
 * admits names longer than `maxLengthBytes`; listing them must not introduce a
 * new size limit. Stop at the first differing byte, or put the shorter prefix
 * first. Filename admission is separate: ../todo/no-name-length-limit.md.
 *
 * This compares encoded paths; it does not rename fixture keys or merge aliases.
 * Those filesystem-wide semantics are tracked in ../todo/surrogate-path-identity.md.
 *
 * @type {(a: string, b: string) => number}
 */
export const _compareNames = (a, b) => {
    let left = next(pathBytes(a))
    let right = next(pathBytes(b))
    while (left !== null && right !== null) {
        const difference = left.first - right.first
        if (difference !== 0) { return difference }
        left = next(left.tail)
        right = next(right.tail)
    }
    return left === null ? right === null ? 0 : -1 : 1
}
