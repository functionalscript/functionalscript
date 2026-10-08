/**
 * Portable directory ordering shared by the Node and virtual runners.
 *
 * @module
 *
 * @import { Dirent } from '../../types.ts'
 */

import { stringToCodePointList } from '../../../../text/utf16/module.f.mjs'
import { fromCodePointList } from '../../../../text/utf8/module.f.mjs'
import { isValidCodePoint } from '../../../../text/code_point/module.f.mjs'
import { map, next } from '../../../../types/list/module.f.mjs'
import { parse } from '../../../../path/module.f.mjs'

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

/**
 * Normalize one native readdir result to the virtual walk's portable order:
 * parent depth first, then parent components, then the entry's name. The input
 * has normalized parent paths from one read root. Parsing handles `.` and roots
 * without counting them as directory levels. Comparing components, not joined
 * paths, keeps all of `a` ahead of `a!`, even though `a!/x` sorts before `a/x`.
 *
 * Native Windows enumeration is not byte-sorted, and recursive traversal also
 * differs between Node versions. Only the returned order changes: retain every
 * entry, its fields and its identity; leave traversal and errors to the host.
 * The comparator lives here so both runners use exactly the same name order.
 *
 * @type {(entries: readonly Dirent[]) => readonly Dirent[]}
 */
export const _orderDirents = entries => entries.toSorted((a, b) => {
    const left = parse(a.parentPath)
    const right = parse(b.parentPath)
    const depth = left.length - right.length
    if (depth !== 0) { return depth }
    for (let i = 0; i < left.length; i++) {
        const difference = _compareNames(left[i], right[i])
        if (difference !== 0) { return difference }
    }
    return _compareNames(a.name, b.name)
})
