/**
 * Proofs for local development configuration generation.
 *
 * @module
 */
import { assert, assertEq } from '../../asserts/module.f.mjs'
import { utf8 } from '../../text/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'
import { defaultNodeProgramOptions, emptyState, virtual } from '../../effects/node/virtual/module.f.ts'
import { main, syncMcp } from './module.f.mjs'
import { step } from '../../effects/module.f.mjs'

const mcp = '{"servers":{}}' as const
const initial = {
    ...emptyState,
    root: {
        '.copilot': {
            'mcp.json': [utf8(mcp)],
        },
    },
} as const
export const proof = {
    syncMcp: () => {
        const generatedMcp = step(syncMcp(), () => readUtf8File('.vscode/mcp.json'))
        const [, [tag, result]] = virtual(initial)(generatedMcp)
        assert(tag === 'ok', result)
        assertEq(result, mcp)
    },
    main: () => {
        const [, result] = virtual(initial)(main(defaultNodeProgramOptions))
        assertEq(result, 0)
    },
    throw: {
        missingSource: () => virtual(emptyState)(syncMcp()),
    },
}
