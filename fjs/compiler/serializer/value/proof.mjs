/**
 * Compile complete generated modules at the JavaScript host boundary. Module
 * loading and ordinary callable execution are effects that FunctionalScript
 * proofs cannot perform; the sibling proof.f.mjs checks the generated text.
 * Inputs here are immutable EDAG values, including real interpreter output.
 *
 * @import { EdagValue, Function as FunctionValue } from '../../../edag/value/types.ts'
 * @import { Exp } from '../../../edag/types.ts'
 */

import { conditional } from '../../../edag/testlib.f.js'
import { throws } from 'node:assert/strict'
import { Buffer } from 'node:buffer'

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { interpret, noRuntime } from '../../transpiler/module.f.mjs'
import { virtualAt } from '../../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../../text/module.f.mjs'
import { factoryStringify, stringify } from './module.f.mjs'
import { tryStringify } from '../module.f.mjs'

/** Load actual module syntax. @type {(source: string) => Promise<any>} */
const load = async source => {
    const encoded = Buffer.from(source).toString('base64')
    const module = await import(`data:text/javascript;base64,${encoded}`)
    return module.default
}

/** Distinct source comments request fresh module instances.
 * @type {(value: EdagValue, instance?: string) => Promise<any>}
 */
const compile = (value, instance = '') => load(`${stringify(value)}\n// ${instance}`)

