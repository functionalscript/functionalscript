/**
 * Built-in calls convert in language order, preserve callback failures and
 * format strings and numbers like the corresponding primitive host methods.
 *
 * @import { EdagValue, Values, Function as ValueFunction } from '../types.ts'
 * @import { Invoke } from '../call/types.ts'
 */

import { assert, assertEq, assertOk, assertError, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.js'
import { invoke } from '../../amnesia/module.f.mjs'
import { hasMethod, method } from './module.f.mjs'

const undefinedValue = /** @type {const} */ (['undefined'])
const fn = /** @type {const} */ (['=>', 0, [], 5])
const coercible = /** @type {const} */ (['{}', [[':', 'valueOf', fn], [':', 'toString', fn]]])
const failure = error(/** @type {const} */ (['[]', ['failure']]))
/** @type {Invoke} */
const skipped = () => { assert(false, 'unexpected callback') }
/** @type {(receiver: EdagValue, key: string, args: Values, expected: EdagValue) => void} */
const check = (receiver, key, args, expected) => assertStructurallySame(assertOk(method(receiver, key, args, skipped, undefined)), expected)
/** @type {(receiver: EdagValue, key: string, args: Values) => void} */
const refuses = (receiver, key, args) => assertStructurallySame(assertError(method(receiver, key, args, skipped, undefined)), undefinedValue)
/**
 * A member body: for the receiver `'no'` it answers `undefined`, the name
 * no member of that receiver; for every other, the function answering its
 * first argument, the search a `startsWith` call passes.
 *
 * @type {ValueFunction}
 */
const body = ['=>', 1, [], ['?:', ['===', ['arg', 0], 'no'], ['undefined'], ['=>', 1, [], ['arg', 0]]]]
/** @type {(entries: readonly (readonly [string, EdagValue])[]) => import('../types.ts').Runtime} */
const table = entries => ['{}', entries.map(([name, value]) => [':', name, value])]
/**
 * A runtime whose `dot` answers `body`'s answer for the receiver under the
 * key `startsWith`, and `undefined` under every other key.
 *
 * @type {(body: EdagValue) => import('../types.ts').Runtime}
 */
const dispatching = body => table([['dot', ['=>', 2, [], ['?:', ['===', ['arg', 1], 'startsWith'], ['()', body, [['arg', 0]]], ['undefined']]]]])

export const proof = {
    availability: () => {
        /** @type {(receiver: EdagValue, key: string) => boolean} */
        const has = (receiver, key) => assertOk(hasMethod(receiver, key, undefined, skipped))
        for (const receiver of [null, undefinedValue]) { assertEq(has(receiver, 'toString'), false) }
        for (const receiver of [1, 'x', true, 1n, fn, ['[]', []], ['{}', []]]) {
            assertEq(has(/** @type {EdagValue} */ (receiver), 'toString'), true)
            assertEq(has(/** @type {EdagValue} */ (receiver), 'valueOf'), false)
            assertEq(has(/** @type {EdagValue} */ (receiver), 'missing'), false)
        }
        assertEq(has(['[]', []], 'map'), true)
        assertEq(has('x', 'map'), false)
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
            assertEq(method(receiver, 'toString', [coercible], () => failure, undefined), failure)
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
            assertEq(method(1, key, [coercible], () => failure, undefined), failure)
            assertEq(assertOk(method(1, key, [coercible], () => ok(2), undefined)), key === 'toFixed' ? '1.00' : key === 'toPrecision' ? '1.0' : '1.00e+0')
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
        check('aBß\ud800', 'toLowerCase', [], 'abß\ud800')
        check('aBß\ud800', 'toUpperCase', [], 'ABSS\ud800')
        check('x', 'concat', [1, null, undefinedValue], 'x1nullundefined')
        check('x', 'concat', [], 'x')
        assertEq(method('x', 'concat', [coercible, coercible], () => failure, undefined), failure)
    },
    indexing: () => {
        check('a😀b', 'at', [-1], 'b')
        check('a😀b', 'at', [10], undefinedValue)
        check('a😀b', 'charAt', [1], '\ud83d')
        check('a😀b', 'charCodeAt', [1], 0xD83D)
        check('a😀b', 'codePointAt', [1], 0x1_F600)
        check('a😀b', 'codePointAt', [10], undefinedValue)
        check('abc', 'slice', [1], 'bc')
        check('abc', 'slice', [-2, -1], 'b')
        check('abc', 'substring', [2, 1], 'b')
        check('abc', 'substring', [1], 'bc')
        assertEq(assertOk(method('abc', 'slice', [0, coercible], () => ok(undefinedValue), undefined)), '')
        for (const key of ['at', 'charAt', 'charCodeAt', 'codePointAt', 'slice', 'substring']) {
            assertEq(method('abc', key, [coercible], () => failure, undefined), failure)
        }
        for (const key of ['slice', 'substring']) { assertEq(method('abc', key, [0, coercible], () => failure, undefined), failure) }
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
            assertEq(method('ab', key, [4, coercible], () => failure, undefined), failure)
        }
    },
    searches: () => {
        check('abcabc', 'includes', ['bc'], true)
        check('abcabc', 'indexOf', ['bc', 2], 4)
        check('abcabc', 'lastIndexOf', ['bc'], 4)
        check('abcabc', 'lastIndexOf', ['bc', NaN], 4)
        check('abcabc', 'endsWith', ['bc'], true)
        for (const key of ['includes', 'indexOf', 'lastIndexOf', 'endsWith']) {
            assertEq(method('abc', key, [coercible], () => failure, undefined), failure)
            assertEq(method('abc', key, ['x', coercible], () => failure, undefined), failure)
        }
    },
    // `startsWith` has no native case: the runtime's `dot` answers it, asked
    // for the receiver and the key — the function of the arguments, or
    // `undefined` for a receiver the name is no member of — and the
    // function called with the arguments. Without one the call is the
    // `TypeError` of a VM that binds nothing: no runtime at all, one
    // without `dot`, one whose `dot` is no function, or a `dot` answering
    // `undefined`. A `dot` that throws, a body's first step, is that throw,
    // in the guard and in the call alike.
    runtime: () => {
        const runtime = dispatching(body)
        // bound only where a body answers a function: the guard of
        // `'abc'.startsWith?.()`, asked before any argument
        assertEq(assertOk(hasMethod('abc', 'startsWith', runtime, invoke)), true)
        assertEq(assertOk(hasMethod('no', 'startsWith', runtime, invoke)), false)
        assertEq(assertOk(hasMethod('abc', 'startsWith', undefined, invoke)), false)
        assertEq(assertOk(hasMethod('abc', 'slice', undefined, skipped)), true)
        assertEq(assertOk(hasMethod(1, 'startsWith', runtime, skipped)), false)
        assertEq(assertOk(method('abc', 'startsWith', ['ab'], invoke, runtime)), 'ab')
        assertStructurallySame(assertOk(method('abc', 'startsWith', [], invoke, runtime)), undefinedValue)
        assertStructurallySame(assertError(method('no', 'startsWith', ['ab'], invoke, runtime)), undefinedValue)
        refuses('abc', 'startsWith', ['ab'])
        refuses(1, 'startsWith', ['ab'])
        for (const missing of [table([]), table([['dot', 'x']]), dispatching(['=>', 1, [], ['undefined']])]) {
            assertStructurallySame(assertError(method('abc', 'startsWith', ['ab'], invoke, missing)), undefinedValue)
        }
        const throwing = table([['dot', ['=>', 2, [], ['throw', 'boom']]]])
        assertEq(assertError(hasMethod('abc', 'startsWith', throwing, invoke)), 'boom')
        assertEq(assertError(method('abc', 'startsWith', ['ab'], invoke, throwing)), 'boom')
        // a native name is answered natively where `dot` answers nothing,
        // and by `dot`'s callee where it answers one
        assertEq(assertOk(method('abc', 'slice', [1], invoke, runtime)), 'bc')
        const shadowing = table([['dot', ['=>', 2, [], ['=>', 0, [], 'dotted']]]])
        assertEq(assertOk(method('abc', 'slice', [1], invoke, shadowing)), 'dotted')
        assertEq(assertOk(hasMethod('abc', 'slice', shadowing, invoke)), true)
    },
    splitting: () => {
        check('a,b,c', 'split', [','], ['[]', ['a', 'b', 'c']])
        check('a,b,c', 'split', [',', 2], ['[]', ['a', 'b']])
        check('a,b,c', 'split', [], ['[]', ['a,b,c']])
        check('a,b,c', 'split', [',', 0], ['[]', []])
        assertEq(method('a,b', 'split', [coercible], () => failure, undefined), failure)
        assertEq(method('a,b', 'split', [',', coercible], () => failure, undefined), failure)
    },
    replacementStrings: () => {
        check('aba', 'replace', ['a', '$&!'], 'a!ba')
        check('aba', 'replaceAll', ['a', '$&!'], 'a!ba!')
        check('ab', 'replaceAll', ['', '-'], '-a-b-')
        assertEq(method('aba', 'replace', [coercible, '!'], () => failure, undefined), failure)
        assertEq(method('aba', 'replace', ['x', coercible], () => failure, undefined), failure)
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
        assertEq(assertOk(method('aba', 'replace', ['a', callback], replacement, undefined)), 'a0ba')
        assertEq(assertOk(method('aba', 'replaceAll', ['a', callback], replacement, undefined)), 'a0ba2')
        check('aba', 'replace', ['x', callback], 'aba')
        assertEq(assertOk(method('ab', 'replaceAll', ['', callback], () => ok('-'), undefined)), '-a-b-')
        assertEq(method('aba', 'replace', ['a', callback], () => failure, undefined), failure)
        assertEq(method('aba', 'replace', ['a', callback], f => f === callback ? ok(coercible) : failure, undefined), failure)
    },
}
