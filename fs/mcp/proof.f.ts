import { assert, assertEq } from '../asserts/module.f.ts'
import { pure, type Operation } from '../effects/module.f.ts'
import type { Effect } from '../effects/module.f.ts'
import { run, type MemOperationMap } from '../effects/mock/module.f.ts'
import { asBase, asNominal, create, read, type Key, type MemOp } from '../effects/memory/module.f.ts'
import type { Unknown } from '../json/module.f.ts'
import {
    type ToolsListParams, type ToolsListResult, type ToolsCallParams, type ToolsCallResult,
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
    capabilities: { tools: {} },
    protocolVersion: '2024-11-05',
}

const configNoTools: McpConfig = { ...config, capabilities: {} }

type Op = never
const handlers: McpHandlers<Op> = {
    // Echoes a received cursor as `nextCursor` so tests can observe pagination params.
    toolsList: (p: ToolsListParams): Effect<Op, ToolsListResult> =>
        pure(p.cursor === undefined
            ? { tools: [{ name: 'greet', inputSchema: {} }] }
            : { tools: [], nextCursor: p.cursor }),
    toolsCall: (_p: ToolsCallParams): Effect<Op, ToolsCallResult> =>
        pure({ content: [{ type: 'text', text: 'hello' }] }),
}

type StepResult = readonly [unknown, McpSessionState]

// Run a memory effect against the mock, return the result.
const runMem = <T>(effect: Effect<MemOp, T>): T =>
    run(mock)(initial)(effect)[1]

// TypeScript infers O = Operation (the upper bound) rather than O = never when
// O flows through McpHandlers<never>, so we cast the widened type down to MemOp.
const asMemEffect = <T>(e: Effect<Operation, T>): Effect<MemOp, T> =>
    e as unknown as Effect<MemOp, T>

// Run one step from uninitializedState, return [response, newState].
const step1 = (cfg: McpConfig) => (msg: unknown): StepResult =>
    runMem(asMemEffect(create(uninitializedState as McpSessionState).step(key =>
        mcpStep(cfg)(handlers)(key)(msg as Unknown).step(resp =>
            read(key).step(state => pure([resp as unknown, state] as const))
        )
    )))

// Run initialize then a second step, return [response, newState] of the second.
const step2 = (cfg: McpConfig) => (msg1: unknown) => (msg2: unknown): StepResult =>
    runMem(asMemEffect(create(uninitializedState as McpSessionState).step(key =>
        mcpStep(cfg)(handlers)(key)(msg1 as Unknown).step(() =>
            mcpStep(cfg)(handlers)(key)(msg2 as Unknown).step(resp =>
                read(key).step(state => pure([resp as unknown, state] as const))
            )
        )
    )))

// Run initialize, notifications/initialized, then a third step; return [response, newState] of the third.
const step3 = (cfg: McpConfig) => (msg1: unknown) => (msg2: unknown) => (msg3: unknown): StepResult =>
    runMem(asMemEffect(create(uninitializedState as McpSessionState).step(key =>
        mcpStep(cfg)(handlers)(key)(msg1 as Unknown).step(() =>
            mcpStep(cfg)(handlers)(key)(msg2 as Unknown).step(() =>
                mcpStep(cfg)(handlers)(key)(msg3 as Unknown).step(resp =>
                    read(key).step(state => pure([resp as unknown, state] as const))
                )
            )
        )
    )))

// ── Test messages ─────────────────────────────────────────────────────────────

const initMsg = { jsonrpc: '2.0', method: 'initialize', id: 1,
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'client', version: '0.0.1' } } }

const initNotif = { jsonrpc: '2.0', method: 'notifications/initialized' }

// ── Tests ─────────────────────────────────────────────────────────────────────

