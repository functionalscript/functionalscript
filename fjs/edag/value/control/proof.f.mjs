/**
 * Control flow demands only the selected operands and preserves their
 * Result tuples, including failures and represented value identities.
 *
 * @import { EdagValue } from '../types.ts'
 * @import { Exp } from '../../types.ts'
 */

import { assert, assertEq, assertOk, assertError, assertStructurallySame } from '../../../asserts/module.f.js'
import { ok, error } from '../../../types/result/module.f.js'
import { throwValue, conditional, sequence } from './module.f.mjs'
import { conditional as sourceConditional } from '../../testlib.f.mjs'
import { analysis } from '../../analysis/module.f.mjs'
import { memo } from '../../memo/module.f.mjs'

/** Canonical graph fixtures, with source logical lowering kept outside this module. @type {(graph: Exp) => ReturnType<ReturnType<typeof memo>>} */
const evaluated = graph => memo(assertOk(analysis(graph)))({ args: [] })

/** A thunk that must never be demanded. @type {() => never} */
const skipped = () => { assert(false, 'an unselected operand was evaluated') }

const data = /** @type {const} */ (['[]', [1]])
const object = /** @type {const} */ (['{}', [[':', 'value', data]]])
const func = /** @type {const} */ (['=>', 0, [data], ['frame', 0]])

/** @type {readonly EdagValue[]} */
const falsy = [null, ['undefined'], false, 0, -0, NaN, '', 0n]

/** @type {readonly EdagValue[]} */
const truthy = [
    true, 1, -1, 0.5, Infinity, -Infinity, 1n, -1n,
    'value', '0', 'undefined', '=>', '[]', '{}',
    ['[]', []], ['{}', []], ['=>', 0, [], 0], data, object, func,
]

/** @type {readonly EdagValue[]} */
const values = [...falsy, ...truthy]

export const proof = {
    sequence: {
        empty: () => {
            assertStructurallySame(sequence([]), ['ok', ['undefined']])
        },
        successes: () => {
            for (const value of values) {
                const final = ok(value)
                assertEq(sequence([() => final]), final)
                // Every successful falsy operand still reaches the final one.
                assertEq(sequence([
                    ...falsy.map(value => () => ok(value)),
                    () => final,
                ]), final)
            }
        },
        failures: () => {
            for (const value of values) {
                const failure = error(value)
                assertEq(sequence([() => failure, skipped]), failure)
                // An otherwise discarded operand can fail after successes.
                assertEq(sequence([
                    () => ok(data),
                    () => failure,
                    skipped,
                ]), failure)
            }
            const first = error(object)
            const second = error(func)
            assertEq(sequence([
                () => ok(false),
                () => first,
                () => second,
                skipped,
            ]), first)
        },
        composition: () => {
            const selected = ok(object)
            assertEq(sequence([
                () => conditional(ok(false), () => sequence([skipped]), () => ok(false)),
                () => conditional(ok(true),
                    () => sequence([() => ok(data), () => selected]),
                    () => sequence([skipped])),
            ]), selected)
            const failure = error(func)
            assertEq(sequence([
                () => conditional(ok(false), skipped,
                    () => sequence([() => ok(0), () => failure, skipped])),
                skipped,
            ]), failure)
        },
    },
    shortCircuit: () => {
        for (const value of falsy) {
            const result = ok(value)
            assertEq(conditional(result, skipped, () => result), result)
        }
        for (const value of truthy) {
            const result = ok(value)
            assertEq(conditional(result, () => result, skipped), result)
        }
    },
    conditionalSelection: () => {
        const selected = ok(func)
        for (const value of truthy) {
            assertEq(conditional(ok(value), () => selected, skipped), selected)
        }
        for (const value of falsy) {
            assertEq(conditional(ok(value), skipped, () => selected), selected)
        }
    },
    nullishSelection: () => {
        assertStructurallySame(assertOk(evaluated(sourceConditional('??', null, object))), object)
        assertStructurallySame(assertOk(evaluated(sourceConditional('??', ['undefined'], object))), object)
        // Falsy values other than null and undefined are retained.
        for (const value of [false, 0, -0, NaN, '', 0n, ...truthy]) {
            assertStructurallySame(assertOk(evaluated(sourceConditional('??', value, ['throw', 'unselected']))), value)
        }
    },
    branches: () => {
        const selected = ok(data)
        for (const value of truthy) {
            assertEq(conditional(ok(value), () => selected, skipped), selected)
        }
        for (const value of falsy) {
            assertEq(conditional(ok(value), skipped, () => selected), selected)
        }
    },
    selectedResults: () => {
        // Selected successes and failures keep their complete Result,
        // regardless of the kind or truthiness of its payload.
        for (const value of values) {
            for (const selected of [ok(value), error(value)]) {
                const right = () => selected
                assertEq(conditional(ok(true), right, skipped), selected)
                assertEq(conditional(ok(false), skipped, right), selected)
            }
            for (const [tag, left] of /** @type {const} */ ([['&&', true], ['||', false], ['??', null], ['??', ['undefined']]])) {
                assertStructurallySame(assertOk(evaluated(sourceConditional(tag, left, value))), value)
                assertStructurallySame(assertError(evaluated(sourceConditional(tag, left, ['throw', value]))), value)
            }
        }
    },
    firstFailure: () => {
        for (const value of values) {
            const failure = error(value)
            assertEq(conditional(failure, skipped, skipped), failure)
            for (const tag of /** @type {const} */ (['&&', '||', '??'])) {
                assertStructurallySame(assertError(evaluated(sourceConditional(tag, ['throw', value], ['throw', 'unselected']))), value)
            }
        }
    },
    throwValue: () => {
        for (const value of values) {
            assertEq(Object.is(assertError(throwValue(ok(value))), value), true)
            const failure = error(value)
            assertEq(throwValue(failure), failure)
        }
    },
    composition: () => {
        const selected = ok(object)
        const success = conditional(
            conditional(ok(false), skipped, () => ok(true)),
            () => conditional(ok('value'), () => selected, skipped),
            skipped,
        )
        assertEq(success, selected)
        assertEq(assertOk(success), object)
        const failure = throwValue(ok(func))
        assertEq(conditional(
            conditional(ok(false), skipped, () => failure),
            skipped,
            skipped,
        ), failure)
        assertEq(assertError(failure), func)
        const graph = sourceConditional('||', sourceConditional('??', ['undefined'], ['throw', func]), ['throw', 'unselected'])
        assertStructurallySame(assertError(evaluated(graph)), func)
    },
}
