/**
 * Proofs for the demo publisher: a small module shaped like the demo one, in
 * the virtual filesystem, published and read back.
 *
 * @import { Dir } from '../../../effects/node/virtual/types.ts'
 * @import { Module } from '../../../media/wasm/types.ts'
 * @import { Place } from '../page/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { errorMessage } from '../../../effects/module.f.mjs'
import { exitCode, readUtf8File, readWholeBytes } from '../../../effects/node/module.f.mjs'
import { nodeProgramOptions, virtual, virtualAt } from '../../../effects/node/virtual/module.f.mjs'
import { write } from '../../../media/wasm/binary/write/module.f.mjs'
import { emptyModule } from '../../../media/wasm/testlib.f.js'
import { utf8 } from '../../../text/module.f.mjs'
import { u8ListToVecMsb } from '../../../types/bit_vec/module.f.mjs'
import { toArray } from '../../../types/list/alt/module.f.js'
import { fromTagged, toText, untagged } from '../../../text/marked/module.f.mjs'
import { generate } from '../module.f.mjs'
import { rustPath } from '../page/module.f.mjs'
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

/** @type {readonly Place[]} */
const places = [{ name: 'hello', directory: 'fjs/nanvm/demos/hello' }]

/** @type {(source: string) => Dir} */
const sourceTree = source => ({ 'fjs': { 'nanvm': { 'demos': { 'hello': { 'sample.f.js': [utf8(source)] } } } } })