export const proof = {
    lifecycle: {
        initialStateIsUninitialized: () => {
            assertEq(uninitializedState[0], 'uninitialized')
        },

        initializeTransitionsToInitializing: () => {
            const [, newState] = step1(config)(initMsg)
            assertEq(newState[0], 'initializing')
        },

        initializedNotificationTransitionsToInitialized: () => {
            const [resp, newState] = step2(config)(initMsg)(initNotif)
            assertEq(resp, null)
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

        notificationBeforeInitReturnNull: () => {
            const [resp, newState] = step1(config)(initNotif)
            assertEq(newState[0], 'uninitialized')
            assertEq(resp, null)
        },

        unknownNotificationReturnNull: () => {
            const notif = { jsonrpc: '2.0', method: 'notifications/unknown' }
            const [resp] = step2(config)(initMsg)(notif)
            assertEq(resp, null)
        },

        doubleInitializeReturnsInvalidRequest: () => {
            const [resp, newState] = step2(config)(initMsg)(initMsg)
            assertEq(newState[0], 'initializing')
            assertEq((resp as { error: { code: number } }).error.code, -32600)
        },

        pingBeforeInitSucceeds: () => {
            const msg = { jsonrpc: '2.0', method: 'ping', id: 11 }
            const [resp, newState] = step1(config)(msg)
            assertEq(newState[0], 'uninitialized')
            assert(!('error' in (resp as object)))
        },

        pingDuringInitializingSucceeds: () => {
            const msg = { jsonrpc: '2.0', method: 'ping', id: 12 }
            const [resp, newState] = step2(config)(initMsg)(msg)
            assertEq(newState[0], 'initializing')
            assert(!('error' in (resp as object)))
        },

        pingAfterInitSucceeds: () => {
            const msg = { jsonrpc: '2.0', method: 'ping', id: 15 }
            const [resp] = step3(config)(initMsg)(initNotif)(msg)
            assert(!('error' in (resp as object)))
        },

        methodBeforeInitReturnsNotInitialized: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/list', id: 3 }
            const [resp, newState] = step1(config)(msg)
            assertEq(newState[0], 'uninitialized')
            assertEq((resp as { error: { code: number } }).error.code, notInitialized.code)
        },

        methodDuringInitializingReturnsNotInitialized: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/list', id: 16 }
            const [resp, newState] = step2(config)(initMsg)(msg)
            assertEq(newState[0], 'initializing')
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
            const [resp] = step3(config)(initMsg)(initNotif)(msg)
            assertEq((resp as { result: ToolsListResult }).result.tools.length, 1)
            assertEq((resp as { result: ToolsListResult }).result.tools[0].name, 'greet')
        },

        toolsListPassesCursorToHandler: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/list', id: 17,
                params: { cursor: 'page-2' } }
            const [resp] = step3(config)(initMsg)(initNotif)(msg)
            assertEq((resp as { result: ToolsListResult }).result.nextCursor, 'page-2')
        },

        toolsListInvalidCursorReturnsInvalidParams: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/list', id: 18,
                params: { cursor: 42 } }
            const [resp] = step3(config)(initMsg)(initNotif)(msg)
            assertEq((resp as { error: { code: number } }).error.code, -32602)
        },

        toolsCallSucceeds: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/call', id: 6,
                params: { name: 'greet', arguments: {} } }
            const [resp] = step3(config)(initMsg)(initNotif)(msg)
            assertEq((resp as { result: ToolsCallResult }).result.content[0].text, 'hello')
        },

        toolsCallBadParamsReturnsInvalidParams: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/call', id: 7, params: { missing: true } }
            const [resp] = step3(config)(initMsg)(initNotif)(msg)
            assertEq((resp as { error: { code: number } }).error.code, -32602)
        },

        toolsCallAbsentArgumentsSucceeds: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/call', id: 13,
                params: { name: 'greet' } }
            const [resp] = step3(config)(initMsg)(initNotif)(msg)
            assertEq((resp as { result: ToolsCallResult }).result.content[0].text, 'hello')
        },

        toolsCallNullArgumentsReturnsInvalidParams: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/call', id: 14,
                params: { name: 'greet', arguments: null } }
            const [resp] = step3(config)(initMsg)(initNotif)(msg)
            assertEq((resp as { error: { code: number } }).error.code, -32602)
        },

        toolsListWithoutCapabilityReturnsMethodNotFound: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/list', id: 8 }
            const [resp] = step3(configNoTools)(initMsg)(initNotif)(msg)
            assertEq((resp as { error: { code: number } }).error.code, -32601)
        },

        toolsCallWithoutCapabilityReturnsMethodNotFound: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/call', id: 9,
                params: { name: 'greet', arguments: {} } }
            const [resp] = step3(configNoTools)(initMsg)(initNotif)(msg)
            assertEq((resp as { error: { code: number } }).error.code, -32601)
        },

        unknownMethodReturnsMethodNotFound: () => {
            const msg = { jsonrpc: '2.0', method: 'resources/list', id: 10 }
            const [resp] = step3(config)(initMsg)(initNotif)(msg)
            assertEq((resp as { error: { code: number } }).error.code, -32601)
        },
    },
}
