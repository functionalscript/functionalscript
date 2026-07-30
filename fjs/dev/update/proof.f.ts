/**
 * Proofs for local development configuration generation.
 *
 * @module
 */
import { assertEq } from '../../asserts/module.f.ts'
import { utf8 } from '../../text/module.f.ts'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.ts'
import { main, syncMcp } from './module.f.ts'
import { stringify, type Unknown } from '../../media/json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'

const str
    : (a: readonly Unknown[]) => string
    = stringify(sort)

const mcp = '{"servers":{}}' as const
const initial = {
    ...emptyState,
    root: {
        '.copilot': {
            'mcp.json': [utf8(mcp)],
        },
    },
} as const
const expectedRoot = {
    ...initial.root,
    '.vscode': {
        'mcp.json': [utf8(mcp)],
    },
} as const

export const proof = {
    syncMcp: () => {
        const [state, result] = virtual(initial)(syncMcp())
        assertEq(result, undefined)
        assertEq(str(state.root as any), str(expectedRoot as any))
    },
    main: () => {
        const [, result] = virtual(initial)(main())
        assertEq(result, 0)
    },
    throw: {
        missingSource: () => virtual(emptyState)(syncMcp()),
    },
}
