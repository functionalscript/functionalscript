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

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../../asserts/module.f.mjs'
import { maxLengthBytes, msb } from '../../../../types/bit_vec/module.f.mjs'
import { utf8 } from '../../../../text/module.f.mjs'
import { emptyState, virtualOperationMap } from '../module.f.mjs'
import { compareNames } from './module.f.mjs'

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
    compareNames: () => {
        // Empty, equal, prefix and unequal inputs in both directions cover
        // every exit. Bounded vectors remain an oracle for these short names.
        const names = ['', 'p', 'pa', '\u007F', '\u0080', '\u07FF', '\u0800', '\uE000', '\u{10000}']
        for (const a of names) {
            for (const b of names) {
                assertEq(Math.sign(compareNames(a, b)), msb.cmp(utf8(a))(utf8(b)))
            }
        }
    },
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
    oversizedNameWithSibling: () => {
        // The virtual filesystem already accepts this name. Previously adding
        // a sibling caused sorting to encode it as a bounded Vec and panic.
        const name = 'a'.repeat(Number(maxLengthBytes) + 1)
        assertStructurallySame(paths({ [name]: file }, {}), [`base/${name}`])
        assertStructurallySame(paths({ z: file, [name]: file }, {}), [`base/${name}`, 'base/z'])
    },
    oversizedSharedPrefix: () => {
        // The first difference is beyond the old cap; do not truncate the
        // comparison or fall back to fixture order when that cap is crossed.
        const prefix = 'a'.repeat(Number(maxLengthBytes) + 1)
        assertEq(compareNames(prefix, prefix), 0)
        assertStructurallySame(paths({
            [`${prefix}b`]: file,
            [`${prefix}a`]: file,
            [prefix]: file,
        }, {}), [`base/${prefix}`, `base/${prefix}a`, `base/${prefix}b`])
    },
    oversizedMultibytePrefix: () => {
        // More UTF-8 bytes than the old Vec cap, but fewer UTF-16 code units.
        // The differing suffix also catches a fallback to UTF-16 ordering.
        const prefix = '\uE000'.repeat(Math.floor(Number(maxLengthBytes) / 3) + 1)
        assert(prefix.length < Number(maxLengthBytes))
        assertStructurallySame(paths({
            [`${prefix}\u{10000}`]: file,
            [`${prefix}\uE000`]: file,
        }, {}), [`base/${prefix}\uE000`, `base/${prefix}\u{10000}`])
    },
    recursiveOversizedName: () => {
        const name = 'a'.repeat(Number(maxLengthBytes) + 1)
        assertStructurallySame(paths({
            z: file,
            [name]: { y: file, x: file },
        }, { recursive: true }), [
            `base/${name}`, 'base/z', `base/${name}/x`, `base/${name}/y`,
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
