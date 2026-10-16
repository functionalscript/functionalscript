/** @import { Dir } from '../../effects/node/virtual/types.ts' */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'
import { step } from '../../effects/module.f.mjs'
import { emptyState, virtual, virtualAt } from '../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { edagPath, generate, load, rustPath, source } from './module.f.mjs'

/** A root holding `text` at the runtime's path. @type {(text: string) => Dir} */
const withRuntime = text => ({ 'fjs': { 'js': { 'runtime': { 'module.f.js': [utf8(text)] } } } })

export const proof = {
    paths: () => {
        assertEq(source, './fjs/js/runtime/module.f.js')
        assertEq(rustPath, 'nanvm/lib/src/vm/gen.runtime.rs')
        assertEq(edagPath, 'fjs/js/runtime/gen.edag.data.mjs')
    },
    // Both compiles, in order: the static runtime, a module holding one
    // body, read back as the item it becomes; the EDAG, read back as the
    // graph; and the first compile failing stops the second — a source the
    // linker refuses, and a module the static printer refuses, a body that
    // is no function.
    generate: () => {
        const text = 'export const runtime = { member: { String: { x: () => 1 } } };'
        const [state, result] = virtualAt(withRuntime(text))(generate())
        assertOk(result)
        const [, rust] = virtual(state)(readUtf8File(rustPath))
        assert(assertOk(rust).includes('("String", "x", string_x)'))
        const [, edag] = virtual(state)(readUtf8File(edagPath))
        assertEq(assertOk(edag), 'export default ["{}",[[":","runtime",["{}",[[":","member",["{}",[[":","String",["{}",[[":","x",["=>",0,[],1]]]]]]]]]]]]];')
        const [broken, failed] = virtualAt(withRuntime('export default ('))(step(generate(), () => readUtf8File(edagPath)))
        assertEq(failed[0], 'error')
        assertEq(Object.keys(broken.root).join(','), 'fjs')
        const [, refused] = virtualAt(withRuntime('export const runtime = { member: { String: { x: 1 } } };'))(generate())
        assert(JSON.stringify(assertError(refused)).includes('a built-in that is no function: String.prototype.x'))
    },
    // The `runtime` export as a value, or the reason there is none: a source
    // the interpreter cannot load, or an export that is no object.
    load: () => {
        const [, result] = virtualAt(withRuntime('export const runtime = { member: { String: { x: 1 } } };'))(load())
        assertStructurallySame(assertOk(result), ['{}', [[':', 'member', ['{}', [[':', 'String', ['{}', [[':', 'x', 1]]]]]]]]])
        const [, unreadable] = virtual(emptyState)(load())
        assertEq(unreadable[0], 'error')
        const [, notAnObject] = virtualAt(withRuntime('export const runtime = 1;'))(load())
        assertEq(notAnObject[0], 'error')
        const [, noExport] = virtualAt(withRuntime('export default 1;'))(load())
        assertEq(noExport[0], 'error')
    },
}
