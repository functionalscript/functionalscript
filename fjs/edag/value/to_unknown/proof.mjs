/**
 * The JavaScript runtime-compilation boundary loads generated factory modules
 * and executes ordinary callables. FunctionalScript proofs cannot perform
 * dynamic imports or invoke the host functions produced by this boundary.
 * Inputs are immutable EDAG values, including real interpreter results.
 *
 * @import { EdagValue } from '../types.ts'
 */

import { throws } from 'node:assert/strict'

import { assert, assertEq, assertOk, assertError, assertStructurallySame } from '../../../asserts/module.f.mjs'
import { interpret } from '../../../compiler/transpiler/module.f.mjs'
import { asyncPartialRun, asyncRun } from '../../../effects/module.mjs'
import { emptyState, virtual } from '../../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../../text/module.f.mjs'
import { isObject } from '../../../types/object/module.f.mjs'
import { compileCommands, toUnknown } from './module.f.mjs'
import { javascriptOperationMap } from './module.mjs'

const run = asyncRun(javascriptOperationMap)

/** @type {(value: unknown) => readonly any[]} */
const elements = value => {
    assert(Array.isArray(value))
    return value
}

/** @type {(value: unknown, name: string) => unknown} */
const field = (value, name) => {
    assert(isObject(value))
    return value[name]
}

/** @param {unknown} value */
const callable = value => {
    assert(typeof value === 'function')
    return value
}

export const proof = {
    interpretedExports: async () => {
        const root = {
            main: [utf8('import add from "./dep"; const f=add(2); export const call=f; export default [f,f];')],
            dep: [utf8('export default x=>y=>x+y;')],
        }
        const [, result] = virtual({ ...emptyState, root })(interpret('main'))
        const exports = assertOk(await run(toUnknown(assertOk(result))))
        const call = callable(field(exports, 'call'))
        const repeated = elements(field(exports, 'default'))
        assertEq(call(3), 5)
        assertEq(call.length, 1)
        assertEq(repeated[0], call)
        assertEq(repeated[1], call)
        assertEq('edag' in call, false)
    },
    ordinaryCallbacks: async () => {
        const apply = callable(assertOk(await run(toUnknown(['=>', 1, [], ['()', ['arg', 0], [1]]]))))
        assertEq(apply(/** @param {number} x */ x => x + 2), 3)
        const returned = apply(/** @param {number} x */ x => /** @param {number} y */ y => x + y)
        assertEq(returned(4), 5)
        const identity = callable(assertOk(await run(toUnknown(['=>', 1, [], ['arg', 0]]))))
        const ordinary = { items: [1, 2] }
        assertEq(identity(ordinary), ordinary)
        const add = callable(assertOk(await run(toUnknown(['=>', 1, [2], ['+', ['frame', 0], ['arg', 0]]]))))
        assertStructurallySame([1, 2].map(x => add(x)), [3, 4])
    },
    sharedValuesAndFreshConversions: async () => {
        const data = /** @type {const} */ (['[]', [4]])
        const first = /** @type {const} */ (['=>', 0, [data], ['frame', 0]])
        const second = /** @type {const} */ (['=>', 0, [data], ['frame', 0]])
        /** @type {EdagValue} */
        const value = ['[]', [data, data, first, first, second]]
        const [a, b, f, repeated, g] = elements(assertOk(await run(toUnknown(value))))
        assertEq(a, b)
        assertEq(f, repeated)
        assert(f !== g)
        assertEq(f(), a)
        assertEq(g(), a)
        const [freshData, , freshFunction] = elements(assertOk(await run(toUnknown(value))))
        assert(freshData !== a)
        assert(freshFunction !== f)
        assertEq(freshFunction(), freshData)
    },
    perInvocationValues: async () => {
        const captured = /** @type {const} */ (['[]', [4]])
        const fresh = /** @type {const} */ (['[]', [['arg', 0]]])
        const make = callable(assertOk(await run(toUnknown(['=>', 1, [captured],
            ['[]', [['frame', 0], fresh, fresh]],
        ]))))
        const first = make(1)
        const second = make(2)
        assertEq(first[0], second[0])
        assertEq(first[1], first[2])
        assertEq(second[1], second[2])
        assert(first[1] !== second[1])
        assertStructurallySame(first, [[4], [1], [1]])
        assertStructurallySame(second, [[4], [2], [2]])
    },
    requiredArity: async () => {
        const fn = callable(assertOk(await run(toUnknown(['=>', 16, [],
            ['[]', [['arg', 0], ['arg', 15], ['rest']]],
        ]))))
        assertEq(fn.length, 16)
        assertStructurallySame(fn(...Array.from({ length: 18 }, (_, i) => i)), [0, 15, [16, 17]])
        assertStructurallySame(fn(3), [3, undefined, []])
    },
    thrownCaptureIdentity: async () => {
        const payload = /** @type {const} */ (['{}', [[':', 'message', 'failure']]])
        const fail = /** @type {const} */ (['=>', 0, [payload], ['throw', ['frame', 0]]])
        const [ordinaryPayload, ordinaryFail] = elements(assertOk(await run(toUnknown(['[]', [payload, fail]]))))
        throws(() => ordinaryFail(), thrown => thrown === ordinaryPayload)
        assertStructurallySame(ordinaryPayload, { message: 'failure' })
    },
    interpretedThrownValue: async () => {
        const root = { main: [utf8('const shared=[]; const get=()=>shared; throw [shared,get,get];')] }
        const [, result] = virtual({ ...emptyState, root })(interpret('main'))
        const failure = assertError(result)
        assert('thrown' in failure)
        const [shared, get, repeated] = elements(assertOk(await run(toUnknown(failure.thrown))))
        assertEq(get, repeated)
        assertEq(get(), shared)
        assertStructurallySame(shared, [])
    },
    ordinaryThenProperty: async () => {
        const root = { main: [utf8('export default {then:()=>{throw "must not run";},value:7};')] }
        const [, result] = virtual({ ...emptyState, root })(interpret('main'))
        const represented = assertOk(result)
        assert(Array.isArray(represented) && represented[0] === '{}')
        const value = represented[1][0][2]
        const ordinary = assertOk(await run(toUnknown(value)))
        assertEq(field(ordinary, 'value'), 7)
        const then = callable(field(ordinary, 'then'))
        throws(() => then(), thrown => thrown === 'must not run')
    },
    dataWithoutLoader: async () => {
        const data = /** @type {const} */ (['{}', [[':', 'items', ['[]', [3n, '😀', ['undefined']]]]]])
        const result = await asyncPartialRun(compileCommands)({})(toUnknown(data))
        assertStructurallySame(assertOk(result), { items: [3n, '😀', undefined] })
    },
    missingLoader: async () => {
        const value = /** @type {const} */ (['=>', 0, [], 1])
        const result = await asyncPartialRun(compileCommands)({})(toUnknown(value))
        assertStructurallySame(assertError(result), ['notImplemented', 'compileValue'])
    },
    invalidModuleSyntax: async () => {
        const failure = assertError(await javascriptOperationMap.compileValue('export default ('))
        assertEq(failure[0], 'ioError')
        assert(failure[0] === 'ioError' && failure[1].message.length > 0)
    },
}
