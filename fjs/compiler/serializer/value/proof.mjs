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
    zeroInputBaseDefinitionsRunOnceAfterFinalTest: async () => {
        const snapshot = /** @type {Exp} */ (['[]', [7]])
        const readSnapshot = /** @type {Exp} */ (['=>', 0, [snapshot], ['frame', 0]])
        const test = /** @type {Exp} */ (['()', ['frame', 0], [snapshot, snapshot, readSnapshot]])
        const baseSnapshot = /** @type {Exp} */ (['[]', [['frame', 2]]])
        const base = /** @type {Exp} */ (['()', ['frame', 1], [baseSnapshot, baseSnapshot, ['frame', 2]]])
        const read = /** @type {Exp} */ (['=>', 0, [base, ['frame', 2]], ['[]', [['frame', 0], ['frame', 1]]]])
        const result = /** @type {Exp} */ (['[]', [base, base, read, ['frame', 2]]])
        const recur = /** @type {Exp} */ (['()', ['self'], []])
        for (const reversed of /** @type {const} */ ([false, true])) {
            const factory = /** @type {FunctionValue} */ (['=>', 2, [], ['=>', 0, [['arg', 0], ['arg', 1], ['[]', [9]]],
                ['?:', reversed ? ['!', test] : test, reversed ? result : recur, reversed ? recur : result],
            ]])
            for (const text of [assertOk(tryStringify(factory)), stringify(factory)]) {
                assert(text.includes('while('), text)
                const make = await load(text)
                for (const returnSeed of /** @type {const} */ ([false, true])) {
                    const stopped = new Error('stop at the final zero-input invocation')
                    let start = 0
                    let tests = 0
                    let bases = 0
                    let mode = 'normal'
                    /** @type {readonly number[] | undefined} */
                    let previous
                    /** @type {readonly number[] | undefined} */
                    let heldSnapshot
                    /** @type {(() => readonly number[]) | undefined} */
                    let held
                    /** @type {readonly unknown[] | undefined} */
                    let observedBase
                    const run = make(
                        /** @type {(first: readonly number[], second: readonly number[], read: () => readonly number[]) => boolean} */ ((first, second, read) => {
                            assertEq(first, second)
                            assertEq(read(), first)
                            assert(first !== previous)
                            assertStructurallySame(first, [7])
                            if (tests === 0) { held = read; heldSnapshot = first }
                            previous = first
                            tests += 1
                            if (mode === 'condition' && tests === start + 1) { throw stopped }
                            return tests <= start
                        }),
                        /** @type {(first: readonly unknown[], second: readonly unknown[], seed: readonly number[]) => readonly unknown[]} */ ((first, second, seed) => {
                            assertEq(tests, start + 1)
                            assertEq(bases, 0)
                            assertEq(first, second)
                            assertEq(first[0], seed)
                            assert(first !== observedBase)
                            observedBase = first
                            bases += 1
                            if (mode === 'base') { throw stopped }
                            return returnSeed ? seed : first
                        }),
                    )
                    assertEq(run.length, 0)
                    /** @param {number} n */
                    const invoke = n => {
                        start = n
                        tests = 0
                        bases = 0
                        mode = 'normal'
                        previous = undefined
                        const value = run(11, 12)
                        assertEq(tests, n + 1)
                        assertEq(bases, 1)
                        assertEq(value[0], value[1])
                        assertEq(value[0], returnSeed ? value[3] : observedBase)
                        assertEq(value[2]()[0], value[0])
                        assertEq(value[2]()[1], value[3])
                        assertStructurallySame(value[3], [9])
                        assert(held !== undefined)
                        assertEq(held(), heldSnapshot)
                        assertEq(heldSnapshot === previous, n === 0)
                        return value
                    }
                    const first = invoke(100_000)
                    const firstHeld = held
                    const firstSnapshot = heldSnapshot
                    const second = invoke(0)
                    assert(first !== second)
                    assertEq(first[0] === second[0], returnSeed)
                    assert(first[2] !== second[2])
                    assertEq(first[3], second[3])
                    assertEq(first[2]()[0], first[0])
                    assertEq(first[2]()[1], first[3])
                    assert(firstHeld !== undefined)
                    assertEq(firstHeld(), firstSnapshot)
                    assert(firstSnapshot !== heldSnapshot)
                    for (const failureAt of /** @type {const} */ (['condition', 'base'])) {
                        start = 2
                        tests = 0
                        bases = 0
                        mode = failureAt
                        previous = undefined
                        throws(() => run(), error => error === stopped)
                        assertEq(tests, 3)
                        assertEq(bases, failureAt === 'base' ? 1 : 0)
                    }
                }
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
    explicitThrowRootsKeepOrderIdentityAndBoundedStack: async () => {
        const tokenA = /** @type {const} */ ([7])
        const tokenB = /** @type {const} */ ([9])
        for (const [arity, parameters, n, a, b, rest] of /** @type {const} */ ([
            [3, 'n,a,b', 'n', 'a', 'b', 'null'],
            [1, 'n,...xs', 'n', 'xs[0]', 'xs[1]', 'xs'],
            [0, '...xs', 'xs[0]', 'xs[1]', 'xs[2]', 'xs'],
        ])) {
            const hasRest = rest !== 'null'
            for (const inverted of /** @type {const} */ ([false, true])) {
                for (const mixed of /** @type {const} */ ([false, true])) {
                    const values = /** @type {const} */ ('pair,object,read,established')
                    const suffix = hasRest ? `,...spread(${values})` : `,ignored(${values}),...spread(${values})`
                    const swap = `f(argument(0,${n}-1,${values}),argument(1,${b},${values}),argument(2,${a},${values})${suffix})`
                    const keep = `f(argument(0,${n}-1,${values}),argument(1,${a},${values}),argument(2,${b},${values})${suffix})`
                    const next = `return choose(${values})?${swap}:${keep};`
                    const exit = `${mixed ? `if(normal(${values})){return finish(${values});}` : ''}throw finish(${values});`
                    const decision = inverted ? `if(!test(${values})){${next}}${exit}` : `if(test(${values})){${exit}}${next}`
                    const source = `export default(before,test,choose,argument,ignored,spread,normal,finish)=>{const f=(${parameters})=>{const pair=[${n},${a},${b},${rest},f];const object={pair};const read=()=>[pair,object,${n},${a},${b},${rest},f];const established=before(pair,object,read);${decision}};return f;};`
                    const [, interpreted] = virtualAt({ main: [utf8(source)] })(interpret(noRuntime)('main'))
                    const graph = assertOk(interpreted)
                    for (const text of [assertOk(tryStringify(graph)), stringify(graph)]) {
                        assert(text.includes('while('), text)
                        const make = (await load(text)).default
                        const stopped = new Error('failure before the explicit source throw')
                        let start = 0
                        let visits = 0
                        let steps = 0
                        let mode = 'throw'
                        let selected = true
                        /** @type {unknown} */
                        let expectedA = tokenA
                        /** @type {unknown} */
                        let expectedB = tokenB
                        /** @type {readonly unknown[] | undefined} */
                        let previousPair
                        /** @type {unknown} */
                        let previousObject
                        /** @type {(() => readonly unknown[]) | undefined} */
                        let previousRead
                        /** @type {unknown} */
                        let previousRest
                        /** @type {(() => readonly unknown[]) | undefined} */
                        let firstRead
                        /** @type {string[]} */
                        let events = []
                        /** @param {string} name */
                        const event = name => {
                            if (start < 10) { events.push(`${visits}:${name}`) }
                            if (mode === name && (name === 'normal' || name === 'payload' || visits === 2)) { throw stopped }
                        }
                        /** @type {(pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => void} */
                        const shared = (pair, object, read, established) => {
                            assertEq(pair, previousPair)
                            assertEq(object, previousObject)
                            assertEq(read, previousRead)
                            assertEq(established, object)
                            const captured = read()
                            assertEq(captured[0], pair)
                            assertEq(captured[1], object)
                            assertEq(captured[2], pair[0])
                            assertEq(captured[3], pair[1])
                            assertEq(captured[4], pair[2])
                            assertEq(captured[5], pair[3])
                            assertEq(captured[6], run)
                        }
                        const run = make(
                            /** @type {(pair: readonly unknown[], object: { readonly pair: readonly unknown[] }, read: () => readonly unknown[]) => unknown} */ ((pair, object, read) => {
                                assertEq(pair[0], start - steps)
                                assertEq(pair[1], expectedA)
                                assertEq(pair[2], expectedB)
                                assertEq(pair[4], run)
                                assertEq(object.pair, pair)
                                assert(pair !== previousPair && object !== previousObject && read !== previousRead)
                                const currentRest = pair[3]
                                if (hasRest) {
                                    assert(currentRest instanceof Array && currentRest !== previousRest)
                                    assertEq(currentRest.length, arity === 0 ? 3 : 2)
                                    assertEq(currentRest[arity === 0 ? 1 : 0], expectedA)
                                    assertEq(currentRest[arity === 0 ? 2 : 1], expectedB)
                                    previousRest = currentRest
                                } else { assertEq(currentRest, null) }
                                previousPair = pair
                                previousObject = object
                                previousRead = read
                                if (visits === 0) { firstRead = read }
                                visits += 1
                                event('prefix')
                                return object
                            }),
                            /** @type {(pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => boolean} */ ((pair, object, read, established) => {
                                shared(pair, object, read, established)
                                event('condition')
                                return pair[0] === 0
                            }),
                            /** @type {(pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => boolean} */ ((pair, object, read, established) => {
                                shared(pair, object, read, established)
                                event('choice')
                                selected = (start - steps) % 2 === 0
                                return selected
                            }),
                            /** @type {(index: number, value: unknown, pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => unknown} */ ((index, value, pair, object, read, established) => {
                                shared(pair, object, read, established)
                                event(`argument${index}`)
                                assertEq(value, index === 0 ? start - steps - 1 : index === 1 ? selected ? expectedB : expectedA : selected ? expectedA : expectedB)
                                return value
                            }),
                            /** @type {(pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => unknown} */ ((pair, object, read, established) => {
                                shared(pair, object, read, established)
                                event('ignored')
                                return object
                            }),
                            /** @type {(pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => readonly unknown[]} */ ((pair, object, read, established) => {
                                shared(pair, object, read, established)
                                event('spread')
                                if (selected) { const previousA = expectedA; expectedA = expectedB; expectedB = previousA }
                                steps += 1
                                return []
                            }),
                            /** @type {(pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => boolean} */ ((pair, object, read, established) => {
                                shared(pair, object, read, established)
                                event('normal')
                                return mode === 'return'
                            }),
                            /** @type {(pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => unknown} */ ((pair, object, read, established) => {
                                shared(pair, object, read, established)
                                event('payload')
                                assertEq(pair[0], 0)
                                return object
                            }),
                        )
                        assertEq(run.length, arity)
                        /** @param {number} initial @param {unknown} first @param {unknown} second @param {string} outcome */
                        const invoke = (initial, first, second, outcome) => {
                            start = initial
                            visits = 0
                            steps = 0
                            mode = outcome
                            expectedA = first
                            expectedB = second
                            previousPair = undefined
                            previousObject = undefined
                            previousRead = undefined
                            previousRest = undefined
                            firstRead = undefined
                            events = []
                            if (outcome === 'return') { assertEq(run(initial, first, second), previousObject) }
                            else { throws(() => run(initial, first, second), error => error === (outcome === 'throw' ? previousObject : stopped)) }
                        }
                        invoke(100_000, tokenA, tokenB, 'throw')
                        assertEq(steps, 100_000)
                        assertEq(visits, 100_001)
                        const heldFirst = firstRead, heldLast = previousRead
                        assert(heldFirst !== undefined && heldLast !== undefined)
                        const firstSnapshot = heldFirst(), lastSnapshot = heldLast()
                        invoke(0, [11], [12], 'throw')
                        assertEq(steps, 0)
                        assertEq(visits, 1)
                        assert(previousPair !== lastSnapshot[0])
                        for (const [read, snapshot] of /** @type {const} */ ([[heldFirst, firstSnapshot], [heldLast, lastSnapshot]])) {
                            const captured = read()
                            for (let index = 0; index < captured.length; index += 1) { assertEq(captured[index], snapshot[index]) }
                        }
                        if (mixed) {
                            invoke(100_000, tokenA, tokenB, 'return')
                            assertEq(steps, 100_000)
                            assertEq(visits, 100_001)
                        }
                        /** @type {readonly string[]} */
                        const nextNames = ['prefix', 'condition', 'choice', 'argument0', 'argument1', 'argument2', ...hasRest ? [] : ['ignored'], 'spread']
                        /** @type {readonly string[]} */
                        const exitNames = ['prefix', 'condition', ...mixed ? ['normal'] : [], 'payload']
                        for (const failure of [...nextNames, ...mixed ? ['normal'] : [], 'payload']) {
                            invoke(3, tokenA, tokenB, failure)
                            const atExit = failure === 'normal' || failure === 'payload'
                            assertEq(steps, atExit ? 3 : 1)
                            assertEq(visits, atExit ? 4 : 2)
                            const expected = atExit
                                ? [...[1, 2, 3].flatMap(visit => nextNames.map(name => `${visit}:${name}`)), ...exitNames.slice(0, exitNames.indexOf(failure) + 1).map(name => `4:${name}`)]
                                : [...nextNames.map(name => `1:${name}`), ...nextNames.slice(0, nextNames.indexOf(failure) + 1).map(name => `2:${name}`)]
                            assertStructurallySame(events, expected)
                        }
                    }
                }
            }
        }
    },
    explicitThrowEmptyRestAndZeroInputRootsKeepTheirLifetimes: async () => {
        for (const [arity, parameters, n, rest, next, mixed] of /** @type {const} */ ([
            [1, 'n,...xs', 'n', 'xs', 'n+1', false],
            [0, '...xs', 'undefined', 'xs', '', false],
            [0, '', 'undefined', 'null', '', true],
        ])) {
            for (const inverted of /** @type {const} */ ([false, true])) {
                const continuation = `return ${mixed ? 'choice===1?finish(pair,read):' : ''}f(${next});`
                const decision = inverted ? `if(choice!==0){${continuation}}throw finish(pair,read);` : `if(choice===0){throw finish(pair,read);}${continuation}`
                const source = `export default(visit,finish)=>{const f=(${parameters})=>{const pair=[${n},${rest}];const read=()=>[pair,f];const choice=visit(pair,read);${decision}};return f;};`
                const [, interpreted] = virtualAt({ main: [utf8(source)] })(interpret(noRuntime)('main'))
                const graph = assertOk(interpreted)
                for (const text of [assertOk(tryStringify(graph)), stringify(graph)]) {
                    assert(text.includes('while('), text)
                    const make = (await load(text)).default
                    let limit = 100_000
                    let visits = 0
                    let normal = false
                    /** @type {readonly unknown[] | undefined} */
                    let previousPair
                    /** @type {unknown} */
                    let previousRest
                    /** @type {(() => readonly unknown[]) | undefined} */
                    let held
                    const run = make(
                        /** @type {(pair: readonly unknown[], read: () => readonly unknown[]) => number} */ ((pair, read) => {
                            assertEq(pair[0], arity === 1 ? visits : undefined)
                            assert(pair !== previousPair)
                            assertEq(read()[0], pair)
                            assertEq(read()[1], run)
                            if (mixed) { assertEq(pair[1], null) }
                            else {
                                assert(pair[1] instanceof Array && pair[1] !== previousRest)
                                assertEq(pair[1].length, 0)
                                previousRest = pair[1]
                            }
                            previousPair = pair
                            if (visits === 0) { held = read }
                            visits += 1
                            return visits <= limit ? 2 : normal ? 1 : 0
                        }),
                        /** @type {(pair: readonly unknown[], read: () => readonly unknown[]) => unknown} */ ((pair, read) => {
                            assertEq(pair, previousPair)
                            assertEq(read()[0], pair)
                            assertEq(visits, limit + 1)
                            return pair
                        }),
                    )
                    assertEq(run.length, arity)
                    const invoke = () => arity === 1 ? run(0) : run()
                    throws(invoke, error => error === previousPair)
                    assertEq(visits, 100_001)
                    const saved = held
                    assert(saved !== undefined)
                    const snapshot = saved()
                    visits = 0
                    limit = 0
                    previousPair = undefined
                    previousRest = undefined
                    throws(invoke, error => error === previousPair)
                    assertEq(visits, 1)
                    assert(saved()[0] === snapshot[0] && saved()[1] === snapshot[1])
                    assert(previousPair !== snapshot[0])
                    if (mixed) {
                        visits = 0
                        limit = 100_000
                        normal = true
                        previousPair = undefined
                        assertEq(invoke(), previousPair)
                        assertEq(visits, 100_001)
                    }
                }
            }
        }
    },
    continuingOnlyTailRootsKeepOrderIdentityAndBoundedStack: async () => {
        const tokenA = /** @type {const} */ ([7])
        const tokenB = /** @type {const} */ ([9])
        for (const [arity, parameters, n, a, b, rest] of /** @type {const} */ ([
            [3, 'n,a,b', 'n', 'a', 'b', 'null'],
            [1, 'n,...xs', 'n', 'xs[0]', 'xs[1]', 'xs'],
            [0, '...xs', 'xs[0]', 'xs[1]', 'xs[2]', 'xs'],
        ])) {
            const hasRest = rest !== 'null'
            for (const [branched, inverted] of /** @type {const} */ ([[false, false], [true, false], [true, true]])) {
                const values = /** @type {const} */ ('pair,object,read,established')
                const suffix = hasRest ? `,...spread(${values})` : `,ignored(${values}),...spread(${values})`
                const swap = `f(argument(0,${n}+1,${values}),argument(1,${b},${values}),argument(2,${a},${values})${suffix})`
                const keep = `f(argument(0,${n}+1,${values}),argument(1,${a},${values}),argument(2,${b},${values})${suffix})`
                const next = branched ? inverted ? `!choose(${values})?${keep}:${swap}` : `choose(${values})?${swap}:${keep}` : swap
                const source = `export default(before,choose,argument,ignored,spread)=>{const f=(${parameters})=>{const pair=[${n},${a},${b},${rest},f];const object={pair};const read=()=>[pair,object,${n},${a},${b},${rest},f];const established=before(pair,object,read);return ${next};};return f;};`
                const [, interpreted] = virtualAt({ main: [utf8(source)] })(interpret(noRuntime)('main'))
                const graph = assertOk(interpreted)
                for (const text of [assertOk(tryStringify(graph)), stringify(graph)]) {
                    assert(text.includes('while('), text)
                    const make = (await load(text)).default
                    const stopped = new Error('stop after the selected continuing-only path')
                    let limit = 0
                    let start = 0
                    let visits = 0
                    let steps = 0
                    let phase = 'prefix'
                    let mode = 'stop'
                    let selected = true
                    /** @type {unknown} */
                    let expectedA = tokenA
                    /** @type {unknown} */
                    let expectedB = tokenB
                    /** @type {readonly unknown[] | undefined} */
                    let previousPair
                    /** @type {unknown} */
                    let previousObject
                    /** @type {(() => readonly unknown[]) | undefined} */
                    let previousRead
                    /** @type {unknown} */
                    let previousRest
                    /** @type {(() => readonly unknown[]) | undefined} */
                    let firstRead
                    /** @type {string[]} */
                    let events = []
                    /** @param {string} name */
                    const event = name => {
                        if (limit < 10) { events.push(`${visits}:${name}`) }
                        if (mode === name && visits === 2) { throw stopped }
                    }
                    /** @type {(pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => void} */
                    const shared = (pair, object, read, established) => {
                        assertEq(pair, previousPair)
                        assertEq(object, previousObject)
                        assertEq(read, previousRead)
                        assertEq(established, object)
                        assertEq(read()[0], pair)
                        assertEq(read()[1], object)
                        assertEq(read()[2], pair[0])
                        assertEq(read()[3], pair[1])
                        assertEq(read()[4], pair[2])
                        assertEq(read()[5], pair[3])
                        assertEq(read()[6], run)
                    }
                    const run = make(
                        /** @type {(pair: readonly unknown[], object: { readonly pair: readonly unknown[] }, read: () => readonly unknown[]) => unknown} */ ((pair, object, read) => {
                            assertEq(phase, 'prefix')
                            assertEq(pair[0], start + steps)
                            assertEq(pair[1], expectedA)
                            assertEq(pair[2], expectedB)
                            assertEq(pair[4], run)
                            assertEq(object.pair, pair)
                            assert(pair !== previousPair)
                            assert(object !== previousObject)
                            assert(read !== previousRead)
                            const currentRest = pair[3]
                            if (hasRest) {
                                assert(currentRest instanceof Array)
                                assert(currentRest !== previousRest)
                                assertEq(currentRest.length, arity === 0 ? 3 : 2)
                                assertEq(currentRest[arity === 0 ? 1 : 0], expectedA)
                                assertEq(currentRest[arity === 0 ? 2 : 1], expectedB)
                                previousRest = currentRest
                            } else { assertEq(currentRest, null) }
                            previousPair = pair
                            previousObject = object
                            previousRead = read
                            if (visits === 0) { firstRead = read }
                            visits += 1
                            event('prefix')
                            if (mode === 'stop' && steps === limit) { throw stopped }
                            selected = true
                            phase = branched ? 'choice' : 'argument0'
                            return object
                        }),
                        /** @type {(pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => boolean} */ ((...input) => {
                            assertEq(phase, 'choice')
                            shared(...input)
                            event('choice')
                            selected = steps % 2 === 0
                            phase = 'argument0'
                            return selected
                        }),
                        /** @type {(index: number, value: unknown, pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => unknown} */ ((index, value, ...input) => {
                            assertEq(phase, `argument${index}`)
                            shared(...input)
                            assertEq(value, index === 0 ? start + steps + 1 : index === 1 ? selected ? expectedB : expectedA : selected ? expectedA : expectedB)
                            event(`argument${index}`)
                            phase = index === 2 ? hasRest ? 'spread' : 'ignored' : `argument${index + 1}`
                            return value
                        }),
                        /** @type {(pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => unknown} */ ((...input) => {
                            assertEq(phase, 'ignored')
                            shared(...input)
                            event('ignored')
                            phase = 'spread'
                            return input[1]
                        }),
                        /** @type {(pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => readonly unknown[]} */ ((...input) => {
                            assertEq(phase, 'spread')
                            shared(...input)
                            event('spread')
                            const nextA = selected ? expectedB : expectedA
                            const nextB = selected ? expectedA : expectedB
                            expectedA = nextA
                            expectedB = nextB
                            steps += 1
                            phase = 'prefix'
                            return []
                        }),
                    )
                    assertEq(run.length, arity)
                    /** @param {number} count @param {number} initial @param {unknown} first @param {unknown} second @param {string} failure */
                    const invoke = (count, initial, first, second, failure) => {
                        limit = count
                        start = initial
                        visits = 0
                        steps = 0
                        phase = 'prefix'
                        mode = failure
                        expectedA = first
                        expectedB = second
                        previousPair = undefined
                        previousObject = undefined
                        previousRead = undefined
                        previousRest = undefined
                        firstRead = undefined
                        events = []
                        throws(() => run(initial, first, second), error => error === stopped)
                    }
                    invoke(100_000, 0, tokenA, tokenB, 'stop')
                    assertEq(steps, 100_000)
                    assertEq(visits, 100_001)
                    const heldFirst = firstRead, heldLast = previousRead
                    assert(heldFirst !== undefined && heldLast !== undefined)
                    const firstSnapshot = heldFirst(), lastSnapshot = heldLast()
                    invoke(0, 10, [11], [12], 'stop')
                    assertEq(steps, 0)
                    assertEq(visits, 1)
                    assert(previousPair !== firstSnapshot[0])
                    for (const [read, snapshot] of /** @type {const} */ ([[heldFirst, firstSnapshot], [heldLast, lastSnapshot]])) {
                        const captured = read()
                        for (let index = 0; index < captured.length; index += 1) { assertEq(captured[index], snapshot[index]) }
                    }
                    /** @type {readonly string[]} */
                    const names = ['prefix', ...branched ? ['choice'] : [], 'argument0', 'argument1', 'argument2', ...hasRest ? [] : ['ignored'], 'spread']
                    for (const failure of names) {
                        invoke(3, 0, tokenA, tokenB, failure)
                        assertEq(steps, 1)
                        assertEq(visits, 2)
                        assertStructurallySame(events, [...names.map(name => `1:${name}`), ...names.slice(0, names.indexOf(failure) + 1).map(name => `2:${name}`)])
                    }
                }
            }
        }
    },
    continuingOnlyRestRootsKeepFreshEmptyRest: async () => {
        for (const [arity, parameters, next] of /** @type {const} */ ([[1, 'n,...xs', 'n+1'], [0, '...xs', '']])) {
            const source = `export default visit=>{const f=(${parameters})=>{const read=()=>xs;visit(xs,read,f);return f(${next});};return f;};`
            const [, interpreted] = virtualAt({ main: [utf8(source)] })(interpret(noRuntime)('main'))
            const graph = assertOk(interpreted)
            for (const text of [assertOk(tryStringify(graph)), stringify(graph)]) {
                assert(text.includes('while('), text)
                const make = (await load(text)).default
                const stopped = new Error('stop an empty-rest continuing-only root')
                let visits = 0
                let limit = 100_000
                /** @type {readonly unknown[] | undefined} */
                let previous
                /** @type {(() => readonly unknown[]) | undefined} */
                let held
                const run = make(/** @type {(rest: readonly unknown[], read: () => readonly unknown[], self: unknown) => void} */ ((rest, read, self) => {
                    assertEq(self, run)
                    assertEq(read(), rest)
                    assertEq(rest.length, 0)
                    assert(rest !== previous)
                    previous = rest
                    if (visits === 0) { held = read }
                    visits += 1
                    if (visits > limit) { throw stopped }
                }))
                assertEq(run.length, arity)
                throws(() => arity === 0 ? run() : run(0), error => error === stopped)
                assertEq(visits, 100_001)
                const saved = held
                assert(saved !== undefined)
                const rest = saved()
                visits = 0
                limit = 0
                previous = undefined
                throws(() => arity === 0 ? run() : run(0), error => error === stopped)
                assertEq(visits, 1)
                assert(saved() === rest && rest !== previous)
            }
        }
    },
    zeroInputTerminalPrefixesKeepOrderIdentityAndBoundedStack: async () => {
        const seed = /** @type {const} */ ([9])
        for (const [mixed, earlyFirst] of /** @type {const} */ ([[false, false], [true, false], [true, true]])) {
            for (const baseFirst of /** @type {const} */ ([false, true])) {
                const args = /** @type {const} */ ('pair,object,read,established')
                const recur = `f(argument(${args}),...spread(${args}))`
                const normal = `finish(0,${args})`
                const early = `finish(1,${args})`
                const choice = `choose(${args})`
                const continuing = mixed ? earlyFirst ? `${choice}?${early}:${recur}` : `!${choice}?${recur}:${early}` : recur
                const test = `test(${args})`
                const source = `export default(before,test,choose,argument,spread,finish,seed)=>{const f=()=>{const pair=[seed,f];const object={pair};const read=()=>[pair,object,seed,f];const established=before(pair,object,read);return ${baseFirst ? `!${test}?${normal}:(${continuing})` : `${test}?(${continuing}):${normal}`};};return f;};`
                const [, interpreted] = virtualAt({ main: [utf8(source)] })(interpret(noRuntime)('main'))
                const graph = assertOk(interpreted)
                for (const text of [assertOk(tryStringify(graph)), stringify(graph)]) {
                    assert(text.includes('while('), text)
                    const make = (await load(text)).default
                    const stopped = new Error('stop in the selected zero-input terminal path')
                    let limit = 0
                    let completeEarly = false
                    let mode = 'normal'
                    let phase = 'prefix'
                    let prefixes = 0
                    let tests = 0
                    let choices = 0
                    let argumentsSeen = 0
                    let spreads = 0
                    let steps = 0
                    let finishes = 0
                    /** @type {readonly unknown[] | undefined} */
                    let previousPair
                    /** @type {{ readonly pair: readonly unknown[] } | undefined} */
                    let previousObject
                    /** @type {(() => readonly unknown[]) | undefined} */
                    let previousRead
                    /** @type {{ readonly read: () => readonly unknown[], readonly snapshot: readonly unknown[] } | undefined} */
                    let held
                    /** @type {(pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => void} */
                    const shared = (pair, object, read, established) => {
                        assertEq(pair, previousPair)
                        assertEq(object, previousObject)
                        assertEq(read, previousRead)
                        assertEq(established, object)
                        assertEq(read()[0], pair)
                        assertEq(read()[1], object)
                        assertEq(read()[2], seed)
                        assertEq(read()[3], run)
                    }
                    const run = make(
                        /** @type {(pair: readonly unknown[], object: { readonly pair: readonly unknown[] }, read: () => readonly unknown[]) => unknown} */ ((pair, object, read) => {
                            assertEq(phase, 'prefix')
                            assertEq(prefixes, steps)
                            assertEq(tests, steps)
                            assertEq(pair[0], seed)
                            assertEq(pair[1], run)
                            assertEq(object.pair, pair)
                            assert(pair !== previousPair)
                            assert(object !== previousObject)
                            assert(read !== previousRead)
                            previousPair = pair
                            previousObject = object
                            previousRead = read
                            shared(pair, object, read, object)
                            if (prefixes === 0) { held = { read, snapshot: read() } }
                            prefixes += 1
                            if (mode === 'prefix' && prefixes === 2) { throw stopped }
                            phase = 'condition'
                            return object
                        }),
                        /** @type {(pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => boolean} */ ((...values) => {
                            assertEq(phase, 'condition')
                            shared(...values)
                            tests += 1
                            if (mode === 'condition' && tests === 2) { throw stopped }
                            const continues = completeEarly || steps < limit
                            phase = continues ? mixed ? 'choice' : 'argument' : 'base'
                            return continues
                        }),
                        /** @type {(pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => boolean} */ ((...values) => {
                            assertEq(phase, 'choice')
                            shared(...values)
                            choices += 1
                            if (mode === 'choice' && choices === 2) { throw stopped }
                            const completes = completeEarly && steps === limit
                            phase = completes ? 'base' : 'argument'
                            return completes
                        }),
                        /** @type {(pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => unknown} */ ((...values) => {
                            assertEq(phase, 'argument')
                            shared(...values)
                            argumentsSeen += 1
                            if (mode === 'argument' && argumentsSeen === 2) { throw stopped }
                            phase = 'spread'
                            return values[1]
                        }),
                        /** @type {(pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => readonly unknown[]} */ ((...values) => {
                            assertEq(phase, 'spread')
                            shared(...values)
                            spreads += 1
                            if (mode === 'spread' && spreads === 2) { throw stopped }
                            steps += 1
                            phase = 'prefix'
                            return [values[0]]
                        }),
                        /** @type {(tag: number, pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => readonly unknown[]} */ ((tag, ...values) => {
                            assertEq(phase, 'base')
                            shared(...values)
                            assertEq(tag, completeEarly ? 1 : 0)
                            assertEq(prefixes, limit + 1)
                            assertEq(tests, limit + 1)
                            assertEq(argumentsSeen, limit)
                            assertEq(spreads, limit)
                            assertEq(steps, limit)
                            finishes += 1
                            if (mode === 'base') { throw stopped }
                            return [values[0], values[0], values[1], values[2], values[3]]
                        }), seed,
                    )
                    assertEq(run.length, 0)
                    /** @param {number} count @param {boolean} earlyCompletion */
                    const reset = (count, earlyCompletion) => {
                        limit = count
                        completeEarly = earlyCompletion
                        mode = 'normal'
                        phase = 'prefix'
                        prefixes = 0
                        tests = 0
                        choices = 0
                        argumentsSeen = 0
                        spreads = 0
                        steps = 0
                        finishes = 0
                        previousPair = undefined
                        previousObject = undefined
                        previousRead = undefined
                        held = undefined
                    }
                    for (const earlyCompletion of mixed ? [false, true] : [false]) {
                        /** @param {number} count */
                        const invoke = count => {
                            reset(count, earlyCompletion)
                            const value = run(11, 12)
                            assertEq(finishes, 1)
                            assertEq(value[0], value[1])
                            assertEq(value[0], previousPair)
                            assertEq(value[2], value[4])
                            assertEq(value[3]()[0], value[0])
                            assertEq(value[3]()[3], run)
                            assertEq(choices, mixed ? count + (earlyCompletion ? 1 : 0) : 0)
                            return value
                        }
                        const first = invoke(100_000)
                        const saved = held
                        assert(saved !== undefined)
                        const second = invoke(0)
                        assert(first !== second)
                        assert(first[0] !== second[0])
                        assert(first[2] !== second[2])
                        const captured = saved.read()
                        for (let index = 0; index < captured.length; index += 1) { assertEq(captured[index], saved.snapshot[index]) }
                        assertEq(first[3]()[0], first[0])
                        assertEq(first[3]()[1], first[2])
                        for (const failureAt of ['prefix', 'condition', ...mixed ? ['choice'] : [], 'argument', 'spread', 'base']) {
                            reset(3, earlyCompletion)
                            mode = failureAt
                            throws(() => run(), error => error === stopped)
                            assertEq(prefixes, failureAt === 'base' ? 4 : 2)
                            assertEq(tests, failureAt === 'base' ? 4 : failureAt === 'prefix' ? 1 : 2)
                            assertEq(argumentsSeen, failureAt === 'base' ? 3 : failureAt === 'argument' || failureAt === 'spread' ? 2 : 1)
                            assertEq(spreads, failureAt === 'base' ? 3 : failureAt === 'spread' ? 2 : 1)
                            assertEq(steps, failureAt === 'base' ? 3 : 1)
                            assertEq(finishes, failureAt === 'base' ? 1 : 0)
                        }
                    }
                }
            }
        }
    },
    sharedRequiredPrefixesKeepOncePerInvocationOrderAndSnapshots: async () => {
        const tokenA = /** @type {const} */ ([1])
        const tokenB = /** @type {const} */ ([2])
        const token = /** @type {const} */ ([7])
        for (const [arity, parameters, n, a, b, rest, tail] of /** @type {const} */ ([
            [3, 'n,a,b', 'n', 'a', 'b', 'null', ''],
            [3, 'n,a,b,...xs', 'n', 'a', 'b', 'xs', ',...xs'],
            [0, '...xs', 'xs[0]', 'xs[1]', 'xs[2]', 'xs', ',...xs.slice(3)'],
        ])) {
            const hasRest = rest !== 'null'
            const recur = `f(argument(0,${n}-1,pair,object,read),argument(1,${b},pair,object,read),argument(2,${a},pair,object,read)${tail})`
            const normal = /** @type {const} */ ('finish(pair,object,read,established)')
            const test = /** @type {const} */ ('test(pair,object,read,established)')
            for (const baseFirst of /** @type {const} */ ([false, true])) {
                const source = `export default(before,test,argument,finish)=>{const f=(${parameters})=>{const pair=[${n},${a},${b},${rest}];const object={pair};const read=()=>[pair,object,${n},${a},${b},${rest}];const established=before(pair,object,read);return ${baseFirst ? `!${test}?${normal}:${recur}` : `${test}?${recur}:${normal}`};};return f;};`
                const [, interpreted] = virtualAt({ main: [utf8(source)] })(interpret(noRuntime)('main'))
                const graph = assertOk(interpreted)
                for (const text of [assertOk(tryStringify(graph)), stringify(graph)]) {
                    assert(text.includes('while('), text)
                    const make = (await load(text)).default
                    const stopped = new Error('stop at a shared required invocation prefix')
                    let start = 0
                    let prefixes = 0
                    let tests = 0
                    let argumentsSeen = 0
                    let steps = 0
                    let finishes = 0
                    let phase = 'prefix'
                    let mode = 'normal'
                    /** @type {readonly number[]} */
                    let expectedA = tokenA
                    /** @type {readonly number[]} */
                    let expectedB = tokenB
                    /** @type {readonly unknown[] | undefined} */
                    let previousPair
                    /** @type {{ readonly pair: readonly unknown[] } | undefined} */
                    let previousObject
                    /** @type {(() => readonly unknown[]) | undefined} */
                    let previousRead
                    /** @type {{ readonly read: () => readonly unknown[], readonly snapshot: readonly unknown[] } | undefined} */
                    let held
                    const run = make(
                        /** @type {(pair: readonly unknown[], object: { readonly pair: readonly unknown[] }, read: () => readonly unknown[]) => unknown} */ ((pair, object, read) => {
                            assertEq(phase, 'prefix')
                            assertEq(prefixes, steps)
                            assertEq(tests, steps)
                            assertEq(pair[0], start - steps)
                            assertEq(pair[1], expectedA)
                            assertEq(pair[2], expectedB)
                            assertEq(object.pair, pair)
                            assert(pair !== previousPair)
                            assert(object !== previousObject)
                            assert(read !== previousRead)
                            if (hasRest && previousPair !== undefined) { assert(pair[3] !== previousPair[3]) }
                            const captured = read()
                            assertEq(captured[0], pair)
                            assertEq(captured[1], object)
                            assertEq(captured[2], pair[0])
                            assertEq(captured[3], pair[1])
                            assertEq(captured[4], pair[2])
                            assertEq(captured[5], pair[3])
                            if (prefixes === 0) { held = { read, snapshot: captured } }
                            previousPair = pair
                            previousObject = object
                            previousRead = read
                            prefixes += 1
                            if (mode === 'prefix' && prefixes === 2) { throw stopped }
                            phase = 'condition'
                            return object
                        }),
                        /** @type {(pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => boolean} */ ((pair, object, read, established) => {
                            assertEq(phase, 'condition')
                            assertEq(pair, previousPair)
                            assertEq(object, previousObject)
                            assertEq(read, previousRead)
                            assertEq(established, object)
                            assertEq(read()[0], pair)
                            tests += 1
                            if (mode === 'condition' && tests === 2) { throw stopped }
                            phase = start - steps > 0 ? 'argument0' : 'base'
                            return start - steps > 0
                        }),
                        /** @type {(index: number, value: unknown, pair: readonly unknown[], object: unknown, read: () => readonly unknown[]) => unknown} */ ((index, value, pair, object, read) => {
                            assertEq(phase, `argument${index}`)
                            assertEq(pair, previousPair)
                            assertEq(object, previousObject)
                            assertEq(read, previousRead)
                            assertEq(read()[0], pair)
                            assertEq(read()[1], object)
                            assertEq(value, index === 0 ? start - steps - 1 : index === 1 ? expectedB : expectedA)
                            argumentsSeen += 1
                            if (mode === `argument${index}` && tests === 2) { throw stopped }
                            phase = index === 2 ? 'prefix' : `argument${index + 1}`
                            if (index === 2) {
                                const before = expectedA
                                expectedA = expectedB
                                expectedB = before
                                steps += 1
                            }
                            return value
                        }),
                        /** @type {(pair: readonly unknown[], object: unknown, read: () => readonly unknown[], established: unknown) => readonly unknown[]} */ ((pair, object, read, established) => {
                            assertEq(phase, 'base')
                            assertEq(pair, previousPair)
                            assertEq(object, previousObject)
                            assertEq(read, previousRead)
                            assertEq(established, object)
                            assertEq(pair[0], 0)
                            assertEq(prefixes, start + 1)
                            assertEq(tests, start + 1)
                            assertEq(argumentsSeen, start * 3)
                            assertEq(finishes, 0)
                            finishes += 1
                            if (mode === 'base') { throw stopped }
                            return [pair, object, read, established]
                        }),
                    )
                    assertEq(run.length, arity)
                    /** @param {number} count */
                    const reset = count => {
                        start = count
                        prefixes = 0
                        tests = 0
                        argumentsSeen = 0
                        steps = 0
                        finishes = 0
                        phase = 'prefix'
                        mode = 'normal'
                        expectedA = tokenA
                        expectedB = tokenB
                        previousPair = undefined
                        previousObject = undefined
                        previousRead = undefined
                        held = undefined
                    }
                    for (const nonempty of /** @type {const} */ ([false, true])) {
                        const supplied = nonempty ? [token] : []
                        /** @param {number} count */
                        const invoke = count => {
                            reset(count)
                            const value = run(count, tokenA, tokenB, ...supplied)
                            assertEq(steps, count)
                            assertEq(finishes, 1)
                            assertEq(value[0], previousPair)
                            assertEq(value[1], previousObject)
                            assertEq(value[1], value[3])
                            assertEq(value[2]()[0], value[0])
                            if (hasRest) {
                                const finalRest = value[0][3]
                                assertEq(finalRest.length, supplied.length + (arity === 0 ? 3 : 0))
                                if (nonempty) { assertEq(finalRest[arity === 0 ? 3 : 0], token) }
                            }
                            return value
                        }
                        const first = invoke(100_000)
                        const saved = held
                        assert(saved !== undefined)
                        const second = invoke(0)
                        assert(first !== second)
                        assert(first[0] !== second[0])
                        assert(first[1] !== second[1])
                        const captured = saved.read()
                        for (let index = 0; index < captured.length; index += 1) { assertEq(captured[index], saved.snapshot[index]) }
                        assertEq(first[2]()[0], first[0])
                        assertEq(first[2]()[1], first[1])
                        if (hasRest) { assert(first[0][3] !== second[0][3]) }
                        for (const failureAt of /** @type {const} */ (['prefix', 'condition', 'argument0', 'argument1', 'argument2', 'base'])) {
                            reset(3)
                            mode = failureAt
                            throws(() => run(3, tokenA, tokenB, ...supplied), error => error === stopped)
                            assertEq(prefixes, failureAt === 'base' ? 4 : 2)
                            assertEq(tests, failureAt === 'base' ? 4 : failureAt === 'prefix' ? 1 : 2)
                            assertEq(argumentsSeen, failureAt === 'base' ? 9 : failureAt === 'argument0' ? 4 : failureAt === 'argument1' ? 5 : failureAt === 'argument2' ? 6 : 3)
                            assertEq(finishes, failureAt === 'base' ? 1 : 0)
                        }
                    }
                }
            }
        }
    },
    mixedTailLeavesKeepCompletionOrderAndInvocationSnapshots: async () => {
        const tokenA = /** @type {const} */ ([1])
        const tokenB = /** @type {const} */ ([2])
        const seed = /** @type {const} */ ([9])
        for (const [arity, parameters, n, a, b, saved, rest] of /** @type {const} */ ([
            [4, 'n,a,b,saved', 'n', 'a', 'b', 'saved', 'null'],
            [1, 'n,...xs', 'n', 'xs[0]', 'xs[1]', 'xs[2]', 'xs'],
            [0, '...xs', 'xs[0]', 'xs[1]', 'xs[2]', 'xs[3]', 'xs'],
        ])) {
            const hasRest = rest !== 'null'
            const pair = `[${n},${a},${b},${rest}]`
            const read = `()=>[pair,${n},${a},${b},${rest}]`
            const recur = `(()=>{const pair=${pair};return f(argument(0,${n}-1,pair,pair,${read}),argument(1,${b},pair,pair,${read}),argument(2,${a},pair,pair,${read}),()=>pair);})()`
            /** @param {number} label */
            const normal = label => `(()=>{const pair=${pair};return finish(${label},pair,pair,${read},${saved}());})()`
            const test = `test(${n},${a},${b},${saved},${rest},()=>[${n},${a},${b},${rest}])`
            for (const baseFirst of /** @type {const} */ ([false, true])) {
                for (const earlyFirst of /** @type {const} */ ([false, true])) {
                    const choice = `choose(${n})`
                    const mixed = earlyFirst ? `${choice}?${normal(1)}:${recur}` : `!${choice}?${recur}:${normal(1)}`
                    const source = `export default(test,choose,argument,finish)=>{const f=(${parameters})=>${baseFirst ? `!${test}?${normal(0)}:(${mixed})` : `${test}?(${mixed}):${normal(0)}`};return f;};`
                    const [, interpreted] = virtualAt({ main: [utf8(source)] })(interpret(noRuntime)('main'))
                    const graph = assertOk(interpreted)
                    for (const text of [assertOk(tryStringify(graph)), stringify(graph)]) {
                        assert(text.includes('while('), text)
                        const make = (await load(text)).default
                        const stopped = new Error('stop in the selected mixed transfer path')
                        let start = 0
                        let tests = 0
                        let choices = 0
                        let argumentsSeen = 0
                        let argumentIndex = 0
                        let steps = 0
                        let finishes = 0
                        let stopEarly = true
                        let mode = 'normal'
                        /** @type {readonly number[]} */
                        let expectedA = tokenA
                        /** @type {readonly number[]} */
                        let expectedB = tokenB
                        /** @type {readonly unknown[] | undefined} */
                        let previousPair
                        /** @type {readonly unknown[] | undefined} */
                        let previousRest
                        /** @type {{ readonly read: () => readonly unknown[], readonly values: readonly unknown[] } | undefined} */
                        let held
                        /** @type {{ readonly read: () => readonly unknown[], readonly values: readonly unknown[] } | undefined} */
                        let heldCondition
                        const run = make(
                            /** @type {(n: number, a: readonly number[], b: readonly number[], saved: () => unknown, rest: readonly unknown[] | null, read: () => readonly unknown[]) => boolean} */ ((n, a, b, saved, rest, read) => {
                                assertEq(n, start - steps)
                                assertEq(a, expectedA)
                                assertEq(b, expectedB)
                                assertEq(saved(), steps === 0 ? seed : previousPair)
                                assertEq(tests, steps)
                                assertEq(choices, steps)
                                assertEq(argumentsSeen, steps * 3)
                                assertEq(finishes, 0)
                                const captured = read()
                                assertEq(captured[0], n)
                                assertEq(captured[1], a)
                                assertEq(captured[2], b)
                                assertEq(captured[3], rest)
                                if (hasRest) { assert(rest !== previousRest) }
                                else { assertEq(rest, null) }
                                if (tests === 0) { heldCondition = { read, values: captured } }
                                previousRest = rest === null ? undefined : rest
                                tests += 1
                                if (mode === 'condition' && tests === 2) { throw stopped }
                                return n >= 0
                            }),
                            /** @type {(n: number) => boolean} */ (n => {
                                assertEq(n, start - steps)
                                assertEq(choices, steps)
                                choices += 1
                                if (mode === 'selector' && tests === 2) { throw stopped }
                                return stopEarly && n === 0
                            }),
                            /** @type {(index: number, value: unknown, first: readonly unknown[], second: readonly unknown[], read: () => readonly unknown[]) => unknown} */ ((index, value, first, second, read) => {
                                assertEq(index, argumentIndex)
                                assertEq(first, second)
                                assertEq(first[0], start - steps)
                                assertEq(first[1], expectedA)
                                assertEq(first[2], expectedB)
                                assertEq(first[3], hasRest ? previousRest : null)
                                const captured = read()
                                assertEq(captured[0], first)
                                assertEq(captured[1], first[0])
                                assertEq(captured[2], first[1])
                                assertEq(captured[3], first[2])
                                assertEq(captured[4], first[3])
                                assertEq(value, index === 0 ? start - steps - 1 : index === 1 ? expectedB : expectedA)
                                if (index === 0) {
                                    assert(first !== previousPair)
                                    previousPair = first
                                    if (steps === 0) { held = { read, values: captured } }
                                } else { assertEq(first, previousPair) }
                                argumentsSeen += 1
                                if (mode === `argument${index}` && tests === 2) { throw stopped }
                                argumentIndex += 1
                                if (index === 2) {
                                    const before = expectedA
                                    expectedA = expectedB
                                    expectedB = before
                                    steps += 1
                                    argumentIndex = 0
                                }
                                return value
                            }),
                            /** @type {(label: number, first: readonly unknown[], second: readonly unknown[], read: () => readonly unknown[], saved: unknown) => readonly unknown[]} */ ((label, first, second, read, saved) => {
                                assertEq(label, stopEarly ? 1 : 0)
                                assertEq(first, second)
                                assertEq(first[0], stopEarly ? 0 : -1)
                                assertEq(first[1], expectedA)
                                assertEq(first[2], expectedB)
                                assertEq(first[3], hasRest ? previousRest : null)
                                assertEq(saved, steps === 0 ? seed : previousPair)
                                assertEq(tests, steps + 1)
                                assertEq(choices, steps + (stopEarly ? 1 : 0))
                                assertEq(argumentsSeen, steps * 3)
                                assertEq(finishes, 0)
                                finishes += 1
                                if (mode === 'base') { throw stopped }
                                return [first, first, read, saved]
                            }),
                        )
                        assertEq(run.length, arity)
                        /** @param {number} count @param {boolean} early */
                        const reset = (count, early) => {
                            start = count
                            tests = 0
                            choices = 0
                            argumentsSeen = 0
                            argumentIndex = 0
                            steps = 0
                            finishes = 0
                            stopEarly = early
                            mode = 'normal'
                            expectedA = tokenA
                            expectedB = tokenB
                            previousPair = undefined
                            previousRest = undefined
                            held = undefined
                            heldCondition = undefined
                        }
                        /** @param {number} count @param {boolean} early */
                        const invoke = (count, early) => {
                            reset(count, early)
                            const value = run(count, tokenA, tokenB, () => seed)
                            assertEq(steps, count + (early ? 0 : 1))
                            assertEq(finishes, 1)
                            assertEq(value[0], value[1])
                            const captured = value[2]()
                            assertEq(captured[0], value[0])
                            assertEq(captured[1], value[0][0])
                            assertEq(captured[2], value[0][1])
                            assertEq(captured[3], value[0][2])
                            assertEq(captured[4], value[0][3])
                            if (hasRest) { assertEq(value[0][3].length, arity === 0 ? 4 : 3) }
                            return value
                        }
                        for (const early of /** @type {const} */ ([false, true])) {
                            const first = invoke(100_000, early)
                            const branch = held
                            const condition = heldCondition
                            const retained = first[2]()
                            assert(branch !== undefined)
                            assert(condition !== undefined)
                            const second = invoke(0, true)
                            assert(first !== second)
                            assert(first[0] !== second[0])
                            assertEq(first[2]()[0], retained[0])
                            for (const item of [branch, condition]) {
                                const captured = item.read()
                                for (let index = 0; index < captured.length; index += 1) { assertEq(captured[index], item.values[index]) }
                            }
                            if (hasRest) { assert(first[0][3] !== second[0][3]) }
                        }
                        for (const failureAt of /** @type {const} */ (['condition', 'selector', 'argument0', 'argument1', 'argument2', 'base'])) {
                            reset(3, true)
                            mode = failureAt
                            throws(() => run(3, tokenA, tokenB, () => seed), error => error === stopped)
                            assertEq(tests, failureAt === 'base' ? 4 : 2)
                            assertEq(choices, failureAt === 'base' ? 4 : failureAt === 'condition' ? 1 : 2)
                            assertEq(argumentsSeen, failureAt === 'base' ? 9 : failureAt === 'argument0' ? 4 : failureAt === 'argument1' ? 5 : failureAt === 'argument2' ? 6 : 3)
                            assertEq(finishes, failureAt === 'base' ? 1 : 0)
                        }
                    }
                }
            }
        }
    },
    branchingTailCallsKeepSelectedArgumentsAndInvocationSnapshots: async () => {
        const seed = /** @type {const} */ ([9])
        const tokenA = /** @type {const} */ ([1])
        const tokenB = /** @type {const} */ ([2])
        for (const [arity, parameters, test, n, a, b, saved, rest] of /** @type {const} */ ([
            [0, '', 'test()', '0', 'seed', 'seed', '(()=>seed)', 'null'],
            [4, 'n,a,b,saved', 'test(n,a,b,saved)', 'n', 'a', 'b', 'saved', 'null'],
            [1, 'n,...xs', 'test(n,xs[0],xs[1],xs[2],xs,xs,()=>xs)', 'n', 'xs[0]', 'xs[1]', 'xs[2]', 'xs'],
            [0, '...xs', 'test(xs[0],xs[1],xs[2],xs[3],xs,xs,()=>xs)', 'xs[0]', 'xs[1]', 'xs[2]', 'xs[3]', 'xs'],
        ])) {
            const hasRest = rest !== 'null'
            const branches = [0, 1].map(label => {
                const values = /** @type {const} */ ([label === 0 ? b : a, label === 0 ? a : b])
                return `(()=>{const pair=[${n},${a},${b},${rest},${label}];return f(argument(${label},0,${n}-1,pair,pair,()=>[pair,${n},${a},${b},${rest}]),argument(${label},1,${values[0]},pair,pair,()=>[pair,${n},${a},${b},${rest}]),argument(${label},2,${values[1]},pair,pair,()=>[pair,${n},${a},${b},${rest}]),()=>pair);})()`
            })
            const recur = `choose(${n})?${branches[0]}:${branches[1]}`
            const base = [false, true].map(swapped => `(()=>{const value=finish(${swapped ? b : a},${swapped ? a : b},${saved}(),${rest});return[value,value,()=>[value,${a},${b},${saved}(),${rest}]];})()`)
            for (const reversed of /** @type {const} */ ([false, true])) {
                const normal = `baseChoice()?${base[0]}:${base[1]}`
                const source = `export default(test,choose,argument,baseChoice,finish,seed)=>{const f=(${parameters})=>${reversed ? `!${test}?(${normal}):(${recur})` : `${test}?(${recur}):(${normal})`};return f;};`
                const root = /** @type {const} */ ({ main: [utf8(source)] })
                const [, interpreted] = virtualAt(root)(interpret(noRuntime)('main'))
                const graph = assertOk(interpreted)
                for (const text of [assertOk(tryStringify(graph)), stringify(graph)]) {
                    assert(text.includes('while('), text)
                    const make = (await load(text)).default
                    const stopped = new Error('stop in the selected branching tail path')
                    let start = 0
                    let offset = 0
                    let tests = 0
                    let choices = 0
                    let argumentsSeen = 0
                    let argumentIndex = 0
                    let baseChoices = 0
                    let finishes = 0
                    let label = 0
                    let baseSelected = true
                    let mode = 'normal'
                    /** @type {readonly number[]} */
                    let expectedA = seed
                    /** @type {readonly number[]} */
                    let expectedB = seed
                    /** @type {readonly unknown[] | undefined} */
                    let previousPair
                    /** @type {readonly unknown[] | undefined} */
                    let previousRest
                    /** @type {readonly unknown[] | undefined} */
                    let heldSnapshot
                    /** @type {(() => readonly unknown[]) | undefined} */
                    let heldBranch
                    /** @type {unknown} */
                    let heldRest
                    /** @type {(() => unknown) | undefined} */
                    let heldCondition
                    const run = make(
                        /** @type {(...inputs: readonly unknown[]) => boolean} */ ((...inputs) => {
                            if (parameters.length !== 0) {
                                assertEq(inputs[0], start - tests)
                                assertEq(inputs[1], expectedA)
                                assertEq(inputs[2], expectedB)
                                const read = inputs[3]
                                assert(typeof read === 'function')
                                assertEq(read(), tests === 0 ? seed : previousPair)
                            }
                            if (hasRest) {
                                const [, , , , first, second, read] = inputs
                                assert(first instanceof Array)
                                assertEq(first, second)
                                assert(typeof read === 'function')
                                assertEq(read(), first)
                                assert(first !== previousRest)
                                if (tests === 0) { heldCondition = () => read(); heldRest = first }
                                previousRest = first
                            }
                            assertEq(choices, tests)
                            assertEq(argumentsSeen, tests * 3)
                            assertEq(argumentIndex, 0)
                            assertEq(baseChoices, 0)
                            assertEq(finishes, 0)
                            tests += 1
                            if (mode === 'condition' && tests === 2) { throw stopped }
                            return tests <= start
                        }),
                        /** @type {(value: number) => boolean} */ (value => {
                            assertEq(value, parameters.length === 0 ? 0 : start - tests + 1)
                            assertEq(choices, tests - 1)
                            assertEq(argumentIndex, 0)
                            label = (tests + offset) % 2
                            choices += 1
                            if (mode === 'selector' && tests === 2) { throw stopped }
                            return label === 0
                        }),
                        /** @type {(selected: number, index: number, value: unknown, first: readonly unknown[], second: readonly unknown[], read: () => readonly unknown[]) => unknown} */ ((selected, index, value, first, second, read) => {
                            assertEq(selected, label)
                            assertEq(index, argumentIndex)
                            assertEq(first, second)
                            const captured = read()
                            assertEq(captured[0], first)
                            assertEq(captured[1], first[0])
                            assertEq(captured[2], first[1])
                            assertEq(captured[3], first[2])
                            assertEq(captured[4], first[3])
                            assertEq(first[0], parameters.length === 0 ? 0 : start - tests + 1)
                            assertEq(first[1], expectedA)
                            assertEq(first[2], expectedB)
                            assertEq(first[3], hasRest ? previousRest : null)
                            assertEq(first[4], label)
                            if (index === 0) {
                                assert(first !== previousPair)
                                previousPair = first
                                if (choices === 1) { heldBranch = read; heldSnapshot = captured }
                            } else { assertEq(first, previousPair) }
                            const expected = index === 0 ? (parameters.length === 0 ? -1 : start - tests)
                                : index === 1 ? (label === 0 ? expectedB : expectedA)
                                    : label === 0 ? expectedA : expectedB
                            assertEq(value, expected)
                            argumentsSeen += 1
                            argumentIndex += 1
                            if (mode === `argument${index}` && tests === 2) { throw stopped }
                            if (index === 2) {
                                if (parameters.length !== 0) {
                                    const priorA = expectedA
                                    expectedA = label === 0 ? expectedB : expectedA
                                    expectedB = label === 0 ? priorA : expectedB
                                }
                                argumentIndex = 0
                            }
                            return value
                        }),
                        () => {
                            assertEq(tests, start + 1)
                            assertEq(choices, start)
                            assertEq(argumentsSeen, start * 3)
                            assertEq(baseChoices, 0)
                            assertEq(finishes, 0)
                            baseChoices += 1
                            if (mode === 'baseChoice') { throw stopped }
                            return baseSelected
                        },
                        /** @type {(first: unknown, second: unknown, savedPair: unknown, finalRest: unknown) => readonly number[]} */ ((first, second, savedPair, finalRest) => {
                            assertEq(first, baseSelected ? expectedA : expectedB)
                            assertEq(second, baseSelected ? expectedB : expectedA)
                            assertEq(savedPair, parameters.length === 0 || start === 0 ? seed : previousPair)
                            assertEq(finalRest, hasRest ? previousRest : null)
                            assertEq(baseChoices, 1)
                            assertEq(finishes, 0)
                            finishes += 1
                            if (mode === 'base') { throw stopped }
                            return seed
                        }),
                        seed,
                    )
                    assertEq(run.length, arity)
                    /** @param {number} count @param {number} pattern @param {boolean} selected */
                    const invoke = (count, pattern, selected) => {
                        start = count
                        offset = pattern
                        tests = 0
                        choices = 0
                        argumentsSeen = 0
                        argumentIndex = 0
                        baseChoices = 0
                        finishes = 0
                        expectedA = parameters.length === 0 ? seed : tokenA
                        expectedB = parameters.length === 0 ? seed : tokenB
                        previousPair = undefined
                        previousRest = undefined
                        baseSelected = selected
                        mode = 'normal'
                        const value = run(count, tokenA, tokenB, () => seed)
                        assertEq(tests, count + 1)
                        assertEq(choices, count)
                        assertEq(argumentsSeen, count * 3)
                        assertEq(baseChoices, 1)
                        assertEq(finishes, 1)
                        assertEq(value[0], seed)
                        assertEq(value[0], value[1])
                        const snapshot = value[2]()
                        assertEq(snapshot[0], seed)
                        assertEq(snapshot[1], expectedA)
                        assertEq(snapshot[2], expectedB)
                        assertEq(snapshot[3], parameters.length === 0 || count === 0 ? seed : previousPair)
                        assertEq(snapshot[4], hasRest ? previousRest : null)
                        if (count !== 0) { assert(heldBranch !== undefined); assertStructurallySame(heldBranch(), heldSnapshot) }
                        if (hasRest) { assert(heldCondition !== undefined); assertEq(heldCondition(), heldRest) }
                        return value
                    }
                    for (const pattern of /** @type {const} */ ([0, 1])) {
                        const first = invoke(100_000, pattern, true)
                        const firstSnapshot = first[2]()
                        const firstHeld = heldBranch
                        const firstCaptured = heldSnapshot
                        const firstCondition = heldCondition
                        const firstRest = heldRest
                        const second = invoke(0, pattern, false)
                        assert(first !== second)
                        assert(first[2] !== second[2])
                        assertEq(first[0], second[0])
                        assertStructurallySame(first[2](), firstSnapshot)
                        assert(firstHeld !== undefined)
                        assertStructurallySame(firstHeld(), firstCaptured)
                        if (hasRest) { assert(firstCondition !== undefined); assertEq(firstCondition(), firstRest); assert(firstRest !== heldRest) }
                    }
                    for (const failureAt of /** @type {const} */ (['condition', 'selector', 'argument0', 'argument1', 'argument2', 'baseChoice', 'base'])) {
                        start = 3
                        offset = 0
                        tests = 0
                        choices = 0
                        argumentsSeen = 0
                        argumentIndex = 0
                        baseChoices = 0
                        finishes = 0
                        expectedA = parameters.length === 0 ? seed : tokenA
                        expectedB = parameters.length === 0 ? seed : tokenB
                        previousPair = undefined
                        previousRest = undefined
                        mode = failureAt
                        throws(() => run(3, tokenA, tokenB, () => seed), error => error === stopped)
                        const completing = failureAt === 'baseChoice' || failureAt === 'base'
                        assertEq(tests, completing ? 4 : 2)
                        assertEq(choices, completing ? 3 : failureAt === 'condition' ? 1 : 2)
                        assertEq(argumentsSeen, completing ? 9 : failureAt === 'argument0' ? 4 : failureAt === 'argument1' ? 5 : failureAt === 'argument2' ? 6 : 3)
                        assertEq(baseChoices, completing ? 1 : 0)
                        assertEq(finishes, failureAt === 'base' ? 1 : 0)
                    }
                }
            }
        }
    },
    conditionalBaseResultsKeepSelectedWorkAndFinalCaptures: async () => {
        const seed = /** @type {const} */ ([9])
        const token = /** @type {const} */ ([7])
        for (const [arity, parameters, test, recur, state] of /** @type {const} */ ([
            [0, '', 'test()', 'f()', '[0,seed]'],
            [2, 'n,a', 'test(n)', 'f(n-1,a)', '[n,a]'],
            [1, 'n,...xs', 'test(n,xs,xs,()=>xs)', 'f(n-1,...xs)', '[n,xs]'],
            [0, '...xs', 'test(xs[0],xs,xs,()=>xs)', 'f(xs[0]-1,...xs.slice(1))', '[xs[0],xs]'],
        ])) {
            const hasRest = parameters.includes('...')
            /** @type {string} */
            const base = `(()=>{const snapshot=${state};const common=prefix(snapshot,snapshot);return choose(common)?(()=>{const x=left(common);return[x,x,()=>[x,common],common];})():(()=>{const x=right(common);return[x,x,()=>[x,common],common];})();})()`
            for (const reversed of /** @type {const} */ ([false, true])) {
                /** @type {string} */
                const source = `export default(test,prefix,choose,left,right,seed)=>{const f=(${parameters})=>${reversed ? `!${test}?${base}:${recur}` : `${test}?${recur}:${base}`};return f;};`
                const root = /** @type {const} */ ({ main: [utf8(source)] })
                const [, interpreted] = virtualAt(root)(interpret(noRuntime)('main'))
                const graph = assertOk(interpreted)
                for (const text of [assertOk(tryStringify(graph)), stringify(graph)]) {
                    assert(text.includes('while('), text)
                    const make = (await load(text)).default
                    const stopped = new Error('stop in the selected conditional base path')
                    let start = 0
                    let tests = 0
                    let prefixes = 0
                    let choices = 0
                    let leaves = 0
                    let selected = true
                    let mode = 'normal'
                    /** @type {readonly unknown[] | undefined} */
                    let previousRest
                    /** @type {readonly unknown[] | undefined} */
                    let previousBase
                    /** @type {unknown} */
                    let heldRest
                    /** @type {(() => unknown) | undefined} */
                    let held
                    /** @type {(label: number, common: readonly unknown[]) => readonly unknown[]} */
                    const leaf = (label, common) => {
                        assertEq(label, selected ? 0 : 1)
                        assertEq(tests, start + 1)
                        assertEq(prefixes, 1)
                        assertEq(choices, 1)
                        assertEq(leaves, 0)
                        assertEq(common, previousBase)
                        leaves += 1
                        if (mode === 'leaf') { throw stopped }
                        return label === 0 ? common : seed
                    }
                    const run = make(
                        /** @type {(...inputs: readonly unknown[]) => boolean} */ ((...inputs) => {
                            if (parameters.length !== 0) { assertEq(inputs[0], start - tests) }
                            if (hasRest) {
                                const [, first, second, read] = inputs
                                assert(first instanceof Array)
                                assertEq(first, second)
                                assert(typeof read === 'function')
                                assertEq(read(), first)
                                assert(first !== previousRest)
                                if (tests === 0) { held = () => read(); heldRest = first }
                                previousRest = first
                            }
                            assertEq(prefixes, 0)
                            assertEq(choices, 0)
                            assertEq(leaves, 0)
                            tests += 1
                            if (mode === 'condition' && tests === start + 1) { throw stopped }
                            return tests <= start
                        }),
                        /** @type {(first: readonly unknown[], second: readonly unknown[]) => readonly unknown[]} */ ((first, second) => {
                            assertEq(tests, start + 1)
                            assertEq(prefixes, 0)
                            assertEq(choices, 0)
                            assertEq(leaves, 0)
                            assertEq(first, second)
                            assertEq(first[0], 0)
                            assertEq(first[1], parameters.length === 0 ? seed : hasRest ? previousRest : token)
                            assert(first !== previousBase)
                            previousBase = first
                            prefixes += 1
                            if (mode === 'prefix') { throw stopped }
                            return first
                        }),
                        /** @type {(common: readonly unknown[]) => boolean} */ (common => {
                            assertEq(tests, start + 1)
                            assertEq(prefixes, 1)
                            assertEq(choices, 0)
                            assertEq(leaves, 0)
                            assertEq(common, previousBase)
                            choices += 1
                            if (mode === 'choice') { throw stopped }
                            return selected
                        }),
                        /** @type {(common: readonly unknown[]) => readonly unknown[]} */ (common => leaf(0, common)),
                        /** @type {(common: readonly unknown[]) => readonly unknown[]} */ (common => leaf(1, common)),
                        seed,
                    )
                    assertEq(run.length, arity)
                    /** @param {number} n @param {boolean} branch */
                    const invoke = (n, branch) => {
                        start = n
                        tests = 0
                        prefixes = 0
                        choices = 0
                        leaves = 0
                        selected = branch
                        mode = 'normal'
                        previousRest = undefined
                        const value = run(n, token)
                        assertEq(tests, n + 1)
                        assertEq(prefixes, 1)
                        assertEq(choices, 1)
                        assertEq(leaves, 1)
                        assertEq(value[0], value[1])
                        assertEq(value[0], branch ? value[3] : seed)
                        assertEq(value[3], previousBase)
                        assertEq(value[2]()[0], value[0])
                        assertEq(value[2]()[1], value[3])
                        if (hasRest) {
                            assert(held !== undefined)
                            assertEq(held(), heldRest)
                            assertEq(heldRest === previousRest, n === 0)
                        }
                        return value
                    }
                    for (const branch of /** @type {const} */ ([false, true])) {
                        const first = invoke(100_000, branch)
                        const firstHeld = held
                        const firstRest = heldRest
                        const second = invoke(0, !branch)
                        assert(first !== second)
                        assert(first[3] !== second[3])
                        assert(first[2] !== second[2])
                        assertEq(first[2]()[0], first[0])
                        assertEq(first[2]()[1], first[3])
                        if (hasRest) {
                            assert(firstHeld !== undefined)
                            assertEq(firstHeld(), firstRest)
                            assert(firstRest !== heldRest)
                        }
                    }
                    for (const failureAt of /** @type {const} */ (['condition', 'prefix', 'choice', 'leaf'])) {
                        start = 2
                        tests = 0
                        prefixes = 0
                        choices = 0
                        leaves = 0
                        mode = failureAt
                        previousRest = undefined
                        throws(() => run(2, token), error => error === stopped)
                        assertEq(tests, 3)
                        assertEq(prefixes, failureAt === 'condition' ? 0 : 1)
                        assertEq(choices, failureAt === 'condition' || failureAt === 'prefix' ? 0 : 1)
                        assertEq(leaves, failureAt === 'leaf' ? 1 : 0)
                    }
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
    restOnlyBaseDefinitionsKeepFinalRestSnapshots: async () => {
        const restRead = /** @type {Exp} */ (['=>', 0, [['rest']], ['frame', 0]])
        const count = /** @type {Exp} */ (['.', ['rest'], 0])
        const snapshot = /** @type {Exp} */ (['[]', [['rest'], ['frame', 2]]])
        const base = /** @type {Exp} */ (['()', ['frame', 1], [snapshot, snapshot, ['frame', 2]]])
        const read = /** @type {Exp} */ (['=>', 0, [['rest'], base, ['frame', 2]],
            ['[]', [['frame', 0], ['frame', 1], ['frame', 2]]]])
        const result = /** @type {Exp} */ (['[]', [base, base, read, ['rest'], ['frame', 2]]])
        const test = /** @type {Exp} */ (['()', ['frame', 0], [['rest'], ['rest'], restRead]])
        const token = /** @type {const} */ ([7])
        for (const empty of /** @type {const} */ ([false, true])) {
            const recur = /** @type {Exp} */ (['()', ['self'], empty ? [] : [['-', count, 1], ['.', ['rest'], 1]]])
            for (const reversed of /** @type {const} */ ([false, true])) {
                const factory = /** @type {FunctionValue} */ (['=>', 2, [], ['=>', 0, [['arg', 0], ['arg', 1], ['[]', [9]]],
                    ['?:', reversed ? ['!', test] : test, reversed ? result : recur, reversed ? recur : result],
                ]])
                for (const text of [assertOk(tryStringify(factory)), stringify(factory)]) {
                    assert(text.includes('while('), text)
                    const make = await load(text)
                    const stopped = new Error('stop at the final rest-only invocation')
                    for (const returnSeed of /** @type {const} */ ([false, true])) {
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
                            /** @type {(first: readonly unknown[], second: readonly unknown[], read: () => readonly unknown[]) => boolean} */ ((first, second, read) => {
                                assertEq(first, second)
                                assertEq(read(), first)
                                assert(first !== previous)
                                assertStructurallySame(first, empty && (start === 0 || tests !== 0) ? [] : [start - tests, token])
                                if (tests === 0) { held = read; heldRest = first }
                                previous = first
                                tests += 1
                                if (mode === 'condition' && tests === start + 1) { throw stopped }
                                return tests <= start
                            }),
                            /** @type {(first: readonly unknown[], second: readonly unknown[], seed: readonly number[]) => readonly unknown[]} */ ((first, second, seed) => {
                                assertEq(tests, start + 1)
                                assertEq(bases, 0)
                                assertEq(first, second)
                                assertEq(first[0], previous)
                                assertEq(first[1], seed)
                                bases += 1
                                if (mode === 'base') { throw stopped }
                                return returnSeed ? seed : first
                            }),
                        )
                        assertEq(run.length, 0)
                        /** @param {number} n */
                        const invoke = n => {
                            start = n
                            tests = 0
                            bases = 0
                            mode = 'normal'
                            previous = undefined
                            const value = empty && n === 0 ? run() : run(n, token)
                            assertEq(tests, n + 1)
                            assertEq(bases, 1)
                            assertEq(value[0], value[1])
                            assertEq(value[3], previous)
                            assertStructurallySame(value[3], empty ? [] : [0, token])
                            if (returnSeed) { assertEq(value[0], value[4]) }
                            else {
                                assertEq(value[0][0], value[3])
                                assertEq(value[0][1], value[4])
                            }
                            const captured = value[2]()
                            assertEq(captured[0], value[3])
                            assertEq(captured[1], value[0])
                            assertEq(captured[2], value[4])
                            assert(held !== undefined)
                            assertEq(held(), heldRest)
                            assertEq(heldRest === value[3], n === 0)
                            return value
                        }
                        for (const n of /** @type {const} */ ([100_000, 0])) {
                            const first = invoke(n)
                            const second = invoke(n)
                            const retained = first[2]()
                            assertEq(retained[0], first[3])
                            assertEq(retained[1], first[0])
                            assertEq(retained[2], first[4])
                            assert(first !== second)
                            assertEq(first[0] === second[0], returnSeed)
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
                            throws(() => run(2, token), error => error === stopped)
                            assertEq(tests, 3)
                            assertEq(bases, failureAt === 'base' ? 1 : 0)
                        }
                    }
                }
            }
        }
    },
    restOnlyProjectionFirstResultsKeepCapturedRest: async () => {
        const count = /** @type {Exp} */ (['.', ['rest'], 0])
        const saved = /** @type {Exp} */ (['=>', 0, [['rest']], ['frame', 0]])
        const pair = /** @type {Exp} */ (['[]', [['rest']]])
        const read = /** @type {Exp} */ (['=>', 0, [pair], ['frame', 0]])
        const result = /** @type {Exp} */ (['[]', [['.', ['rest'], 1], read]])
        const recur = /** @type {Exp} */ (['()', ['self'], [['-', count, 1], saved,
            ['...', ['.', ['rest'], 'slice', ['|()', [2]]]],
        ]])
        const token = /** @type {const} */ ([7])
        for (const reversed of /** @type {const} */ ([false, true])) {
            const test = /** @type {Exp} */ (['>', count, 0])
            const fn = /** @type {FunctionValue} */ (['=>', 0, [],
                ['?:', reversed ? ['!', test] : test, reversed ? result : recur, reversed ? recur : result],
            ])
            for (const text of [assertOk(tryStringify(fn)), stringify(fn)]) {
                assert(text.includes('while('), text)
                const run = await load(text)
                assertEq(run.length, 0)
                const first = run(100_000, null, token)
                const finalPair = first[1]()
                const finalRest = finalPair[0]
                const priorRest = first[0]()
                assertEq(finalRest[0], 0)
                assertEq(finalRest[1], first[0])
                assertEq(finalRest[2], token)
                assertEq(priorRest[0], 1)
                assertEq(priorRest[2], token)
                assert(priorRest !== finalRest)
                assertEq(first[1](), finalPair)
                const second = run(1, null, token)
                assert(second[1]() !== finalPair)
                assertEq(first[1](), finalPair)
                assertEq(first[0](), priorRest)
                const zero = run(0, null, token)
                assertEq(zero[0], null)
                assertStructurallySame(zero[1](), [[0, null, token]])
                assert(zero[1]() !== finalPair)
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
