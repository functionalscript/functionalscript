/**
 * Compile complete generated modules at the JavaScript host boundary. Module
 * loading and ordinary callable execution are effects that FunctionalScript
 * proofs cannot perform; the sibling proof.f.mjs checks the generated text.
 * Inputs here are immutable EDAG values, including real interpreter output.
 *
 * @import { EdagValue, Function as FunctionValue } from '../../../edag/value/types.ts'
 */

import { throws } from 'node:assert/strict'
import { Buffer } from 'node:buffer'

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { interpret } from '../../transpiler/module.f.mjs'
import { emptyState, virtual } from '../../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../../text/module.f.mjs'
import { stringify } from './module.f.mjs'

/** Load the actual module syntax; distinct source comments request fresh instances.
 * @type {(value: EdagValue, instance?: string) => Promise<any>}
 */
const compile = async (value, instance = '') => {
    const source = Buffer.from(`${stringify(value)}\n// ${instance}`).toString('base64')
    const module = await import(`data:text/javascript;base64,${source}`)
    return module.default
}

export const proof = {
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
            ['&&', ['arg', 0], shared], ['||', ['arg', 1], shared],
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
        const [, result] = virtual({ ...emptyState, root })(interpret('main'))
        const exports = await compile(assertOk(result))
        assertEq(exports.call(3), 5)
        assertEq(exports.default[0], exports.call)
        assertEq(exports.default[1], exports.call)
        assertEq('edag' in exports.call, false)
    },
}
