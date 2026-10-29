/**
 * Source-to-runtime integration through JavaScript's compile/load boundary.
 * FunctionalScript proofs cannot load generated modules or invoke the ordinary
 * host callables returned by transpile. Source I/O uses the existing virtual
 * operations; runtime compilation uses the real JavaScript operation.
 *
 * @import { CompileValue } from '../../edag/value/to_unknown/types.ts'
 * @import { ToAsyncOperationMap } from '../../effects/types.ts'
 * @import { ReadWhole, ResolveFileModule } from '../../effects/node/types.ts'
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { javascriptOperationMap } from '../../edag/value/to_unknown/module.mjs'
import { asyncRun } from '../../effects/module.mjs'
import { emptyState, virtualOperationMap } from '../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { isObject } from '../../types/object/module.f.mjs'
import { noRuntime, transpile } from './module.f.mjs'

/** @param {Dir} root */
const run = root => {
    const state = { ...emptyState, root }
    const { readWhole, resolveFileModule } = virtualOperationMap
    /** @type {ToAsyncOperationMap<ReadWhole | ResolveFileModule | CompileValue>} */
    const map = {
        ...javascriptOperationMap,
        readWhole: async path => readWhole(path)(state)[1],
        resolveFileModule: async (name, parent) => resolveFileModule(name, parent)(state)[1],
    }
    return asyncRun(map)
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

/** @type {(value: unknown) => readonly unknown[]} */
const elements = value => {
    assert(Array.isArray(value))
    return value
}

export const proof = {
    compoundAssignmentCallbacks: async () => {
        /** @type {readonly (readonly [string, string, number, number, number])[]} */
        const operators = [
            ['add', '+=', 7, 3, 10],
            ['subtract', '-=', 7, 3, 4],
            ['multiply', '*=', 7, 3, 21],
            ['divide', '/=', 12, 3, 4],
            ['remainder', '%=', 7, 3, 1],
            ['power', '**=', 2, 3, 8],
            ['left', '<<=', 7, 1, 14],
            ['right', '>>=', -8, 1, -4],
            ['unsigned', '>>>=', -8, 1, 0x7fff_fffc],
            ['and', '&=', 7, 3, 3],
            ['xor', '^=', 7, 3, 4],
            ['or', '|=', 4, 3, 7],
        ]
        const source = operators.map(([name, operator]) =>
            `export const ${name}=(a,right)=>{a ${operator} right(a);return a;};`).join('')
        const exports = assertOk(await run({ main: [utf8(source)] })(transpile(noRuntime)('main')))
        for (const [name, , initial, operand, expected] of operators) {
            let calls = 0
            const result = callable(field(exports, name))(initial, /** @param {unknown} before */ before => {
                calls += 1
                assertEq(before, initial)
                return operand
            })
            assertEq(result, expected)
            assertEq(calls, 1)
        }
        let calls = 0
        assertEq(callable(field(exports, 'right'))(-8n, /** @param {unknown} before */ before => {
            calls += 1
            assertEq(before, -8n)
            return 1n
        }), -4n)
        assertEq(calls, 1)
        assertEq(callable(field(exports, 'add'))('a', () => 'b'), 'ab')
    },
    logicalAssignmentCallbacks: async () => {
        const exports = assertOk(await run({ main: [utf8(
            'export const and=(a,right)=>{a &&= right(a);return a;};' +
            'export const or=(a,right)=>{a ||= right(a);return a;};' +
            'export const nullish=(a,right)=>{a ??= right(a);return a;};',
        )] })(transpile(noRuntime)('main')))
        const present = {}
        const cases = [
            { name: 'and', skipped: [false, 0, -0, 0n, '', NaN, null, undefined], taken: [true, 1, 1n, 'x', present] },
            { name: 'or', skipped: [true, 1, 1n, 'x', present], taken: [false, 0, -0, 0n, '', NaN, null, undefined] },
            { name: 'nullish', skipped: [false, 0, -0, 0n, '', NaN, true, 1, 'x', present], taken: [null, undefined] },
        ]
        for (const { name, skipped, taken } of cases) {
            const apply = callable(field(exports, name))
            for (const initial of skipped) {
                let calls = 0
                const result = apply(initial, () => {
                    calls += 1
                    throw 'logical assignment evaluated a skipped operand'
                })
                assert(Object.is(result, initial))
                assertEq(calls, 0)
            }
            for (const initial of taken) {
                const marker = {}
                let calls = 0
                const result = apply(initial, /** @param {unknown} before */ before => {
                    calls += 1
                    assert(Object.is(before, initial))
                    return marker
                })
                assertEq(result, marker)
                assertEq(calls, 1)
            }
        }
    },
    templateCallableExports: async () => {
        const exports = assertOk(await run({
            main: [utf8('export const template = x => y => `head${x}:${y}tail`; export const explicit = x => y => "head" + String(x) + ":" + String(y) + "tail"; export default x => `own:${{ toString: () => x, valueOf: () => 7 }}`;')],
        })(transpile(noRuntime)('main')))
        const template = callable(callable(field(exports, 'template'))(1n))
        const explicit = callable(callable(field(exports, 'explicit'))(1n))
        for (const value of [null, undefined, true, -0, 'a']) {
            assertEq(template(value), `head${1n}:${value}tail`)
            assertEq(template(value), explicit(value))
        }
        const own = callable(field(exports, 'default'))
        assertEq(own('captured'), 'own:captured')
        assertEq(own(false), 'own:false')
    },
    importedCallableExports: async () => {
        const root = {
            main: [utf8('import add from "./dep"; const call=add(2); export const apply=callback=>callback(call(3)); export default [call,call];')],
            dep: [utf8('export default x=>y=>x+y;')],
        }
        const exports = assertOk(await run(root)(transpile(noRuntime)('main')))
        const [first, repeated] = elements(field(exports, 'default'))
        const call = callable(first)
        assertEq(call(3), 5)
        assertEq(call.length, 1)
        assertEq(call, repeated)
        assertEq('edag' in call, false)
        const apply = callable(field(exports, 'apply'))
        assertEq(apply(/** @param {number} value */ value => value + 1), 6)
    },
    freshRuntimeGraphs: async () => {
        const runtime = run({
            main: [utf8('const shared=[]; export const value=shared; export default x=>{const fresh=[x]; return [shared,fresh,fresh];};')],
        })
        const first = assertOk(await runtime(transpile(noRuntime)('main')))
        const second = assertOk(await runtime(transpile(noRuntime)('main')))
        const shared = field(first, 'value')
        const make = callable(field(first, 'default'))
        const freshMake = callable(field(second, 'default'))
        assert(make !== freshMake)
        assert(shared !== field(second, 'value'))
        assertEq(elements(freshMake(3))[0], field(second, 'value'))
        const a = elements(make(1))
        const b = elements(make(2))
        assertEq(a[0], shared)
        assertEq(b[0], shared)
        assertEq(a[1], a[2])
        assertEq(b[1], b[2])
        assert(a[1] !== b[1])
        assertStructurallySame(a, [[], [1], [1]])
        assertStructurallySame(b, [[], [2], [2]])
    },
}
