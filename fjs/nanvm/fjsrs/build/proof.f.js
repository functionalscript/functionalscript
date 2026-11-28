/**
 * The generator compiles the program's source to the crate's file, and a
 * checkout without the source is the failure `fjs run` reports.
 */

import { assert, assertEq } from '../../../asserts/module.f.js'
import { exitCode } from '../../../effects/node/module.f.js'
import { defaultNodeProgramOptions, emptyState, virtual, virtualAt } from '../../../effects/node/virtual/module.f.js'
import { utf8 } from '../../../text/module.f.js'
import { main, output, source } from './module.f.js'

export const proof = /** @type {const} */ ({
    writes: () => {
        /** @type {import("../../../effects/node/virtual/types.ts").Dir} */
        const root = {
            nanvm: { fjsrs: { tests: { 'static-strings.f.js': [utf8('export default 1;')] } } },
            fjs: {
                nanvm: { fjsrs: { 'module.f.js': [utf8('export const main = 7;')] } },
                // the program is written from its value, under the package's runtime
                js: { runtime: { 'module.f.js': [utf8('export const runtime = {};')] } },
            },
        }
        const [state, code] = virtualAt(root)(main(defaultNodeProgramOptions))
        assertEq(exitCode(code), 0, state.stderr)
        assertEq(source, 'fjs/nanvm/fjsrs/module.f.js')
        assertEq(output, 'nanvm/fjsrs/src/gen.program.native.rs')
        const nanvm = state.root.nanvm
        assert(typeof nanvm === 'object' && !(nanvm instanceof Array))
        const crate = nanvm.fjsrs
        assert(typeof crate === 'object' && !(crate instanceof Array))
        const src = crate.src
        assert(typeof src === 'object' && !(src instanceof Array))
        assert(src['gen.program.native.rs'] !== undefined)
    },
    noSource: () => {
        const [state, code] = virtual(emptyState)(main(defaultNodeProgramOptions))
        assertEq(exitCode(code), 1)
        assert(state.stderr !== '')
    },
})
