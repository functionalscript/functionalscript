/**
 * Source-to-runtime integration through JavaScript's compile/load boundary.
 * FunctionalScript proofs cannot load generated modules or invoke the ordinary
 * host callables returned by transpile. Source I/O uses the existing virtual
 * operations; runtime compilation uses the real JavaScript operation.
 *
 * @import { CompileValue } from '../../edag/value/to_unknown/types.ts'
 * @import { ToAsyncOperationMap } from '../../effects/types.ts'
 * @import { ReadFile, ResolveFileModule } from '../../effects/node/types.ts'
 * @import { Dir } from '../../effects/node/virtual/types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.mjs'
import { javascriptOperationMap } from '../../edag/value/to_unknown/module.mjs'
import { asyncRun } from '../../effects/module.mjs'
import { emptyState, virtualOperationMap } from '../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { isObject } from '../../types/object/module.f.mjs'
import { transpile } from './module.f.mjs'

/** @param {Dir} root */
const run = root => {
    const state = { ...emptyState, root }
    const { readFile, resolveFileModule } = virtualOperationMap
    /** @type {ToAsyncOperationMap<ReadFile | ResolveFileModule | CompileValue>} */
    const map = {
        ...javascriptOperationMap,
        readFile: async path => readFile(path)(state)[1],
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
    importedCallableExports: async () => {
        const root = {
            main: [utf8('import add from "./dep"; const call=add(2); export const apply=callback=>callback(call(3)); export default [call,call];')],
            dep: [utf8('export default x=>y=>x+y;')],
        }
        const exports = assertOk(await run(root)(transpile('main')))
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
        const first = assertOk(await runtime(transpile('main')))
        const second = assertOk(await runtime(transpile('main')))
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
