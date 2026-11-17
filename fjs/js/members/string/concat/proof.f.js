import { assertEq } from '../../../../asserts/module.f.js'
import { concat } from './module.f.js'

/** @type {readonly unknown[]} */
const items = [
    '', 'text', 0, -0, 1, -1, NaN, Infinity, -Infinity,
    0n, 7n, -7n, true, false, null, undefined,
    [], [1, null, undefined, 'x'], {}, () => 1,
]

export const proof = /** @type {const} */ ({
    host: () => {
        for (const self of ['', 'prefix', '\ud800', '\u0000']) {
            assertEq(concat(self), self.concat())
            assertEq(concat(self, ...items), self.concat(.../** @type {readonly string[]} */ (items)))
        }
    },
    arguments: () => {
        assertEq(concat('a', 'b', 'c'), 'abc')
        assertEq(concat('', undefined), 'undefined')
        assertEq(concat('prefix', '', '', 'suffix'), 'prefixsuffix')
    },
    codeUnits: () => {
        assertEq(concat('\ud83d', '\ude00'), '😀')
        assertEq(concat('\ud800', 'x', '\udfff'), '\ud800x\udfff')
        assertEq(concat('a', '\u0000', 'b'), 'a\u0000b')
    },
    stringHint: () => {
        const value = /** @type {const} */ ({
            toString: () => 'string',
            valueOf: () => { throw 'valueOf must not be reached' },
        })
        assertEq(concat('>', value, '<'), '>string<')
    },
    primitiveFallback: () => {
        const value = /** @type {const} */ ({
            toString: () => ({}),
            valueOf: () => 7n,
        })
        assertEq(concat('>', value, '<'), '>7<')
    },
    throw: {
        toString: () => concat('prefix', { toString: () => { throw 'toString' } }, 'suffix'),
        valueOf: () => concat('', { toString: () => ({}), valueOf: () => { throw 'valueOf' } }),
        noPrimitive: () => concat('', { toString: () => ({}), valueOf: () => ({}) }),
        laterArgument: () => concat('', { toString: () => 'first' }, { toString: () => { throw 'second' } }),
    },
})
