/**
 * Proofs for the demo publisher: a small module shaped like the demo one, in
 * the virtual filesystem, published and read back.
 *
 * @import { Dir } from '../../../effects/node/virtual/types.ts'
 * @import { Module } from '../../../media/wasm/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { exitCode, readUtf8File, readWholeBytes } from '../../../effects/node/module.f.mjs'
import { nodeProgramOptions, virtual, virtualAt } from '../../../effects/node/virtual/module.f.mjs'
import { write } from '../../../media/wasm/binary/write/module.f.mjs'
import { emptyModule } from '../../../media/wasm/testlib.f.js'
import { utf8 } from '../../../text/module.f.mjs'
import { u8ListToVecMsb } from '../../../types/bit_vec/module.f.mjs'
import { toArray } from '../../../types/list/alt/module.f.js'
import { demangleNames, main, publish, sampleWats, usage } from './module.f.mjs'

/** `nanvm_demos::samples::hello::module` in v0 mangling. */
const sample = '_RNvNtNtCs1234_11nanvm_demos7samples5hello6module'

/**
 * A module importing one function and defining two, named in its name
 * section: `$hi` inside `nanvm_demos::samples::hello`, and `$other` outside
 * it.
 *
 * @type {Module}
 */
const module = {
    ...emptyModule,
    types: [{ params: [], results: [] }],
    imports: [{ module: 'm', name: 'f', desc: ['func', 0] }],
    functions: [{ type: 0, locals: [], body: [] }, { type: 0, locals: [], body: [['nop']] }],
    customs: [
        { after: 'type', content: ['raw', 'producers', []] },
        { after: 'code', content: ['name', [['module', 'm'], ['function', [[1, 'other'], [2, sample]]]]] },
    ],
}

const bytes = write(module)

/** The WAT of the sample's one function. */
const helloWat = '  (func $nanvm_demos::samples::hello::module (;2;) (type 0)\n    nop\n  )\n'

/** @type {(files: Dir) => Dir} */
const tree = files => ({ 'built.wasm': [u8ListToVecMsb(bytes)], ...files })

export const proof = {
    // The function names, and nothing else.
    demangleNames: () => {
        const named = demangleNames(module)
        assertStructurallySame(named.customs, [
            module.customs[0],
            { after: 'code', content: ['name', [['module', 'm'], ['function', [[1, 'other'], [2, 'nanvm_demos::samples::hello::module']]]]] },
        ])
    },
    sampleWats: () => {
        assertStructurallySame(assertOk(sampleWats(module, ['hello'])), [['hello', helloWat]])
        assertEq(assertError(sampleWats(module, ['hello', 'goodbye'])), 'no functions of the sample `goodbye`')
        // A module with no names has no sample.
        assertEq(assertError(sampleWats({ ...module, customs: [] }, ['hello'])), 'no functions of the sample `hello`')
    },
    // The bytes copied as they were, the sample's WAT written, a removed
    // sample's WAT removed, and everything else in the directory kept.
    publish: () => {
        const root = tree({ 'b': { 'gone.wat': [utf8('')], 'notes.txt': [utf8('')], 'dir.wat': {}, '.wat': [utf8('')] } })
        const [state, result] = virtualAt(root)(publish('built.wasm', 'a/published.wasm', 'b', ['hello']))
        assertOk(result)
        assertStructurallySame(toArray(assertOk(virtual(state)(readWholeBytes('a/published.wasm'))[1])), bytes)
        assertEq(assertOk(virtual(state)(readUtf8File('b/hello.wat'))[1]), helloWat)
        assertEq(virtual(state)(readUtf8File('b/gone.wat'))[1][0], 'error')
        assertOk(virtual(state)(readUtf8File('b/notes.txt'))[1])
        assertOk(virtual(state)(readUtf8File('b/.wat'))[1])
        assert(state.root['b'] !== undefined && 'dir.wat' in state.root['b'])
    },
    // An input that is no module, or a sample with no functions, is reported
    // with the input's path, before anything is written.
    refusals: () => {
        /** @type {(root: Dir, samples: readonly string[], message: string) => void} */
        const refused = (root, samples, message) => {
            const [state, result] = virtualAt(root)(publish('built.wasm', 'a/published.wasm', 'b', samples))
            assertStructurallySame(result, ['error', ['ioError', { message }]])
            assertEq(state.root['a'], undefined)
        }
        refused({ 'built.wasm': [utf8('not wasm')] }, ['hello'], 'built.wasm: not a WebAssembly module at byte 0')
        refused(tree({}), ['goodbye'], 'built.wasm: no functions of the sample `goodbye`')
    },
    missing: () => {
        const [, result] = virtualAt({})(publish('built.wasm', 'a/published.wasm', 'b', ['hello']))
        assertEq(result[0], 'error')
    },
    main: () => {
        const [usageState, usageCode] = virtualAt({})(main(nodeProgramOptions(['a', 'b'])))
        assertEq(exitCode(usageCode), 1)
        assertEq(usageState.stderr, `${usage}\n`)
        const [, code] = virtualAt(tree({}))(main(nodeProgramOptions(['built.wasm', 'a/published.wasm', 'b', 'hello'])))
        assertEq(exitCode(code), 0)
    },
}
