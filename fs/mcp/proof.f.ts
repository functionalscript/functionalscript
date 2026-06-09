import { assert, assertEq } from '../asserts/module.f.ts'
import { pure } from '../effects/module.f.ts'
import type { Operation, Effect } from '../effects/module.f.ts'
import type { Unknown } from '../json/module.f.ts'
import {
    type ToolsListResult, type ToolsCallParams, type ToolsCallResult,
    type McpHandlers, type McpConfig, type McpSessionState,
    uninitializedState, mcpStep, notInitialized,
} from './module.f.ts'

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

const step = (value: unknown, state: McpSessionState) =>
    mcpStep(config)(handlers)(value as Unknown, state)

const stepNoTools = (value: unknown, state: McpSessionState) =>
    mcpStep(configNoTools)(handlers)(value as Unknown, state)

// Synchronously extract the value from a pure Effect.
const run = <T>(e: Effect<never, T>): T => {
    const v = e.value
    if (v.length !== 1) { throw new Error('expected pure effect') }
    return v[0] as T
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const initMsg = { jsonrpc: '2.0', method: 'initialize', id: 1,
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'client', version: '0.0.1' } } }

function doInit(s: McpSessionState): McpSessionState {
    return step(initMsg, s)[1]
}

function doInitNoTools(s: McpSessionState): McpSessionState {
    return stepNoTools(initMsg, s)[1]
}

// ── Tests ─────────────────────────────────────────────────────────────────────

export const proof = {
    lifecycle: {
        initialStateIsUninitialized: () => {
            assertEq(uninitializedState[0], 'uninitialized')
        },

        initializeTransitionsState: () => {
            const [newState, _effect] = step(uninitializedState)(initMsg)
            assertEq(newState[0], 'initialized')
        },

        initializeReturnsResult: () => {
            const [, effect] = step(uninitializedState)(initMsg)
            const resp = run(effect as Effect<never, unknown>)
            assert(resp !== null && typeof resp === 'object' && 'result' in (resp as object))
            const r = (resp as { result: { protocolVersion: string } }).result
            assertEq(r.protocolVersion, '2024-11-05')
        },

        initializeWithBadParamsReturnsInvalidParams: () => {
            const bad = { jsonrpc: '2.0', method: 'initialize', id: 2, params: { wrong: true } }
            const [newState, effect] = step(uninitializedState)(bad)
            assertEq(newState[0], 'uninitialized')
            const resp = run(effect as Effect<never, unknown>) as { error: { code: number } }
            assertEq(resp.error.code, -32602)
        },

        notificationReturnNull: () => {
            const notif = { jsonrpc: '2.0', method: 'notifications/initialized' }
            const [newState, effect] = step(uninitializedState)(notif)
            assertEq(newState[0], 'uninitialized')
            assertEq(run(effect as Effect<never, unknown>), null)
        },

        notificationAfterInitReturnNull: () => {
            const initialized = doInit(uninitializedState)
            const notif = { jsonrpc: '2.0', method: 'notifications/initialized' }
            const [, effect] = step(initialized)(notif)
            assertEq(run(effect as Effect<never, unknown>), null)
        },

        methodBeforeInitReturnsNotInitialized: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/list', id: 3 }
            const [newState, effect] = step(uninitializedState)(msg)
            assertEq(newState[0], 'uninitialized')
            const resp = run(effect as Effect<never, unknown>) as { error: { code: number } }
            assertEq(resp.error.code, notInitialized.code)
        },

        invalidEnvelopeReturnsInvalidRequest: () => {
            const bad = { jsonrpc: '1.0', method: 'ping', id: 4 }
            const [, effect] = step(uninitializedState)(bad)
            const resp = run(effect as Effect<never, unknown>) as { error: { code: number }; id: unknown }
            assertEq(resp.error.code, -32600)
            assertEq(resp.id, null)
        },
    },

    tools: {
        toolsListSucceeds: () => {
            const initialized = doInit(uninitializedState)
            const msg = { jsonrpc: '2.0', method: 'tools/list', id: 5 }
            const [, effect] = step(initialized)(msg)
            const resp = run(effect as Effect<never, unknown>) as { result: ToolsListResult }
            assertEq(resp.result.tools.length, 1)
            assertEq(resp.result.tools[0].name, 'greet')
        },

        toolsCallSucceeds: () => {
            const initialized = doInit(uninitializedState)
            const msg = { jsonrpc: '2.0', method: 'tools/call', id: 6,
                params: { name: 'greet', arguments: {} } }
            const [, effect] = step(initialized)(msg)
            const resp = run(effect as Effect<never, unknown>) as { result: ToolsCallResult }
            assertEq(resp.result.content[0].text, 'hello')
        },

        toolsCallBadParamsReturnsInvalidParams: () => {
            const initialized = doInit(uninitializedState)
            const msg = { jsonrpc: '2.0', method: 'tools/call', id: 7, params: { missing: true } }
            const [, effect] = step(initialized)(msg)
            const resp = run(effect as Effect<never, unknown>) as { error: { code: number } }
            assertEq(resp.error.code, -32602)
        },

        toolsListWithoutCapabilityReturnsMethodNotFound: () => {
            const initialized = doInitNoTools(uninitializedState)
            const msg = { jsonrpc: '2.0', method: 'tools/list', id: 8 }
            const [, effect] = stepNoTools(initialized)(msg)
            const resp = run(effect as Effect<never, unknown>) as { error: { code: number } }
            assertEq(resp.error.code, -32601)
        },

        toolsCallWithoutCapabilityReturnsMethodNotFound: () => {
            const initialized = doInitNoTools(uninitializedState)
            const msg = { jsonrpc: '2.0', method: 'tools/call', id: 9,
                params: { name: 'greet', arguments: {} } }
            const [, effect] = stepNoTools(initialized)(msg)
            const resp = run(effect as Effect<never, unknown>) as { error: { code: number } }
            assertEq(resp.error.code, -32601)
        },

        unknownMethodReturnsMethodNotFound: () => {
            const initialized = doInit(uninitializedState)
            const msg = { jsonrpc: '2.0', method: 'resources/list', id: 10 }
            const [, effect] = step(initialized)(msg)
            const resp = run(effect as Effect<never, unknown>) as { error: { code: number } }
            assertEq(resp.error.code, -32601)
        },
    },
}
