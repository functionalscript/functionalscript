/**
 * Array construction retains ordinary values and shallow spread elements,
 * iterates strings by code point, and stops at the first failed operand.
 * Joining preserves nullish slots and delegates every other element unchanged.
 *
 * @import { EdagValue, Primitive, Values } from '../types.ts'
 * @import { ItemsOver } from '../../types.ts'
 * @import { ValueThunk } from '../control/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { assert, assertEq, assertOk, assertError, assertNotNullish, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.mjs'
import { primitiveToString } from '../coercion/module.f.mjs'
import { array, join } from './module.f.mjs'

/** A later operand that must never be evaluated. @type {() => never} */
const skipped = () => { assert(false, 'an operand after a failure was evaluated') }

const undefinedValue = /** @type {const} */ (['undefined'])
const data = /** @type {const} */ (['[]', [1]])
const object = /** @type {const} */ (['{}', [[':', 'value', data]]])
const func = /** @type {const} */ (['=>', 0, [data], ['frame', 0]])

/** @type {readonly EdagValue[]} */
const values = [
    null, undefinedValue, false, true, 0, -0, NaN, Infinity, -Infinity,
    '', 'value', 0n, 1n, -1n, ['[]', []], ['{}', []], ['=>', 0, [], 0],
    data, object, func,
]

/** Checks exact elements, including signed zero, NaN and represented identities. @type {(items: ItemsOver<ValueThunk>, expected: Values) => void} */
const expectValues = (items, expected) => {
    const [tag, actual] = assertOk(array(items))
    assertEq(tag, '[]')
    assertEq(actual.length, expected.length)
    for (let i = 0; i < expected.length; i += 1) {
        assertEq(Object.is(actual[i], expected[i]), true)
    }
}

/** A converter for nonnullish primitive fixtures. @type {(value: EdagValue) => Result<string, EdagValue>} */
const primitiveText = value => {
    assert(typeof value !== 'object')
    return ok(primitiveToString(value))
}

