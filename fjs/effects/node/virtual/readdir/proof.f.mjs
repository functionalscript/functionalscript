/**
 * UTF-8 ordering regressions for the virtual readdir operation.
 *
 * Both runners promise this order. The Node adapter normalizes its native
 * results, so Windows enumeration and older Node traversal cannot change it.
 * See ./README.md; raw fs.readdir output is not the oracle for this contract.
 *
 * @import { Dirent } from '../../types.ts'
 * @import { Dir } from '../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../../asserts/module.f.mjs'
import { maxLengthBytes, msb } from '../../../../types/bit_vec/module.f.mjs'
import { utf8 } from '../../../../text/module.f.mjs'
import { emptyState, virtualOperationMap } from '../module.f.mjs'
import { _compareNames, _orderDirents } from './module.f.mjs'

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

/** @type {(parentPath: string, name: string, isDirectory?: boolean) => Dirent} */
const entry = (parentPath, name, isDirectory = false) =>
    ({ parentPath, name, isFile: !isDirectory, isDirectory })

export const proof = {
    _orderDirents: {
        flat: () => {
            // Deliberately unsorted input catches the Windows issue on any OS.
            /** @type {readonly string[]} */
            const names = ['10', '9', 'Z', 'a', 'a!', 'z', '\uE000', '\u{10000}']
            const input = names.toReversed().map(name => entry('base', name))
            assertStructurallySame(_orderDirents(input).map(v => v.name), names)
            assertStructurallySame(input.map(v => v.name), names.toReversed())
        },
        recursive: () => {
            // Parent components, not full paths: a/x belongs before a!/x.
            /** @type {readonly (readonly [string, string])[]} */
            const pairs = [
                ['base', 'a'], ['base', 'a!'], ['base', '\uE000'], ['base', '\u{10000}'],
                ['base/a', 'f'], ['base/a', 'x'], ['base/a!', 'x'],
                ['base/\uE000', 'f'], ['base/\u{10000}', 'f'],
                ['base/a/x', 'deep'], ['base/a/x/deep', 'h'],
            ]
            const expected = pairs.map(([parent, name]) => entry(parent, name))
            for (let i = 0; i < expected.length; i++) {
                const input = [...expected.slice(i), ...expected.slice(0, i)].toReversed()
                assertStructurallySame(_orderDirents(input), expected)
            }
        },
        roots: () => {
            /** @type {readonly (readonly [string, string])[]} */
            const roots = [['.', '!'], ['/', '/!'], ['C:/', 'C:/!'], ['//host/share', '//host/share/!']]
            for (const [root, child] of roots) {
                const first = entry(root, 'z')
                const second = entry(child, 'a')
                assertStructurallySame(_orderDirents([second, first]), [first, second])
            }
        },
        retainsEntries: () => {
            const directory = entry('base', 'b', true)
            const regular = entry('base', 'c')
            // Links and other special entries are neither file nor directory.
            /** @type {Dirent} */
            const other = { parentPath: 'base', name: 'a', isFile: false, isDirectory: false }
            const result = _orderDirents([regular, directory, other])
            assertEq(result[0], other)
            assertEq(result[1], directory)
            assertEq(result[2], regular)
            assertEq(result.length, 3)
        },
        emptyAndSingleton: () => {
            assertStructurallySame(_orderDirents([]), [])
            const only = entry('base', 'a')
            assertStructurallySame(_orderDirents([only]), [only])
        },
    },
    _compareNames: () => {
        // Empty, equal, prefix and unequal inputs in both directions cover
        // every exit. Bounded vectors remain an oracle for these short names.
        /** @type {readonly string[]} */
        const names = ['', 'p', 'pa', '\u007F', '\u0080', '\u07FF', '\u0800', '\uE000', '\u{10000}']
        for (const a of names) {
            for (const b of names) {
                assertEq(Math.sign(_compareNames(a, b)), msb.cmp(utf8(a))(utf8(b)))
            }
        }
    },
    hostPathEncoding: () => {
        // Explicit well-formed spellings, not the lossless encoder applied to
        // malformed input: the expected side must not reproduce the defect.
        /** @type {readonly (readonly [string, string])[]} */
        const spellings = [
            ['', ''],
            ['\uD800', '\uFFFD'],
            ['\uDC00', '\uFFFD'],
            ['a\uD800', 'a\uFFFD'],
            ['\uD800a', '\uFFFDa'],
            ['\uD800\uD800', '\uFFFD\uFFFD'],
            ['\uDC00\uD800', '\uFFFD\uFFFD'],
            ['\uD800\uDC00', '\u{10000}'],
            ['\uD800\uDC00\uD800', '\u{10000}\uFFFD'],
            ['\uFFFD', '\uFFFD'],
            ['\uFFFF', '\uFFFF'],
        ]
        for (const [a, encodedA] of spellings) {
            for (const [b, encodedB] of spellings) {
                assertEq(Math.sign(_compareNames(a, b)), msb.cmp(utf8(encodedA))(utf8(encodedB)))
            }
        }
    },
    loneSurrogateOrder: () => {
        // Fixture keys retain their identities, but their order is the order
        // of the paths Node encodes: U+FFFD precedes U+FFFF, including at depth.
        for (const name of ['\uD800', '\uDC00']) {
            assertStructurallySame(paths({ '\uFFFF': file, [name]: file }, {}), [
                `base/${name}`, 'base/\uFFFF',
            ])
            assertStructurallySame(paths({
                '\uFFFF': { child: file },
                [name]: { '\uFFFF': file, [name]: file },
            }, { recursive: true }), [
                `base/${name}`, 'base/\uFFFF',
                `base/${name}/${name}`, `base/${name}/\uFFFF`,
                'base/\uFFFF/child',
            ])
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
        assertEq(_compareNames(prefix, prefix), 0)
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
