/**
 * Built-in calls convert in language order, preserve callback failures and
 * format strings and numbers like the corresponding primitive host methods.
 *
 * @import { EdagValue, Values, Function as ValueFunction } from '../types.ts'
 * @import { Invoke } from '../call/types.ts'
 */

import { assert, assertEq, assertOk, assertError, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.mjs'
import { hasMethod, method } from './module.f.mjs'

const undefinedValue = /** @type {const} */ (['undefined'])
const fn = /** @type {const} */ (['=>', 0, [], 5])
const coercible = /** @type {const} */ (['{}', [[':', 'valueOf', fn], [':', 'toString', fn]]])
const failure = error(/** @type {const} */ (['[]', ['failure']]))
/** @type {Invoke} */
const skipped = () => { assert(false, 'unexpected callback') }
/** @type {(receiver: EdagValue, key: string, args: Values, expected: EdagValue) => void} */
const check = (receiver, key, args, expected) => assertStructurallySame(assertOk(method(receiver, key, args, skipped)), expected)
/** @type {(receiver: EdagValue, key: string, args: Values) => void} */
const refuses = (receiver, key, args) => assertStructurallySame(assertError(method(receiver, key, args, skipped)), undefinedValue)

export const proof = {
    availability: () => {
        for (const receiver of [null, undefinedValue]) { assertEq(hasMethod(receiver, 'toString'), false) }
        for (const receiver of [1, 'x', true, 1n, fn, ['[]', []], ['{}', []]]) {
            assertEq(hasMethod(/** @type {EdagValue} */ (receiver), 'toString'), true)
            assertEq(hasMethod(/** @type {EdagValue} */ (receiver), 'valueOf'), false)
            assertEq(hasMethod(/** @type {EdagValue} */ (receiver), 'missing'), false)
        }
        assertEq(hasMethod(['[]', []], 'map'), true)
        assertEq(hasMethod('x', 'map'), false)
        refuses(null, 'toString', [])
        refuses(1n, 'toFixed', [])
        refuses(1, 'missing', [])
    },
    stringification: () => {
        check(true, 'toString', [], 'true')
        check(['{}', []], 'toString', [], '[object Object]')
        check(fn, 'toString', [], '()=>5')
        check(['[]', [1, 2]], 'toString', [], '1,2')
        check('abc', 'toString', [coercible], 'abc')
        for (const receiver of [255, 255n]) {
            check(receiver, 'toString', [], '255')
            check(receiver, 'toString', [undefinedValue], '255')
            check(receiver, 'toString', ['16.9'], 'ff')
            for (const radix of [1, 37, NaN, Infinity, 2n]) { refuses(receiver, 'toString', [radix]) }
            assertEq(method(receiver, 'toString', [coercible], () => failure), failure)
        }
    },
    numberFormatting: () => {
        check(1.25, 'toFixed', [1], '1.3')
        check(1.25, 'toFixed', [], '1')
        check(1.25, 'toExponential', [], '1.25e+0')
        check(1.25, 'toPrecision', [], '1.25')
        check(1.25, 'toExponential', [1], '1.3e+0')
        check(1.25, 'toPrecision', [2], '1.3')
        check(1.25, 'toFixed', [NaN], '1')
        for (const key of ['toFixed', 'toExponential', 'toPrecision']) {
            refuses(1, key, [-1])
            refuses(1, key, [101])
            refuses(1, key, [1n])
            assertEq(method(1, key, [coercible], () => failure), failure)
            assertEq(assertOk(method(1, key, [coercible], () => ok(2))), key === 'toFixed' ? '1.00' : key === 'toPrecision' ? '1.0' : '1.00e+0')
        }
        refuses(Infinity, 'toFixed', [101])
        check(Infinity, 'toExponential', [101], 'Infinity')
        check(NaN, 'toPrecision', [0], 'NaN')
        refuses(1, 'toPrecision', [0])
    },
    simpleStrings: () => {
        check('a\ud800', 'isWellFormed', [], false)
        check('ab', 'isWellFormed', [], true)
        check('a\ud800', 'toWellFormed', [], 'a\ufffd')
        check(' x ', 'trim', [], 'x')
        check(' x ', 'trimStart', [], 'x ')
        check(' x ', 'trimEnd', [], ' x')
        check('x', 'concat', [1, null, undefinedValue], 'x1nullundefined')
        check('x', 'concat', [], 'x')
        assertEq(method('x', 'concat', [coercible, coercible], () => failure), failure)
    },
    indexing: () => {
        check('a😀b', 'at', [-1], 'b')
        check('a😀b', 'at', [10], undefinedValue)
        check('a😀b', 'charAt', [1], '\ud83d')
        check('a😀b', 'charCodeAt', [1], 0xD83D)
        check('a😀b', 'codePointAt', [1], 0x1F600)
        check('a😀b', 'codePointAt', [10], undefinedValue)
        check('abc', 'slice', [1], 'bc')
        check('abc', 'slice', [-2, -1], 'b')
        check('abc', 'substring', [2, 1], 'b')
        check('abc', 'substring', [1], 'bc')
        assertEq(assertOk(method('abc', 'slice', [0, coercible], () => ok(undefinedValue))), '')
        for (const key of ['at', 'charAt', 'charCodeAt', 'codePointAt', 'slice', 'substring']) {
            assertEq(method('abc', key, [coercible], () => failure), failure)
        }
        for (const key of ['slice', 'substring']) { assertEq(method('abc', key, [0, coercible], () => failure), failure) }
    },
    repetitionAndPadding: () => {
        check('ab', 'repeat', [2.9], 'abab')
        check('ab', 'repeat', [-0.9], '')
        refuses('ab', 'repeat', [-1])
        refuses('ab', 'repeat', [Infinity])
        check('ab', 'padStart', [4], '  ab')
        check('ab', 'padEnd', [4], 'ab  ')
        check('ab', 'padStart', [5, 'xy'], 'xyxab')
        check('ab', 'padEnd', [5, 'xy'], 'abxyx')
        for (const key of ['padStart', 'padEnd']) {
            check('ab', key, [2.9, coercible], 'ab')
            check('ab', key, [NaN, coercible], 'ab')
            assertEq(method('ab', key, [4, coercible], () => failure), failure)
        }
    },
    searches: () => {
        check('abcabc', 'includes', ['bc'], true)
        check('abcabc', 'indexOf', ['bc', 2], 4)
        check('abcabc', 'lastIndexOf', ['bc'], 4)
        check('abcabc', 'lastIndexOf', ['bc', NaN], 4)
        check('abcabc', 'startsWith', ['bc', 1], true)
        check('abcabc', 'endsWith', ['bc'], true)
        for (const key of ['includes', 'indexOf', 'lastIndexOf', 'startsWith', 'endsWith']) {
            assertEq(method('abc', key, [coercible], () => failure), failure)
            assertEq(method('abc', key, ['x', coercible], () => failure), failure)
        }
    },
    splitting: () => {
        check('a,b,c', 'split', [','], ['[]', ['a', 'b', 'c']])
        check('a,b,c', 'split', [',', 2], ['[]', ['a', 'b']])
        check('a,b,c', 'split', [], ['[]', ['a,b,c']])
        check('a,b,c', 'split', [',', 0], ['[]', []])
        assertEq(method('a,b', 'split', [coercible], () => failure), failure)
        assertEq(method('a,b', 'split', [',', coercible], () => failure), failure)
    },
    replacementStrings: () => {
        check('aba', 'replace', ['a', '$&!'], 'a!ba')
        check('aba', 'replaceAll', ['a', '$&!'], 'a!ba!')
        check('ab', 'replaceAll', ['', '-'], '-a-b-')
        assertEq(method('aba', 'replace', [coercible, '!'], () => failure), failure)
        assertEq(method('aba', 'replace', ['x', coercible], () => failure), failure)
    },
    replacementCallbacks: () => {
        /** @type {ValueFunction} */
        const callback = ['=>', 3, [], ['arg', 0]]
        /** @type {Invoke} */
        const replacement = (f, fixed, rest) => {
            assertEq(f, callback)
            assertEq(fixed[2], 'aba')
            assertStructurallySame(rest, ['[]', []])
            return ok(`${fixed[0]}${fixed[1]}`)
        }
        assertEq(assertOk(method('aba', 'replace', ['a', callback], replacement)), 'a0ba')
        assertEq(assertOk(method('aba', 'replaceAll', ['a', callback], replacement)), 'a0ba2')
        check('aba', 'replace', ['x', callback], 'aba')
        assertEq(assertOk(method('ab', 'replaceAll', ['', callback], () => ok('-'))), '-a-b-')
        assertEq(method('aba', 'replace', ['a', callback], () => failure), failure)
        assertEq(method('aba', 'replace', ['a', callback], f => f === callback ? ok(coercible) : failure), failure)
    },
}
