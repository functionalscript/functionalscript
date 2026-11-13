/**
 * Proofs for the marked Rust writer: samples in the virtual filesystem,
 * compiled, and the marked files read back against the `.rs` `generate`
 * writes.
 *
 * @import { Dir } from '../../../effects/node/virtual/types.ts'
 */

import { assert, assertEq, assertOk } from '../../../asserts/module.f.js'
import { exitCode, readdir, readUtf8File } from '../../../effects/node/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual, virtualAt } from '../../../effects/node/virtual/module.f.mjs'
import { untagged } from '../../../text/marked/module.f.mjs'
import { utf8 } from '../../../text/module.f.js'
import { generate, rustPath } from '../module.f.mjs'
import { rustMarkedPath } from '../page/module.f.mjs'
import { main, writeMarked } from './module.f.mjs'

/** Two samples, and a build directory a removed sample left its files in. @type {Dir} */
const root = {
    'fjs': { 'nanvm': { 'demos': {
        'a': { 'sample.f.js': [utf8('export default () => 1;')] },
        'b': { 'sample.f.js': [utf8('export default () => 2;')] },
    } } },
    'nanvm': { 'demos': { 'wasm': {
        'gone.rs.marked': [utf8('')],
        'gone.wat.marked': [utf8('')],
        'dir.rs.marked': {},
    } } },
}

const places = [{ name: 'a', directory: 'fjs/nanvm/demos/a' }, { name: 'b', directory: 'fjs/nanvm/demos/b' }]

export const proof = {
    // Each sample's marked Rust, whose text is the `.rs` `generate` writes;
    // a removed sample's marked Rust removed, and everything else kept.
    writeMarked: () => {
        const [generated] = virtualAt(root)(generate(places))
        const [state, result] = virtual(generated)(writeMarked(places))
        assertOk(result)
        for (const { name } of places) {
            const [, rs] = virtual(state)(readUtf8File(rustPath(name)))
            const [, marked] = virtual(state)(readUtf8File(rustMarkedPath(name)))
            assertEq(untagged(assertOk(marked)), assertOk(rs))
        }
        const [, entries] = virtual(state)(readdir('nanvm/demos/wasm', {}))
        assertEq(assertOk(entries).map(({ name }) => name).toSorted().join(), 'a.rs.marked,b.rs.marked,dir.rs.marked,gone.wat.marked')
    },
    // A sample the compiler refuses fails the run before any file is
    // written, the samples before it included.
    refused: () => {
        const broken = { 'fjs': { 'nanvm': { 'demos': {
            'a': { 'sample.f.js': [utf8('export default () => 1;')] },
            'b': { 'sample.f.js': [utf8('export default (')] },
        } } } }
        const [state, result] = virtualAt(broken)(writeMarked(places))
        assertEq(result[0], 'error')
        assertEq(virtual(state)(readUtf8File(rustMarkedPath('a')))[1][0], 'error')
    },
    // A listed sample with no source is the failure `fjs run` reports.
    main: () => {
        const [state, code] = virtual(emptyState)(main(defaultNodeProgramOptions))
        assertEq(exitCode(code), 1)
        assert(state.stderr !== '')
    },
}
