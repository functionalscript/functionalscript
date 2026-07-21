import { assert, assertEq } from '../../../asserts/module.f.ts'
import { pure, type Effect, type Operation } from '../../../effects/module.f.ts'
import { create, type MemOp } from '../../../effects/memory/module.f.ts'
import type { Unknown } from '../../../media/json/module.f.ts'
import type { Response } from '../../../media/json/rpc/module.f.ts'
import { emptyState, virtual, type Dir } from '../../../effects/node/virtual/module.f.ts'
import { fileCas, type FileCasOperation } from '../../module.f.ts'
import { sha256 } from '../../../crypto/sha2/module.f.ts'
import { vec8 } from '../../../types/bit_vec/module.f.ts'
import { vecToCBase32 } from '../../../basen/cbase32/module.f.ts'
import { initEvo, evo } from '../module.f.ts'
import { mcpStep, uninitializedState, type McpSessionState, type ToolsCallResult } from '../../../mcp/module.f.ts'
import { evoConfig, evoMcpHandlers } from './module.f.ts'

type SessionOp = FileCasOperation | MemOp

// Feeds each message to `step` in order, collecting every response.
const feed = <O extends Operation>(
    step: (v: Unknown) => Effect<O, Response | null>,
) => (msgs: readonly unknown[]): Effect<O, readonly unknown[]> => {
    const go = (i: number, acc: readonly unknown[]): Effect<O, readonly unknown[]> =>
        i === msgs.length
            ? pure(acc)
            : step(msgs[i] as Unknown).step(r => go(i + 1, [...acc, r]))
    return go(0, [])
}

// Scans `root` into an Evo cache (`initEvo`), then drives a full MCP session
// (`initialize` → `notifications/initialized` → `msgs`) against it.
const runSession = (root: Dir, home = '/home/user') => (msgs: readonly unknown[]): readonly unknown[] => {
    const cas = fileCas(sha256)(home)
    const effect: Effect<SessionOp, readonly unknown[]> =
        initEvo(cas).step(cacheKey =>
            create(uninitializedState as McpSessionState).step(sessionKey => {
                const step = mcpStep(evoConfig)(evoMcpHandlers(evo(cas)(cacheKey)))(sessionKey)
                return feed(step)(msgs)
            }))
    return virtual({ ...emptyState, root })(effect)[1]
}

const init = { jsonrpc: '2.0', method: 'initialize', id: 1,
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'c', version: '0' } } }

const initialized = { jsonrpc: '2.0', method: 'notifications/initialized' }

const call = (id: number, name: string, args: unknown) =>
    ({ jsonrpc: '2.0', method: 'tools/call', id, params: { name, arguments: args } })

const list = (id: number) => ({ jsonrpc: '2.0', method: 'tools/list', id })

// Runs `init`, `notifications/initialized`, then `msgs`; returns the tool responses.
const session = (...msgs: readonly unknown[]): readonly unknown[] =>
    runSession({}, '/home/user')([init, initialized, ...msgs]).slice(2)

const resultOf = (resp: unknown): ToolsCallResult =>
    (resp as { readonly result: ToolsCallResult }).result

const textOf = (resp: unknown): string =>
    (resultOf(resp).content[0] as { readonly text: string }).text

export const proof = {
    toolsListAdvertisesThreeTools: () => {
        const [resp] = runSession({})([init, initialized, list(2)]).slice(2)
        const tools = (resp as { result: { tools: readonly { name: string }[] } }).result.tools
        assertEq(tools.length, 3)
        assertEq(tools.map(t => t.name).join(','), 'evo_list,evo_head,evo_add')
    },
    evoListEmptyStoreReturnsEmptyText: () => {
        const [resp] = session(call(2, 'evo_list', {}))
        assert(!resultOf(resp).isError)
        assertEq(textOf(resp), '')
    },
    evoHeadUnknownSubjectReturnsEmptyText: () => {
        const [resp] = session(call(2, 'evo_head', { subject: 'nope' }))
        assert(!resultOf(resp).isError)
        assertEq(textOf(resp), '')
    },
    evoAddListHeadRoundTrips: () => {
        const [addResp, listResp, headResp] = session(
            call(2, 'evo_add', { parents: [], subject: 'doc', snapshot: vecToCBase32(vec8(0x1n)) }),
            call(3, 'evo_list', {}),
            call(4, 'evo_head', { subject: 'doc' }),
        )
        assert(!resultOf(addResp).isError)
        const hash = textOf(addResp)
        assert(hash.length > 0)
        assertEq(textOf(listResp), 'doc')
        assertEq(textOf(headResp), hash)
    },
    evoAddMissingParentsIsInvalidArguments: () => {
        // Argument-schema validation (toolEntry) rejects this before the
        // domain logic (`Evo.add`) ever runs — `parents` is required.
        const [resp] = session(call(2, 'evo_add', {}))
        assertEq(resultOf(resp).isError, true)
    },
    evoAddDomainErrorIsError: () => {
        // Valid arguments, but the domain rule fails: `subject` is required
        // unless there is exactly one parent.
        const [resp] = session(call(2, 'evo_add', { parents: [] }))
        assertEq(resultOf(resp).isError, true)
        assert(textOf(resp).includes('subject is required'))
    },
    unknownToolIsError: () => {
        const [resp] = session(call(2, 'evo_remove', {}))
        assertEq(resultOf(resp).isError, true)
    },
}
