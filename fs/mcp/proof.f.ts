import { assert, assertEq } from '../asserts/module.f.ts'
import { pure } from '../effects/module.f.ts'
import type { Effect } from '../effects/module.f.ts'
import { run, type MemOperationMap } from '../effects/mock/module.f.ts'
import { asBase, asNominal, create, read, type Key, type MemOp } from '../effects/memory/module.f.ts'
import type { Unknown } from '../json/module.f.ts'
import {
    type ToolsListResult, type ToolsCallParams, type ToolsCallResult,
    type McpHandlers, type McpConfig, type McpSessionState,
    uninitializedState, mcpStep, notInitialized,
} from './module.f.ts'

// ── Memory mock ────────────────────────────────────────────────────────────────

type MemoryState = {
    readonly next: number
    readonly values: { readonly [key: string]: unknown }
}

const initial: MemoryState = { next: 0, values: {} }

const mock: MemOperationMap<MemOp, MemoryState> = {
    memCreate: (state, value) => {
        const id = `k${state.next}`
        const key: Key<unknown> = asNominal(id)
        return [{ next: state.next + 1, values: { ...state.values, [id]: value } }, key]
    },
    memRead: (state, key) => [state, state.values[asBase(key)]],
    memWrite: (state, key, value) => {
        const id = asBase(key)
        return [{ ...state, values: { ...state.values, [id]: value } }, undefined]
    },
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const config: McpConfig = {
    serverInfo: { name: 'test-server', version: '0.1.0' },
    capabilities: { tools: { listChanged: undefined } },
    protocolVersion: '2024-11-05',
}

const configNoTools: McpConfig = { ...config, capabilities: { tools: undefined } }

type Op = never
const handlers: McpHandlers<Op> = {
    toolsList: (): Effect<Op, ToolsListResult> =>
        pure({ tools: [{ name: 'greet', description: undefined, inputSchema: {} }], nextCursor: undefined }),
    toolsCall: (_p: ToolsCallParams): Effect<Op, ToolsCallResult> =>
        pure({ content: [{ type: 'text', text: 'hello' }], isError: undefined }),
}

// Run a memory effect against the mock, return the result.
const runMem = <T>(effect: Effect<MemOp, T>): T =>
    run(mock)(initial)(effect)[1]

// Run one step from uninitializedState, return [response, newState].
const step1 = (cfg: McpConfig) => (msg: unknown) =>
    runMem(create(uninitializedState as McpSessionState).step(key =>
        mcpStep(cfg)(handlers)(key)(msg as Unknown).step(resp =>
            read(key).step(state => pure([resp, state] as const))
        )
    ))

// Run initialize then a second step, return [response, newState] of the second.
const step2 = (cfg: McpConfig) => (msg1: unknown) => (msg2: unknown) =>
    runMem(create(uninitializedState as McpSessionState).step(key =>
        mcpStep(cfg)(handlers)(key)(msg1 as Unknown).step(() =>
            mcpStep(cfg)(handlers)(key)(msg2 as Unknown).step(resp =>
                read(key).step(state => pure([resp, state] as const))
            )
        )
    ))

// ── Test messages ─────────────────────────────────────────────────────────────

const initMsg = { jsonrpc: '2.0', method: 'initialize', id: 1,
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'client', version: '0.0.1' } } }

// ── Tests ─────────────────────────────────────────────────────────────────────

export const proof = {
    lifecycle: {
        initialStateIsUninitialized: () => {
            assertEq(uninitializedState[0], 'uninitialized')
        },

        initializeTransitionsState: () => {
            const [, newState] = step1(config)(initMsg)
            assertEq(newState[0], 'initialized')
        },

        initializeReturnsResult: () => {
            const [resp] = step1(config)(initMsg)
            assert(resp !== null && typeof resp === 'object' && 'result' in (resp as object))
            const r = (resp as { result: { protocolVersion: string } }).result
            assertEq(r.protocolVersion, '2024-11-05')
        },

        initializeWithBadParamsReturnsInvalidParams: () => {
            const bad = { jsonrpc: '2.0', method: 'initialize', id: 2, params: { wrong: true } }
            const [resp, newState] = step1(config)(bad)
            assertEq(newState[0], 'uninitialized')
            assertEq((resp as { error: { code: number } }).error.code, -32602)
        },

        notificationReturnNull: () => {
            const notif = { jsonrpc: '2.0', method: 'notifications/initialized' }
            const [resp, newState] = step1(config)(notif)
            assertEq(newState[0], 'uninitialized')
            assertEq(resp, null)
        },

        notificationAfterInitReturnNull: () => {
            const notif = { jsonrpc: '2.0', method: 'notifications/initialized' }
            const [resp] = step2(config)(initMsg)(notif)
            assertEq(resp, null)
        },

        methodBeforeInitReturnsNotInitialized: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/list', id: 3 }
            const [resp, newState] = step1(config)(msg)
            assertEq(newState[0], 'uninitialized')
            assertEq((resp as { error: { code: number } }).error.code, notInitialized.code)
        },

        invalidEnvelopeReturnsInvalidRequest: () => {
            const bad = { jsonrpc: '1.0', method: 'ping', id: 4 }
            const [resp] = step1(config)(bad)
            assertEq((resp as { error: { code: number }; id: unknown }).error.code, -32600)
            assertEq((resp as { error: { code: number }; id: unknown }).id, null)
        },
    },

    tools: {
        toolsListSucceeds: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/list', id: 5 }
            const [resp] = step2(config)(initMsg)(msg)
            assertEq((resp as { result: ToolsListResult }).result.tools.length, 1)
            assertEq((resp as { result: ToolsListResult }).result.tools[0].name, 'greet')
        },

        toolsCallSucceeds: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/call', id: 6,
                params: { name: 'greet', arguments: {} } }
            const [resp] = step2(config)(initMsg)(msg)
            assertEq((resp as { result: ToolsCallResult }).result.content[0].text, 'hello')
        },

        toolsCallBadParamsReturnsInvalidParams: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/call', id: 7, params: { missing: true } }
            const [resp] = step2(config)(initMsg)(msg)
            assertEq((resp as { error: { code: number } }).error.code, -32602)
        },

        toolsListWithoutCapabilityReturnsMethodNotFound: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/list', id: 8 }
            const [resp] = step2(configNoTools)(initMsg)(msg)
            assertEq((resp as { error: { code: number } }).error.code, -32601)
        },

        toolsCallWithoutCapabilityReturnsMethodNotFound: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/call', id: 9,
                params: { name: 'greet', arguments: {} } }
            const [resp] = step2(configNoTools)(initMsg)(msg)
            assertEq((resp as { error: { code: number } }).error.code, -32601)
        },

        unknownMethodReturnsMethodNotFound: () => {
            const msg = { jsonrpc: '2.0', method: 'resources/list', id: 10 }
            const [resp] = step2(config)(initMsg)(msg)
            assertEq((resp as { error: { code: number } }).error.code, -32601)
        },
    },
}
