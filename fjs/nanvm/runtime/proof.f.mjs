import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'
import { step } from '../../effects/module.f.mjs'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { edagPath, generate, load, rustPath, source } from './module.f.mjs'

/** A root holding `text` at the runtime's path. @type {(text: string) => typeof emptyState} */
const withRuntime = text => ({ ...emptyState, root: { 'fjs': { 'js': { 'runtime': { 'module.f.js': [utf8(text)] } } } } })

export const proof = {
    paths: () => {
        assertEq(source, './fjs/js/runtime/module.f.js')
        assertEq(rustPath, 'nanvm/lib/src/vm/gen.runtime.rs')
        assertEq(edagPath, 'fjs/js/runtime/gen.edag.data.mjs')
    },
    // Both compiles, in order, through the compiler: a module holding one
    // entry, read back from each output; and the first compile failing
    // stops the second.
    generate: () => {
        const text = 'export const runtime = { string: { x: 1 } };'
        const [state, result] = virtual(withRuntime(text))(generate())
        assertOk(result)
        const [, rust] = virtual(state)(readUtf8File(rustPath))
        assert(assertOk(rust).includes('string_key("x")'))
        const [, edag] = virtual(state)(readUtf8File(edagPath))
        assertEq(assertOk(edag), 'export default ["{}",[[":","runtime",["{}",[[":","string",["{}",[[":","x",1]]]]]]]]];')
        const [broken, failed] = virtual(withRuntime('export default ('))(step(generate(), () => readUtf8File(edagPath)))
        assertEq(failed[0], 'error')
        assertEq(Object.keys(broken.root).join(','), 'fjs')
    },
    // The `runtime` export as a value, or the reason there is none: a source
    // the interpreter cannot load, or an export that is no object.
    load: () => {
        const [, result] = virtual(withRuntime('export const runtime = { string: { x: 1 } };'))(load())
        assertStructurallySame(assertOk(result), ['{}', [[':', 'string', ['{}', [[':', 'x', 1]]]]]])
        const [, unreadable] = virtual(emptyState)(load())
        assertEq(unreadable[0], 'error')
        const [, notAnObject] = virtual(withRuntime('export const runtime = 1;'))(load())
        assertEq(notAnObject[0], 'error')
        const [, noExport] = virtual(withRuntime('export default 1;'))(load())
        assertEq(noExport[0], 'error')
    },
}
