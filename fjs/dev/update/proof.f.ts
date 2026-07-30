import { assertEq } from '../../asserts/module.f.ts'
import { utf8 } from '../../text/module.f.ts'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.ts'
import { main, syncMcp } from './module.f.ts'

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
        assertEq(state.root, expectedRoot)
    },
    main: () => {
        const [, result] = virtual(initial)(main())
        assertEq(result, 0)
    },
}
