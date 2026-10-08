/**
 * Portable directory ordering shared by the Node and virtual runners.
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

/**
 * Order one read's entries by parent depth, parent components, then name.
 * The caller supplies structural components relative to the read root, before
 * converting host paths for display. Reparsing a normalized path loses POSIX
 * filename boundaries: `a\b` is one directory, not `a/b`, and `a\..\b` must
 * not collapse. Comparing components also keeps all of `a` ahead of `a!`.
 *
 * Retain every entry and its identity. The Node adapter sorts native Dirents
 * before mapping their fields; the virtual queue already has the tree structure.
 *
 * @type {<T extends { readonly name: string }>(entries: readonly T[], parentComponents: (entry: T) => readonly string[]) => readonly T[]}
 */
export const _orderDirents = (entries, parentComponents) => entries.toSorted((a, b) => {
    const left = parentComponents(a)
    const right = parentComponents(b)
    const depth = left.length - right.length
    if (depth !== 0) { return depth }
    for (let i = 0; i < left.length; i++) {
        const difference = _compareNames(left[i], right[i])
        if (difference !== 0) { return difference }
    }
    return _compareNames(a.name, b.name)
})