/** @type {(files: Dir) => Dir} */
const tree = files => ({
    'built.wasm': [u8ListToVecMsb(bytes)],
    ...sourceTree('export default () => 1;'),
    ...files,
})

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
        const [[sample, marked]] = assertOk(sampleWats(module, ['hello']))
        assertEq(sample, 'hello')
        // The WAT's words carry their kinds; their text is the WAT.
        assertEq(toText(marked), helloWat)
        assertStructurallySame(marked.slice(0, 4), [['  ('], ['func', 'keyword'], [' '], ['$nanvm_demos::samples::hello::module', 'identifier']])
        assertEq(assertError(sampleWats(module, ['hello', 'goodbye'])), 'no functions of the sample `goodbye`')
        // A module with no names has no sample.
        assertEq(assertError(sampleWats({ ...module, customs: [] }, ['hello'])), 'no functions of the sample `hello`')
    },
    // The bytes copied as they were, both marked assets written, a removed
    // sample's marked assets removed, and everything else in the directory kept.
    publish: () => {
        const root = tree({ 'b': {
            'gone.wat.marked': [utf8('')],
            'gone.rs.marked': [utf8('')],
            'gone.rs': [utf8('plain Rust is kept')],
            'notes.txt': [utf8('')],
            'dir.wat.marked': {},
            'dir.rs.marked': {},
            '.wat.marked': [utf8('')],
            '.rs.marked': [utf8('')],
        } })
        const [generated, generatedResult] = virtualAt(root)(generate(places))
        assertOk(generatedResult)
        const [state, result] = virtual(generated)(publish('built.wasm', 'a/published.wasm', 'b', places))
        assertOk(result)
        assertStructurallySame(toArray(assertOk(virtual(state)(readWholeBytes('a/published.wasm'))[1])), bytes)
        assertEq(untagged(assertOk(virtual(state)(readUtf8File('b/hello.wat.marked'))[1])), helloWat)
        assertEq(virtual(state)(readUtf8File('b/hello.wat'))[1][0], 'error')
        // The build artifact has the producer's kinds and exactly the Rust
        // the committed sample generator writes for Cargo.
        const marked = assertOk(fromTagged(assertOk(virtual(state)(readUtf8File('b/hello.rs.marked'))[1])))
        assertEq(toText(marked), assertOk(virtual(state)(readUtf8File(rustPath('hello')))[1]))
        assert(marked.some(([, kind]) => kind === 'comment'))
        assert(marked.some(([, kind]) => kind === 'keyword'))
        assert(marked.some(([, kind]) => kind === 'identifier'))
        assert(marked.some(([, kind]) => kind === 'number'))
        assertEq(virtual(state)(readUtf8File('b/hello.rs'))[1][0], 'error')
        assertEq(virtual(state)(readUtf8File('b/gone.wat.marked'))[1][0], 'error')
        assertEq(virtual(state)(readUtf8File('b/gone.rs.marked'))[1][0], 'error')
        assertOk(virtual(state)(readUtf8File('b/gone.rs'))[1])
        assertOk(virtual(state)(readUtf8File('b/notes.txt'))[1])
        assertOk(virtual(state)(readUtf8File('b/.wat.marked'))[1])
        assertOk(virtual(state)(readUtf8File('b/.rs.marked'))[1])
        assert(state.root['b'] !== undefined && 'dir.wat.marked' in state.root['b'])
        assert(state.root['b'] !== undefined && 'dir.rs.marked' in state.root['b'])
    },
    // An input that is no module, or a sample with no functions, is reported
    // with the input's path, before anything is written.
    refusals: () => {
        /** @type {(root: Dir, samples: readonly Place[], message: string) => void} */
        const refused = (root, samples, message) => {
            const [state, result] = virtualAt(root)(publish('built.wasm', 'a/published.wasm', 'b', samples))
            assertStructurallySame(result, ['error', ['ioError', { message }]])
            assertEq(state.root['a'], undefined)
        }
        refused({ 'built.wasm': [utf8('not wasm')] }, places, 'built.wasm: not a WebAssembly module at byte 0')
        refused(tree({}), [{ name: 'goodbye', directory: 'missing' }], 'built.wasm: no functions of the sample `goodbye`')
    },
    // A refused source is diagnosed before the module or any marked asset
    // replaces an existing build. No committed Rust is written by publish.
    refusedRust: () => {
        /** @type {Module} */
        const twoSamples = {
            ...module,
            customs: [{ after: 'code', content: ['name', [['function', [
                [1, 'nanvm_demos::samples::hello::module'],
                [2, 'nanvm_demos::samples::goodbye::module'],
            ]]]] }],
        }
        const root = tree({
            'built.wasm': [u8ListToVecMsb(write(twoSamples))],
            'fjs': { 'nanvm': { 'demos': {
                'hello': { 'sample.f.js': [utf8('export default () => 1;')] },
                'goodbye': { 'sample.f.js': [utf8('export default (')] },
            } } },
            'a': { 'published.wasm': [utf8('old module')] },
            'b': { 'hello.rs.marked': [utf8('old Rust')] },
        })
        const [state, result] = virtualAt(root)(publish('built.wasm', 'a/published.wasm', 'b', [...places, { name: 'goodbye', directory: 'fjs/nanvm/demos/goodbye' }]))
        assert(errorMessage(assertError(result)).startsWith('fjs/nanvm/demos/goodbye/sample.f.js'))
        assertEq(assertOk(virtual(state)(readUtf8File('a/published.wasm'))[1]), 'old module')
        assertEq(assertOk(virtual(state)(readUtf8File('b/hello.rs.marked'))[1]), 'old Rust')
        assertEq(virtual(state)(readUtf8File(rustPath('hello')))[1][0], 'error')
    },
    missingSource: () => {
        const [state, result] = virtualAt(tree({ 'fjs': {} }))(publish('built.wasm', 'a/published.wasm', 'b', places))
        assert(errorMessage(assertError(result)).startsWith('fjs/nanvm/demos/hello/sample.f.js'))
        assertEq(state.root['a'], undefined)
        assertEq(state.root['b'], undefined)
    },
    missing: () => {
        const [, result] = virtualAt({})(publish('built.wasm', 'a/published.wasm', 'b', places))
        assertEq(result[0], 'error')
    },
    main: () => {
        for (const args of [[], ['a'], ['a', 'b']]) {
            const [usageState, usageCode] = virtualAt({})(main(nodeProgramOptions(args)))
            assertEq(exitCode(usageCode), 1)
            assertEq(usageState.stderr, `${usage}\n`)
        }
        const [unknownState, unknownCode] = virtualAt({})(main(nodeProgramOptions(['built.wasm', 'a/published.wasm', 'b', 'unknown'])))
        assertEq(exitCode(unknownCode), 1)
        assertEq(unknownState.stderr, 'unknown sample `unknown`\n')
        const [, code] = virtualAt(tree({}))(main(nodeProgramOptions(['built.wasm', 'a/published.wasm', 'b', 'hello'])))
        assertEq(exitCode(code), 0)
        const [, emptyCode] = virtualAt(tree({}))(main(nodeProgramOptions(['built.wasm', 'a/published.wasm', 'b'])))
        assertEq(exitCode(emptyCode), 0)
    },
}
