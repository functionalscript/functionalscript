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
        const [state, code] = virtualAt({ fjs: { nanvm: { fjsrs: { 'module.f.js': [utf8('export const main = 7;')] } } } })(main(defaultNodeProgramOptions))
        assertEq(exitCode(code), 0, state.stderr)
        assertEq(source, 'fjs/nanvm/fjsrs/module.f.js')
        assertEq(output, 'nanvm/fjsrs/src/gen.program.rs')
        const nanvm = state.root.nanvm
        assert(typeof nanvm === 'object' && !(nanvm instanceof Array))
        const crate = nanvm.fjsrs
        assert(typeof crate === 'object' && !(crate instanceof Array))
        const src = crate.src
        assert(typeof src === 'object' && !(src instanceof Array))
        assert(src['gen.program.rs'] !== undefined)
    },
    noSource: () => {
        const [state, code] = virtual(emptyState)(main(defaultNodeProgramOptions))
        assertEq(exitCode(code), 1)
        assert(state.stderr !== '')
    },
})
