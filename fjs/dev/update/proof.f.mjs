/**
 * Proofs for local development configuration generation.
 */

import { exitCode } from '../../effects/node/module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { main, syncMcp } from './module.f.mjs'
import { step as ioStep } from '../../effects/io/module.f.mjs'

const mcp = /** @type {const} */ ('{"servers":{}}')
const initial = /** @type {const} */ ({
    ...emptyState,
    root: {
        '.copilot': {
            'mcp.json': [utf8(mcp)],
        },
    },
})
export const proof = {
    syncMcp: () => {
        const generatedMcp = ioStep(syncMcp(), () => readUtf8File('.vscode/mcp.json'))
        const [, [tag, result]] = virtual(initial)(generatedMcp)
        assert(tag === 'ok', result)
        assertEq(result, mcp)
    },
    main: () => {
        const [, result] = virtual(initial)(main(defaultNodeProgramOptions))
        assertEq(exitCode(result), 0)
    },
    // A missing source is no longer a panic: it propagates through the chain
    // and the program reports it and exits 1.
    missingSource: () => {
        const [state, code] = virtual(emptyState)(main(defaultNodeProgramOptions))
        assertEq(exitCode(code), 1)
        assertEq(state.stderr, 'no such file or directory\n', state.stderr)
    },
}