export const proof = {
    empty: () => {
        expectValues([], [])
        expectValues([['...', () => ok(['[]', []])]], [])
        expectValues([['...', () => ok('')], ['...', () => ok(['[]', []])]], [])
    },
    ordinaryValues: () => {
        expectValues(values.map(value => () => ok(value)), values)
    },
    mixedSpreads: () => {
        const source = /** @type {const} */ (['[]', [data, object, func]])
        expectValues([
            () => ok(0),
            ['...', () => ok(source)],
            () => ok(source),
            ['...', () => ok('xy')],
            () => ok(undefinedValue),
        ], [0, data, object, func, source, 'x', 'y', undefinedValue])
    },
    stringCodePoints: () => {
        expectValues([['...', () => ok('a😀𝄞b')]], ['a', '😀', '𝄞', 'b'])
        expectValues([['...', () => ok('\ud800x\udc00')]], ['\ud800', 'x', '\udc00'])
    },
    freshIdentity: () => {
        assertEq(Object.is(assertOk(array([])), assertOk(array([]))), false)
        const source = /** @type {const} */ (['[]', [data, object, func]])
        /** @type {ItemsOver<ValueThunk>} */
        const items = [['...', () => ok(source)]]
        const first = assertOk(array(items))
        const second = assertOk(array(items))
        assertEq(Object.is(first, source), false)
        assertEq(Object.is(second, source), false)
        assertEq(Object.is(first, second), false)
        for (let i = 0; i < source[1].length; i += 1) {
            assertEq(first[1][i], source[1][i])
            assertEq(second[1][i], source[1][i])
        }
    },
    dataOnly: () => {
        const tags = /** @type {const} */ (['undefined', '[]', '{}', '=>', '...', 'args', 'throw', 'frame', 'arg'])
        expectValues(tags.map(value => () => ok(value)), tags)
        const quoted = /** @type {const} */ (['[]', ['+', 1, 2, undefinedValue, data]])
        const throws = /** @type {const} */ (['=>', 0, [], ['throw', 'body remains code']])
        expectValues([() => ok(quoted), () => ok(throws)], [quoted, throws])
        expectValues([['...', () => ok(quoted)]], ['+', 1, 2, undefinedValue, data])
        expectValues([['...', () => ok('=>')]], ['=', '>'])
    },
    operandFailures: () => {
        for (const failure of [error(data), error(object), error(func), error(undefinedValue), error(NaN)]) {
            const fail = () => failure
            assertEq(array([fail, skipped]), failure)
            assertEq(array([() => ok(1), fail, skipped]), failure)
            assertEq(array([() => ok(1), () => ok(2), fail]), failure)
            assertEq(array([['...', fail], skipped]), failure)
            assertEq(array([() => ok(1), ['...', fail], skipped]), failure)
            assertEq(array([() => ok(1), () => ok(2), ['...', fail]]), failure)
        }
    },
    nonIterableSpreads: () => {
        /** @type {readonly EdagValue[]} */
        const nonIterable = [
            null, undefinedValue, false, true, 0, -0, NaN, Infinity, -Infinity,
            0n, 1n, -1n, ['{}', []], ['=>', 0, [], 0], object, func,
        ]
        for (const value of nonIterable) {
            assertStructurallySame(assertError(array([['...', () => ok(value)], skipped])), ['undefined'])
        }
        /** @type {ItemsOver<ValueThunk>} */
        const prefix = [() => ok(1), ['...', () => ok(data)], ['...', () => ok('ab')]]
        assertStructurallySame(assertError(array([...prefix, ['...', () => ok(object)], skipped])), ['undefined'])
        assertStructurallySame(assertError(array([...prefix, ['...', () => ok(func)]])), ['undefined'])
    },
    joinEmptyAndSingletons: () => {
        assertEq(assertOk(join(['[]', []], 'unused', skipped)), '')
        assertEq(assertOk(join(['[]', [null]], '|', skipped)), '')
        assertEq(assertOk(join(['[]', [undefinedValue]], '|', skipped)), '')
        assertEq(assertOk(join(['[]', ['value']], '|', primitiveText)), 'value')
    },
    joinNullishSlots: () => {
        assertEq(assertOk(join(['[]', [null, undefinedValue, null, undefinedValue]], '|', skipped)), '|||')
        const source = /** @type {const} */ (['[]', [null, undefinedValue, 'a', null, undefinedValue, 'b', undefinedValue, null]])
        assertEq(assertOk(join(source, '|', primitiveText)), '||a|||b||')
        assertEq(assertOk(join(source, '', primitiveText)), 'ab')
        assertEq(assertOk(join(['[]', ['a', null, 'b']], '😀\ud800', primitiveText)), 'a😀\ud800😀\ud800b')
    },
    joinPrimitives: () => {
        /** @type {readonly Primitive[]} */
        const primitives = [false, true, 0, -0, NaN, Infinity, -Infinity, '', 'undefined', 0n, 1n, -1n, '😀']
        assertEq(assertOk(join(['[]', primitives], ';', primitiveText)), 'false;true;0;0;NaN;Infinity;-Infinity;;undefined;0;1;-1;😀')
    },
    joinDelegation: () => {
        /** @type {readonly (readonly [EdagValue, string])[]} */
        const answers = [[data, 'array'], [object, 'object'], [func, 'function']]
        const result = join(['[]', [data, object, func, data, object, func]], '|', value =>
            ok(assertNotNullish(answers.find(([original]) => original === value))[1]))
        assertEq(assertOk(result), 'array|object|function|array|object|function')
    },
    joinNestedArrays: () => {
        const inner = /** @type {const} */ (['[]', [1, null, 2]])
        assertEq(assertOk(join(['[]', [inner, ['[]', []], inner]], '|', value => {
            assert(typeof value === 'object' && value !== null && value[0] === '[]')
            return join(value, ',', primitiveText)
        })), '1,,2||1,,2')
    },
    joinFailures: () => {
        /** @type {readonly Values[]} */
        const sources = [['fail', 'later'], ['before', null, 'fail', 'later'], ['before', undefinedValue, 'fail']]
        for (const failure of [error(data), error(func), error(undefinedValue)]) {
            for (const source of sources) {
                assertEq(join(['[]', source], '|', value => {
                    if (value === 'fail') { return failure }
                    if (value === 'before') { return ok('converted') }
                    return skipped()
                }), failure)
            }
        }
    },
}
