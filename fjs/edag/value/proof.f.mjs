/**
 * Value-form shape checks: recursive data and evaluated captures are accepted;
 * computations, spreads and unresolved keys belong only in function bodies.
 *
 * @import { Unknown } from '../../rtti/ts/types.ts'
 */

import { assertEq, assertError, assertOk } from '../../asserts/module.f.js'
import { validate } from '../../rtti/validate/module.f.js'
import { parse } from '../../rtti/parse/module.f.js'
import { toData, validate as dataValidate } from '../../rtti/data/module.f.mjs'
import { exp } from '../module.f.js'
import { _value, value, values, array, property, object, func } from './module.f.js'

/** Every accepted value shape is also an EDAG expression shape. @type {(v: Unknown) => void} */
const accept = v => {
    assertOk(validate(value)(v))
    assertOk(validate(exp)(v))
}

/** @type {(v: Unknown) => void} */
const reject = v => { assertError(validate(value)(v)) }

export const proof = /** @type {const} */ ({
    primitives: () => {
        for (const v of [null, false, true, 0, -0, NaN, Infinity, '', 'value', 0n]) {
            accept(v)
        }
        accept(['undefined'])
        reject(undefined)
    },
    recursiveData: () => {
        accept(['[]', []])
        accept(['{}', []])
        accept(['[]', [1, ['{}', [[':', 'x', ['[]', [['undefined']]]]]]]])
        accept(['{}', [[':', '__proto__', 1], [':', 'undefined', ['undefined']]]])
    },
    recursiveConsumers: () => {
        const dataReader = dataValidate(toData(value))
        const parser = parse(value)
        const nested = /** @type {const} */ (['{}', [[':', 'stored', ['[]', [
            ['=>', 1, [['{}', [[':', 'captured', ['undefined']]]]], ['+', ['arg', 0], ['frame', 0]]],
        ]]]]])
        accept(nested)
        assertOk(parser(nested))
        assertOk(dataReader(nested))
        const computationInCapture = /** @type {const} */ (['=>', 0, [['[]', [['+', 1, 2]]]], ['undefined']])
        reject(computationInCapture)
        assertError(parser(computationInCapture))
        assertError(dataReader(computationInCapture))
    },
    functions: () => {
        accept(['=>', 0, [], ['undefined']])
        accept(['=>', 1, [2], ['+', ['frame', 0], ['arg', 0]]])
        accept(['=>', 0, [['[]', [1]], ['=>', 0, [], 2]], ['rest']])
        // A nested function's slots are expressions in the invocation body,
        // even though captures of the already evaluated outer value are not.
        accept(['=>', 1, [], ['=>', 0, [['+', ['arg', 0], 1]], ['frame', 0]]])
    },
    schemas: () => {
        assertEq(value, _value)
        assertOk(validate(_value)(['undefined']))
        assertOk(validate(values)([1, ['undefined'], ['[]', []]]))
        assertOk(validate(array)(['[]', [1]]))
        assertOk(validate(property)([':', 'x', 1]))
        assertOk(validate(object)(['{}', [[':', 'x', 1]]]))
        assertOk(validate(func)(['=>', 1, [2], ['arg', 0]]))
    },
    computations: () => {
        for (const node of [
            ['args'], ['rest'], ['arg', 0], ['frame', 0],
            ['+', 1, 2], ['()', ['=>', 0, [], 1], []], ['throw', 1],
        ]) {
            reject(node)
        }
        reject([])
        reject([1, 2])
        reject({ x: 1 })
    },
    unevaluatedData: () => {
        reject(['[]', [['+', 1, 2]]])
        reject(['[]', [['...', ['[]', [1]]]]])
        reject(['{}', [['...', ['{}', []]]]])
        reject(['{}', [[':', 1, 2]]])
        reject(['{}', [[':', ['+', 'a', 'b'], 2]]])
        reject(['{}', [[':', 'x', ['arg', 0]]]])
        reject(['=>', 0, [['+', 1, 2]], 3])
        reject(['=>', 0, [['...', ['[]', []]]], 3])
    },
    closedTuples: () => {
        for (const node of [
            ['undefined', 1], ['[]'], ['[]', [], 1],
            ['{}'], ['{}', [], 1], ['{}', [[':', 'x']]],
            ['{}', [[':', 'x', 1, 2]]],
            ['=>', 0, []], ['=>', 0, [], 1, 2],
        ]) {
            reject(node)
        }
    },
    sharedIdentity: () => {
        const shared = /** @type {const} */ (['[]', [1]])
        const input = /** @type {const} */ (['[]', [shared, shared]])
        assertEq(assertOk(validate(value)(input)), input)
    },
})