export const proof = {
    factoryFreshValues: async () => {
        const data = /** @type {const} */ (['[]', [4]])
        const fn = /** @type {const} */ (['=>', 0, [data], ['frame', 0]])
        const factory = await load(factoryStringify(['[]', [data, data, fn, fn]]))
        const first = factory()
        const second = factory()
        for (const [a, b, f, repeated] of [first, second]) {
            assertEq(a, b)
            assertEq(f, repeated)
            assertEq(f(), a)
            assertEq('edag' in f, false)
        }
        assert(first !== second)
        assert(first[0] !== second[0])
        assert(first[2] !== second[2])
    },
    factoryOrdinaryThen: async () => {
        const factory = await load(factoryStringify(['{}', [
            [':', 'then', ['=>', 1, [], ['()', ['arg', 0], [7]]]],
            [':', 'value', 3],
        ]]))
        // Wrap the synchronous factory result before crossing an async return;
        // an ordinary callable `then` must not make the value a host promise.
        const run = async () => ({ value: factory() })
        const { value } = await run()
        assertEq(value.value, 3)
        assertEq(value.then(/** @param {number} x */ x => x + 1), 8)
    },
    ordinaryData: async () => {
        const data = await compile(['{}', [
            [':', '__proto__', ['undefined']], [':', 'items', ['[]', [-0, 3n, 'a\n"b']]],
        ]])
        assertEq(Object.hasOwn(data, '__proto__'), true)
        assertEq(data.__proto__, undefined)
        assert(Object.is(data.items[0], -0))
        assertEq(data.items[1], 3n)
        assertEq(data.items[2], 'a\n"b')
    },
    primitiveCapture: async () => {
        const add = await compile(['=>', 1, [2], ['+', ['frame', 0], ['arg', 0]]])
        assertEq(add(3), 5)
        assertEq(add.length, 1)
        assertEq(typeof add, 'function')
        assertEq('edag' in add, false)
    },
    capturePositions: async () => {
        const shared = /** @type {const} */ (['[]', [9]])
        const get = await compile(['=>', 0, [42, shared, 42, shared, 7],
            ['[]', [['frame', 1], ['frame', 3], ['frame', 4]]],
        ])
        const [first, repeated, last] = get()
        assertEq(first, repeated)
        assertStructurallySame(first, [9])
        assertEq(last, 7)
    },
    sharedValuesAndDistinctClosures: async () => {
        const data = /** @type {const} */ (['[]', [4]])
        const first = /** @type {const} */ (['=>', 0, [data], ['frame', 0]])
        const second = /** @type {const} */ (['=>', 0, [data], ['frame', 0]])
        /** @type {EdagValue} */
        const value = ['[]', [data, data, first, first, second]]
        const [a, b, f, repeated, g] = await compile(value, 'first')
        assertEq(a, b)
        assertEq(f, repeated)
        assert(f !== g)
        assertEq(f(), a)
        assertEq(g(), a)
        const [freshData, , freshFunction] = await compile(value, 'second')
        assert(freshData !== a)
        assert(freshFunction !== f)
        assertEq(freshFunction(), freshData)
    },
    capturedAndPerInvocationValues: async () => {
        const captured = /** @type {const} */ (['[]', [4]])
        const fresh = /** @type {const} */ (['[]', [['arg', 0]]])
        const make = await compile(['=>', 1, [captured],
            ['[]', [['frame', 0], fresh, fresh]],
        ])
        const first = make(1)
        const second = make(2)
        assertEq(first[0], second[0])
        assertEq(first[1], first[2])
        assertEq(second[1], second[2])
        assert(first[1] !== second[1])
        assertStructurallySame(first, [[4], [1], [1]])
        assertStructurallySame(second, [[4], [2], [2]])
    },
    nestedFunctions: async () => {
        /** @type {FunctionValue} */
        const value = ['=>', 1, [2], ['=>', 1, [['frame', 0], ['arg', 0]],
            ['+', ['+', ['frame', 0], ['frame', 1]], ['arg', 0]],
        ]]
        const make = await compile(value)
        const add = make(3)
        assertEq(add(4), 9)
        assertEq(add.length, 1)
        assert(add !== make(3))
        assertEq('edag' in add, false)
    },
    requiredArity: async () => {
        const fn = await compile(['=>', 16, [],
            ['[]', [['arg', 0], ['arg', 15], ['rest']]],
        ])
        assertEq(fn.length, 16)
        assertStructurallySame(fn(...Array.from({ length: 18 }, (_, i) => i)), [0, 15, [16, 17]])
        assertStructurallySame(fn(3), [3, undefined, []])
    },
    ordinaryCallbacksAndData: async () => {
        const apply = await compile(['=>', 1, [], ['()', ['arg', 0], [1]]])
        assertEq(apply(/** @param {number} x */ x => x + 2), 3)
        const add = await compile(['=>', 1, [2], ['+', ['frame', 0], ['arg', 0]]])
        /** @type {(f: (x: number) => number) => number} */
        const hostCallback = f => f(1)
        assertEq(hostCallback(add), 3)
        const identity = await compile(['=>', 1, [], ['arg', 0]])
        const object = { items: [1, 2] }
        assertEq(identity(object), object)
        assertEq('edag' in identity, false)
    },
    zeroInputSourceTailLoopsKeepInvocationSnapshots: async () => {
        const snapshot = /** @type {Exp} */ (['[]', [7]])
        const read = /** @type {Exp} */ (['=>', 0, [snapshot], ['frame', 0]])
        const factory = /** @type {FunctionValue} */ (['=>', 1, [], ['=>', 0, [['arg', 0]], [',', [
            ['()', ['frame', 0], [snapshot, snapshot, read]], ['()', ['self'], []],
        ]]]])
        for (const text of [assertOk(tryStringify(factory)), stringify(factory)]) {
            assert(text.includes('while('), text)
            const make = await load(text)
            const stopped = new Error('stop after deep zero-input iteration')
            let count = 0
            /** @type {readonly number[] | undefined} */
            let previous
            const loop = make(/** @type {(first: readonly number[], second: readonly number[], read: () => readonly number[]) => void} */ ((first, second, read) => {
                assertEq(first, second)
                assertEq(read(), first)
                assert(first !== previous)
                previous = first
                count += 1
                if (count === 100_001) { throw stopped }
            }))
            assertEq(loop.length, 0)
            throws(() => loop(9), error => error === stopped)
            assertEq(count, 100_001)
        }
    },
    zeroInputNormalResultsFollowDeepLoops: async () => {
        const snapshot = /** @type {Exp} */ (['[]', [7]])
        const captured = /** @type {Exp} */ (['[]', [9]])
        const test = /** @type {Exp} */ (['()', ['frame', 0], [snapshot, snapshot]])
        const recur = /** @type {Exp} */ (['()', ['self'], []])
        const result = /** @type {Exp} */ (['[]', [['frame', 1], ['frame', 1], ['=>', 0, [['frame', 1]], ['frame', 0]]]])
        for (const inverted of /** @type {const} */ ([false, true])) {
            const factory = /** @type {FunctionValue} */ (['=>', 1, [], ['=>', 0, [['arg', 0], captured],
                ['?:', inverted ? ['!', test] : test, inverted ? result : recur, inverted ? recur : result],
            ]])
            for (const text of [assertOk(tryStringify(factory)), stringify(factory)]) {
                assert(text.includes('while('), text)
                const make = await load(text)
                let count = 0
                /** @type {readonly number[] | undefined} */
                let previous
                const loop = make(/** @type {(first: readonly number[], second: readonly number[]) => boolean} */ ((first, second) => {
                    assertEq(first, second)
                    assert(first !== previous)
                    previous = first
                    count += 1
                    return count <= 100_000
                }))
                assertEq(loop.length, 0)
                const first = loop(1, 2)
                assertEq(count, 100_001)
                count = 0
                const second = loop()
                assertEq(count, 100_001)
                assert(first !== second)
                assertEq(first[0], first[1])
                assertEq(first[0], second[0])
                assertEq(first[2](), first[0])
                assertEq(second[2](), second[0])
                assert(first[2] !== second[2])
                assertStructurallySame(first[0], [9])
            }
        }
    },
    multiInputSourceLoopsKeepIterationSnapshots: async () => {
        const sum = /** @type {FunctionValue} */ (['=>', 2, [], ['?:', ['>', ['arg', 0], 0],
            ['()', ['self'], [['-', ['arg', 0], 1], ['+', ['arg', 1], ['arg', 0]]]], ['arg', 1]]])
        for (const text of [assertOk(tryStringify(sum)), stringify(sum)]) {
            assert(text.includes('while('), text)
            const run = await load(text)
            assertEq(run.length, 2)
            assertEq(run(100_000, 0), 5_000_050_000)
        }
        const snapshot = /** @type {Exp} */ (['[]', [['arg', 0], ['arg', 1], ['arg', 2]]])
        const read = /** @type {Exp} */ (['=>', 0, [snapshot], ['frame', 0]])
        const saved = /** @type {Exp} */ (['=>', 0, [['arg', 0], ['arg', 1], ['arg', 2], ['frame', 1]],
            ['[]', [['frame', 0], ['frame', 1], ['frame', 2], ['frame', 3]]]])
        const factory = /** @type {FunctionValue} */ (['=>', 1, [], ['=>', 4, [['arg', 0], ['[]', [9]]],
            ['?:', ['>', ['arg', 0], 0], [',', [
                ['()', ['frame', 0], [snapshot, snapshot, read]],
                ['()', ['self'], [['-', ['arg', 0], 1], ['arg', 2], ['arg', 1], saved]],
            ]], ['[]', [['arg', 1], ['arg', 2], ['arg', 3], ['frame', 1]]]],
        ]])
        for (const text of [assertOk(tryStringify(factory)), stringify(factory)]) {
            const make = await load(text)
            let count = 0
            /** @type {readonly number[] | undefined} */
            let previous
            const run = make(/** @type {(first: readonly number[], second: readonly number[], read: () => readonly number[]) => void} */ ((first, second, read) => {
                assertEq(first, second)
                assertEq(read(), first)
                assert(first !== previous)
                assertEq(first[0], 100_001 - count)
                previous = first
                count += 1
            }))
            assertEq(run.length, 4)
            const first = run(100_001, 1, 2, null)
            assertEq(count, 100_001)
            count = 0
            const second = run(100_001, 1, 2, null)
            assertEq(count, 100_001)
            assert(first !== second)
            assertStructurallySame(first.slice(0, 2), [2, 1])
            assert(first[2] !== second[2])
            assertEq(first[3], second[3])
            const final = first[2]()
            assertStructurallySame(final, [1, 1, 2, [9]])
            assertEq(final[3], first[3])
        }
    },
    restSourceLoopsKeepFreshInvocationArrays: async () => {
        const sum = /** @type {FunctionValue} */ (['=>', 1, [], ['?:', ['>', ['arg', 0], 0],
            ['()', ['self'], [['-', ['arg', 0], 1], ['+', ['.', ['rest'], 0], ['arg', 0]]]], ['.', ['rest'], 0]]])
        for (const text of [assertOk(tryStringify(sum)), stringify(sum)]) {
            assert(text.includes('while('), text)
            const run = await load(text)
            assertEq(run.length, 1)
            assertEq(run(100_000, 0), 5_000_050_000)
        }
        const read = /** @type {Exp} */ (['=>', 0, [['rest']], ['frame', 0]])
        const recur = /** @type {Exp} */ ([',', [
            ['()', ['frame', 0], [['rest'], ['rest'], read]],
            ['()', ['self'], [['-', ['arg', 0], 1], read, ['...', ['rest']]]],
        ]])
        const result = /** @type {Exp} */ (['[]', [['arg', 1], ['rest'], ['frame', 1]]])
        const input = /** @type {const} */ ([4])
        for (const reversed of /** @type {const} */ ([false, true])) {
            const test = /** @type {Exp} */ (['>', ['arg', 0], 0])
            const factory = /** @type {FunctionValue} */ (['=>', 1, [], ['=>', 2, [['arg', 0], ['[]', [9]]],
                ['?:', reversed ? ['!', test] : test, reversed ? result : recur, reversed ? recur : result],
            ]])
            for (const text of [assertOk(tryStringify(factory)), stringify(factory)]) {
                assert(text.includes('while('), text)
                const make = await load(text)
                let count = 0
                /** @type {readonly unknown[] | undefined} */
                let previous
                const run = make(/** @type {(first: readonly unknown[], second: readonly unknown[], read: () => readonly unknown[]) => void} */ ((first, second, read) => {
                    assertEq(first, second)
                    assertEq(read(), first)
                    assert(first !== previous)
                    assertEq(first.length, 1)
                    assertEq(first[0], input)
                    previous = first
                    count += 1
                }))
                assertEq(run.length, 2)
                const first = run(100_000, null, input)
                assertEq(count, 100_000)
                assertEq(first[0](), previous)
                assert(first[1] !== previous)
                assertEq(first[1][0], input)
                count = 0
                const second = run(100_000, null, input)
                assertEq(count, 100_000)
                assertEq(second[0](), previous)
                assert(second[1] !== previous)
                assert(first[0] !== second[0])
                assert(first[1] !== second[1])
                assertEq(second[1][0], input)
                assertEq(first[2], second[2])
                assertStructurallySame(first[2], [9])
            }
        }
    },
    baseFirstRestOnlyLoopsKeepFreshSnapshots: async () => {
        const count = /** @type {Exp} */ (['.', ['rest'], 0])
        const total = /** @type {Exp} */ (['.', ['rest'], 1])
        const next = /** @type {Exp} */ (['()', ['self'], [['-', count, 1], ['+', total, count]]])
        const sum = /** @type {FunctionValue} */ (['=>', 0, [], ['?:', ['===', count, 0], total, next]])
        for (const text of [assertOk(tryStringify(sum)), stringify(sum)]) {
            assert(text.includes('while('), text)
            const run = await load(text)
            assertEq(run.length, 0)
            assertEq(run(100_000, 0), 5_000_050_000)
        }
        const saved = /** @type {Exp} */ (['=>', 0, [['rest']], ['frame', 0]])
        const read = /** @type {Exp} */ (['=>', 0, [['rest'], ['frame', 1]], ['[]', [['frame', 0], ['frame', 1]]]])
        const result = /** @type {Exp} */ (['[]', [['rest'], ['rest'], read, ['frame', 1]]])
        const test = /** @type {Exp} */ (['()', ['frame', 0], [['rest'], ['rest']]])
        for (const held of /** @type {const} */ ([false, true])) {
            const factory = /** @type {FunctionValue} */ (['=>', 1, [], ['=>', 0, [['arg', 0], ['[]', [9]]],
                ['?:', ['!', test], result, ['()', ['self'], held ? [saved] : []]],
            ]])
            for (const text of [assertOk(tryStringify(factory)), stringify(factory)]) {
                assert(text.includes('while('), text)
                const make = await load(text)
                let count = 0
                /** @type {readonly unknown[] | undefined} */
                let previous
                const run = make(/** @type {(first: readonly unknown[], second: readonly unknown[]) => boolean} */ ((first, second) => {
                    assertEq(first, second)
                    assert(first !== previous)
                    assertEq(first.length, held && count !== 0 ? 1 : 0)
                    if (held && count !== 0) { assertEq(/** @type {() => readonly unknown[]} */ (first[0])(), previous) }
                    previous = first
                    count += 1
                    return count <= 100_000
                }))
                assertEq(run.length, 0)
                const first = run()
                assertEq(count, 100_001)
                assertEq(first[0], previous)
                assertEq(first[0], first[1])
                assertEq(first[2]()[0], first[0])
                assertEq(first[2]()[1], first[3])
                count = 0
                const second = run()
                assertEq(count, 100_001)
                assertEq(second[0], previous)
                assertEq(second[0], second[1])
                assertEq(second[2]()[0], second[0])
                assert(first !== second)
                assert(first[0] !== second[0])
                assert(first[2] !== second[2])
                assertEq(first[3], second[3])
                assertStructurallySame(first[3], [9])
            }
        }
    },
    baseCaseDefinitionsRunOnceWithFinalSnapshots: async () => {
        const recur = /** @type {Exp} */ (['()', ['self'], [['-', ['arg', 0], 1], ['+', ['arg', 1], ['arg', 0]]]])
        const shared = /** @type {Exp} */ (['[]', [['arg', 1]]])
        const sum = /** @type {FunctionValue} */ (['=>', 2, [], ['?:', ['>', ['arg', 0], 0], recur, ['[]', [shared, shared]]]])
        for (const text of [assertOk(tryStringify(sum)), stringify(sum)]) {
            assert(text.includes('while('), text)
            const run = await load(text)
            assertEq(run.length, 2)
            const first = run(100_000, 0)
            const second = run(100_000, 0)
            assertEq(first[0], first[1])
            assert(first !== second)
            assert(first[0] !== second[0])
            assertStructurallySame(first, [[5_000_050_000], [5_000_050_000]])
        }
        const snapshot = /** @type {Exp} */ (['[]', [['arg', 0], ['arg', 1]]])
        const base = /** @type {Exp} */ (['()', ['frame', 1], [snapshot, snapshot, ['frame', 2]]])
        const read = /** @type {Exp} */ (['=>', 0, [['arg', 0], ['arg', 1], base, ['frame', 2]],
            ['[]', [['frame', 0], ['frame', 1], ['frame', 2], ['frame', 3]]]])
        const result = /** @type {Exp} */ (['[]', [base, base, read, ['frame', 2]]])
        const test = /** @type {Exp} */ (['()', ['frame', 0], [['arg', 0], ['arg', 1]]])
        for (const reversed of /** @type {const} */ ([false, true])) {
            const factory = /** @type {FunctionValue} */ (['=>', 2, [], ['=>', 2, [['arg', 0], ['arg', 1], ['[]', [9]]],
                ['?:', reversed ? ['!', test] : test, reversed ? result : recur, reversed ? recur : result],
            ]])
            for (const text of [assertOk(tryStringify(factory)), stringify(factory)]) {
                assert(text.includes('while('), text)
                const make = await load(text)
                let tests = 0
                let bases = 0
                let start = 0
                /** @type {readonly number[] | undefined} */
                let previous
                const run = make(
                    /** @type {(n: number, a: number) => boolean} */ ((n, a) => {
                        assertEq(n, start - tests)
                        tests += 1
                        return n > 0
                    }),
                    /** @type {(first: readonly number[], second: readonly number[], seed: readonly number[]) => readonly unknown[]} */ ((first, second, seed) => {
                        assertEq(tests, start + 1)
                        assertEq(bases, 0)
                        assertEq(first, second)
                        assert(first !== previous)
                        previous = first
                        bases += 1
                        return [first[0], first[1], seed]
                    }),
                )
                assertEq(run.length, 2)
                /** @param {number} n @param {number} initial @param {number} expected */
                const invoke = (n, initial, expected) => {
                    start = n
                    tests = 0
                    bases = 0
                    const value = run(n, initial)
                    assertEq(tests, n + 1)
                    assertEq(bases, 1)
                    assertEq(value[0], value[1])
                    assertEq(value[0][0], 0)
                    assertEq(value[0][1], expected)
                    assertEq(value[0][2], value[3])
                    const captured = value[2]()
                    assertStructurallySame(captured.slice(0, 2), [0, expected])
                    assertEq(captured[2], value[0])
                    assertEq(captured[3], value[3])
                    return value
                }
                for (const [n, initial, expected] of /** @type {const} */ ([[100_000, 0, 5_000_050_000], [0, 7, 7]])) {
                    const first = invoke(n, initial, expected)
                    const second = invoke(n, initial, expected)
                    assert(first !== second)
                    assert(first[0] !== second[0])
                    assert(first[2] !== second[2])
                    assertEq(first[3], second[3])
                    assertStructurallySame(first[3], [9])
                }
            }
        }
    },
    restBaseDefinitionsKeepFinalInvocationSnapshots: async () => {
        const restRead = /** @type {Exp} */ (['=>', 0, [['rest']], ['frame', 0]])
        const snapshot = /** @type {Exp} */ (['[]', [['arg', 0], ['rest']]])
        const base = /** @type {Exp} */ (['()', ['frame', 1], [snapshot, snapshot, ['frame', 2]]])
        const read = /** @type {Exp} */ (['=>', 0, [['arg', 0], ['rest'], base, ['frame', 2]],
            ['[]', [['frame', 0], ['frame', 1], ['frame', 2], ['frame', 3]]]])
        const result = /** @type {Exp} */ (['[]', [base, base, read, ['rest'], ['frame', 2]]])
        const test = /** @type {Exp} */ (['()', ['frame', 0], [['arg', 0], ['rest'], ['rest'], restRead]])
        const token = /** @type {const} */ ([7])
        for (const arity of /** @type {const} */ ([1, 2, 16])) {
            /** @type {readonly Exp[]} */
            const fixed = Array.from({ length: arity }, (_, index) => index === 0 ? ['-', ['arg', 0], 1] : ['arg', index])
            const recur = /** @type {Exp} */ (['()', ['self'], [...fixed, ['...', ['rest']]]])
            const padding = Array.from({ length: arity - 1 }, (_, index) => index + 10)
            for (const reversed of /** @type {const} */ ([false, true])) {
                const factory = /** @type {FunctionValue} */ (['=>', 2, [], ['=>', arity, [['arg', 0], ['arg', 1], ['[]', [9]]],
                    ['?:', reversed ? ['!', test] : test, reversed ? result : recur, reversed ? recur : result],
                ]])
                for (const text of [assertOk(tryStringify(factory)), stringify(factory)]) {
                    assert(text.includes('while('), text)
                    const make = await load(text)
                    const stopped = new Error('stop at the final rest invocation')
                    let start = 0
                    let tests = 0
                    let bases = 0
                    let mode = 'normal'
                    /** @type {readonly unknown[] | undefined} */
                    let previous
                    /** @type {readonly unknown[] | undefined} */
                    let heldRest
                    /** @type {(() => readonly unknown[]) | undefined} */
                    let held
                    const run = make(
                        /** @type {(n: number, first: readonly unknown[], second: readonly unknown[], read: () => readonly unknown[]) => boolean} */ ((n, first, second, read) => {
                            assertEq(n, start - tests)
                            assertEq(first, second)
                            assertEq(read(), first)
                            assert(first !== previous)
                            if (tests === 0) { held = read; heldRest = first }
                            previous = first
                            tests += 1
                            if (mode === 'condition' && n === 0) { throw stopped }
                            return n > 0
                        }),
                        /** @type {(first: readonly unknown[], second: readonly unknown[], seed: readonly number[]) => readonly unknown[]} */ ((first, second, seed) => {
                            assertEq(tests, start + 1)
                            assertEq(bases, 0)
                            assertEq(first, second)
                            assertEq(first[0], 0)
                            assertEq(first[1], previous)
                            bases += 1
                            if (mode === 'base') { throw stopped }
                            return first
                        }),
                    )
                    assertEq(run.length, arity)
                    for (const nonempty of /** @type {const} */ ([false, true])) {
                        const supplied = nonempty ? [token] : []
                        /** @param {number} n */
                        const invoke = n => {
                            start = n
                            tests = 0
                            bases = 0
                            mode = 'normal'
                            previous = undefined
                            const value = run(n, ...padding, ...supplied)
                            assertEq(tests, n + 1)
                            assertEq(bases, 1)
                            assertEq(value[0], value[1])
                            assertEq(value[0][1], value[3])
                            assertEq(value[3], previous)
                            assertEq(value[3].length, supplied.length)
                            if (nonempty) { assertEq(value[3][0], token) }
                            assertStructurallySame(value[0], [0, supplied])
                            const captured = value[2]()
                            assertEq(captured[0], 0)
                            assertEq(captured[1], value[3])
                            assertEq(captured[2], value[0])
                            assertEq(captured[3], value[4])
                            assert(held !== undefined)
                            assertEq(held(), heldRest)
                            assertEq(heldRest === value[3], n === 0)
                            return value
                        }
                        for (const n of /** @type {const} */ ([100_000, 0])) {
                            const first = invoke(n)
                            const second = invoke(n)
                            const retained = first[2]()
                            assertEq(retained[1], first[3])
                            assertEq(retained[2], first[0])
                            assertEq(retained[3], first[4])
                            assert(first !== second)
                            assert(first[0] !== second[0])
                            assert(first[2] !== second[2])
                            assert(first[3] !== second[3])
                            assertEq(first[4], second[4])
                            assertStructurallySame(first[4], [9])
                        }
                        for (const failureAt of /** @type {const} */ (['condition', 'base'])) {
                            start = 2
                            tests = 0
                            bases = 0
                            mode = failureAt
                            previous = undefined
                            throws(() => run(2, ...padding, ...supplied), error => error === stopped)
                            assertEq(tests, 3)
                            assertEq(bases, failureAt === 'base' ? 1 : 0)
                        }
                    }
                }
            }
        }
    },
    continuedCallArguments: async () => {
        const array = /** @type {const} */ (['[]', []])
        const pair = /** @type {const} */ (['[]', [array, array]])
        const receiver = {
            /** @param {readonly unknown[]} values */
            y(values) { assertEq(this, receiver); return values },
        }
        /** @type {readonly (readonly [Exp, unknown])[]} */
        const cases = [
            [['.', ['.', ['arg', 0], 'x'], 'y', ['|()', [pair]]], { x: receiver }],
            [['?.', ['arg', 0], 'x', ['|.', 'y', ['|()', [pair]]]], { x: receiver }],
            [['.', ['arg', 0], 'x', ['|?.()', [], ['|.', 'y', ['|()', [pair]]]]], { x: () => receiver }],
            [['?.', ['arg', 0], 'x', ['|.', ['Number', 0], ['|?.()', [pair]]]], { x: [/** @param {unknown} values */ values => values] }],
        ]
        for (const [body, input] of cases) {
            const graph = /** @type {FunctionValue} */ (['=>', 1, [], body])
            // Exercise both public source output and callable runtime output.
            for (const text of [assertOk(tryStringify(graph)), stringify(graph)]) {
                const fn = await load(text)
                const first = fn(input)
                const second = fn(input)
                assertEq(first[0], first[1])
                assertEq(second[0], second[1])
                assert(first[0] !== second[0])
                assertStructurallySame(first, [[], []])
            }
        }
        const failure = /** @type {const} */ (['.', null, 'x'])
        /** @type {readonly (readonly [Exp, unknown, unknown])[]} */
        const guarded = [
            [['?.', ['arg', 0], 'x', ['|.', 'y', ['|()', [failure]]]], null, { x: receiver }],
            [['.', ['arg', 0], 'x', ['|?.()', [], ['|.', 'y', ['|()', [failure]]]]], { x: null }, { x: () => receiver }],
            [['?.', ['arg', 0], 'x', ['|.', ['Number', 0], ['|?.()', [failure]]]], { x: [null] }, { x: [/** @param {unknown} values */ values => values] }],
        ]
        for (const [body, skipped, demanded] of guarded) {
            const graph = /** @type {FunctionValue} */ (['=>', 1, [], body])
            for (const text of [assertOk(tryStringify(graph)), stringify(graph)]) {
                const fn = await load(text)
                assertEq(fn(skipped), undefined)
                throws(() => fn(demanded), TypeError)
            }
        }
    },
    thrownCaptureIdentity: async () => {
        const payload = /** @type {const} */ (['{}', [[':', 'message', 'failure']]])
        const fail = /** @type {const} */ (['=>', 0, [payload], ['throw', ['frame', 0]]])
        const [ordinaryPayload, ordinaryFail] = await compile(['[]', [payload, fail]])
        throws(() => ordinaryFail(), thrown => thrown === ordinaryPayload)
        assertStructurallySame(ordinaryPayload, { message: 'failure' })
    },
    lazySharedBody: async () => {
        const shared = /** @type {const} */ (['[]', []])
        const fn = await compile(['=>', 2, [], ['[]', [
            conditional('&&', ['arg', 0], shared), conditional('||', ['arg', 1], shared),
        ]]])
        const first = fn(true, false)
        const second = fn(true, false)
        assertEq(first[0], first[1])
        assertEq(second[0], second[1])
        assert(first[0] !== second[0])
        assertStructurallySame(fn(false, true), [false, true])
    },
    interpretedModule: async () => {
        const root = {
            main: [utf8('import add from "./dep"; const f=add(2); export const call=f; export default [f,f];')],
            dep: [utf8('export default x=>y=>x+y;')],
        }
        const [, result] = virtualAt(root)(interpret(noRuntime)('main'))
        const exports = await compile(assertOk(result))
        assertEq(exports.call(3), 5)
        assertEq(exports.default[0], exports.call)
        assertEq(exports.default[1], exports.call)
        assertEq('edag' in exports.call, false)
    },
}
