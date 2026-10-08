/**
 * UTF-8 ordering regressions for the virtual readdir operation.
 *
 * Recursive order targets the pinned Node 26.10.0, whose native traversal is
 * breadth-first: https://github.com/nodejs/node/blob/v26.10.0/src/node_file.cc
 * Node 22.22.2's promises implementation uses a stack instead; it is not an
 * oracle for this recursive fixture. See ../../../../../gen.nix/flake.nix.
 *
 * @import { Dir } from '../types.ts'
 */

import { assertOk, assertStructurallySame } from '../../../../asserts/module.f.mjs'
import { emptyState, virtualOperationMap } from '../module.f.mjs'

/** @type {readonly []} */
const file = []

/** @type {(base: Dir, options: { readonly recursive?: true }) => readonly string[]} */
const paths = (base, options) => {
    const [, result] = virtualOperationMap.readdir('base', options)({
        ...emptyState,
        root: { base },
    })
    return assertOk(result).map(({ name, parentPath }) => `${parentPath}/${name}`)
}

export const proof = {
    nonBmpNames: () => {
        // Default UTF-16 sorting reverses the order of these two names.
        assertStructurallySame(paths({ '\u{10000}': file, '\uE000': file }, {}), [
            'base/\uE000', 'base/\u{10000}',
        ])
    },
    sharedPrefixes: () => {
        assertStructurallySame(paths({
            'p\u{10000}': file,
            '\u{10000}': file,
            '\uE000a': file,
            'p\uE000': file,
            '\uE000': file,
            p: file,
        }, {}), [
            'base/p', 'base/p\uE000', 'base/p\u{10000}',
            'base/\uE000', 'base/\uE000a', 'base/\u{10000}',
        ])
    },
    recursiveUnicodeOrder: () => {
        assertStructurallySame(paths({
            '\u{10000}': { child: file },
            '\uE000': { '\u{10000}': file, '\uE000': { deep: file } },
        }, { recursive: true }), [
            'base/\uE000', 'base/\u{10000}',
            'base/\uE000/\uE000', 'base/\uE000/\u{10000}',
            'base/\u{10000}/child', 'base/\uE000/\uE000/deep',
        ])
    },
}
