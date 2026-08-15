/**
 * @import { Unknown } from '../../media/json/types.ts'
 * @import { Effect, Operation } from '../../effects/types.ts'
 * @import { MemOperationMap } from '../../effects/mock/types.ts'
 * @import { Key, MemOp } from '../../effects/memory/types.ts'
 * @import { Ts } from '../../types/rtti/ts/types.ts'
 * @import {
 *   ToolsListParams, ToolsListResult, ToolsCallParams, ToolsCallResult,
 *   McpHandlers, McpConfig, McpSessionState,
 * } from './types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { history, historyStep, mapStep, pure, step, runPure } from '../../effects/module.f.mjs'
import { run } from '../../effects/mock/module.f.mjs'
import { asBase, asNominal, create, read } from '../../effects/memory/module.f.mjs'
import {
    uninitializedState, mcpStep, notInitialized, fromRegistry, toolEntry, okResult,
} from './module.f.mjs'

// ── Memory mock ────────────────────────────────────────────────────────────────

/** @typedef {{
 *   readonly next: number
 *   readonly values: { readonly [key: string]: unknown }
 * }} _MemoryState */

/** @type {_MemoryState} */
const initial = { next: 0, values: {} }

/** @type {MemOperationMap<MemOp, _MemoryState>} */
const mock = {
    memCreate: value => state => {
        const id = `k${state.next}`
        /** @type {Key<unknown>} */
        const key = asNominal(id)
        return [{ next: state.next + 1, values: { ...state.values, [id]: value } }, key]
    },
    memRead: key => state => [state, state.values[asBase(key)]],
    memWrite: (key, value) => state => {
        const id = asBase(key)
        return [{ ...state, values: { ...state.values, [id]: value } }, undefined]
    },
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** @type {McpConfig} */
const config = {
    serverInfo: { name: 'test-server', version: '0.1.0' },
    capabilities: { tools: {} },
    protocolVersion: '2024-11-05',
}

const configNoTools = { ...config, capabilities: {} }

/** @typedef {never} _Op */
/** @type {McpHandlers<_Op>} */
const handlers = {
    // Echoes a received cursor as `nextCursor` so tests can observe pagination params.
    toolsList: (/** @type {ToolsListParams} */ p) =>
        pure(p.cursor === undefined
            ? { tools: [{ name: 'greet', inputSchema: {} }] }
            : { tools: [], nextCursor: p.cursor }),
    toolsCall: (/** @type {ToolsCallParams} */ _p) =>
        pure({ content: [{ type: 'text', text: 'hello' }] }),
}

/** @typedef {readonly [unknown, McpSessionState]} _StepResult */

// Run a memory effect against the mock, return the result.
/** @type {<T>(effect: Effect<MemOp, T>) => T} */
const runMem = effect =>
    run(mock)(initial)(effect)[1]

// TypeScript infers O = Operation (the upper bound) rather than O = never when
// O flows through McpHandlers<never>, so we cast the widened type down to MemOp.
/** @type {<T>(e: Effect<Operation, T>) => Effect<MemOp, T>} */
const asMemEffect = e => /** @type {Effect<MemOp, any>} */ (e)

// Pairs the last step's response with the session state read back afterwards.
// The response is still needed after the read, so it is carried forward in a
// history rather than closed over by a nested continuation.
/** @type {(key: Key<McpSessionState>) => (e: Effect<Operation, unknown>) => Effect<Operation, _StepResult>} */
const withState = key => e => {
    const read0 = historyStep(history(e), () => read(key))
    return mapStep(read0, ([state, resp]) => /** @type {const} */ ([resp, state]))
}

// Run one step from uninitializedState, return [response, newState].
/** @type {(cfg: McpConfig) => (msg: unknown) => _StepResult} */
const step1 = cfg => msg =>
    runMem(asMemEffect(step(
        create(uninitializedState),
        key => withState(key)(mcpStep(cfg)(handlers)(key)(/** @type {Unknown} */ (msg))))))

// Run initialize then a second step, return [response, newState] of the second.
/** @type {(cfg: McpConfig) => (msg1: unknown) => (msg2: unknown) => _StepResult} */
const step2 = cfg => msg1 => msg2 =>
    runMem(asMemEffect(step(
        create(uninitializedState),
        key => {
            const r1 = mcpStep(cfg)(handlers)(key)(/** @type {Unknown} */ (msg1))
            const r2 = step(r1, () => mcpStep(cfg)(handlers)(key)(/** @type {Unknown} */ (msg2)))
            return withState(key)(r2)
        })))

// Run initialize, notifications/initialized, then a third step; return [response, newState] of the third.
/** @type {(cfg: McpConfig) => (msg1: unknown) => (msg2: unknown) => (msg3: unknown) => _StepResult} */
const step3 = cfg => msg1 => msg2 => msg3 =>
    runMem(asMemEffect(step(
        create(uninitializedState),
        key => {
            const r1 = mcpStep(cfg)(handlers)(key)(/** @type {Unknown} */ (msg1))
            const r2 = step(r1, () => mcpStep(cfg)(handlers)(key)(/** @type {Unknown} */ (msg2)))
            const r3 = step(r2, () => mcpStep(cfg)(handlers)(key)(/** @type {Unknown} */ (msg3)))
            return withState(key)(r3)
        })))

// ── Test messages ─────────────────────────────────────────────────────────────

const initMsg = { jsonrpc: '2.0', method: 'initialize', id: 1,
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'client', version: '0.0.1' } } }

const initNotif = { jsonrpc: '2.0', method: 'notifications/initialized' }

// ── Tests ─────────────────────────────────────────────────────────────────────

export const proof = {
    lifecycle: {
        initialStateIsUninitialized: () => {
            assert(uninitializedState[0] === 'uninitialized')
        },

        initializeTransitionsToInitializing: () => {
            const [, newState] = step1(config)(initMsg)
            assert(newState[0] === 'initializing')
        },

        initializedNotificationTransitionsToInitialized: () => {
            const [resp, newState] = step2(config)(initMsg)(initNotif)
            assertEq(resp, null)
            assert(newState[0] === 'initialized')
        },

        initializeReturnsResult: () => {
            const [resp] = step1(config)(initMsg)
            assert(resp !== null && typeof resp === 'object' && 'result' in (resp))
            const r = /** @type {{ result: { protocolVersion: string } }} */ (resp).result
            assertEq(r.protocolVersion, '2024-11-05')
        },

        initializeWithBadParamsReturnsInvalidParams: () => {
            const bad = { jsonrpc: '2.0', method: 'initialize', id: 2, params: { wrong: true } }
            const [resp, newState] = step1(config)(bad)
            assert(newState[0] === 'uninitialized')
            assertEq(/** @type {{ error: { code: number } }} */ (resp).error.code, -32602)
        },

        notificationBeforeInitReturnNull: () => {
            const [resp, newState] = step1(config)(initNotif)
            assert(newState[0] === 'uninitialized')
            assertEq(resp, null)
        },

        unknownNotificationReturnNull: () => {
            const notif = { jsonrpc: '2.0', method: 'notifications/unknown' }
            const [resp] = step2(config)(initMsg)(notif)
            assertEq(resp, null)
        },

        doubleInitializeReturnsInvalidRequest: () => {
            const [resp, newState] = step2(config)(initMsg)(initMsg)
            assert(newState[0] === 'initializing')
            assertEq(/** @type {{ error: { code: number } }} */ (resp).error.code, -32600)
        },

        pingBeforeInitSucceeds: () => {
            const msg = { jsonrpc: '2.0', method: 'ping', id: 11 }
            const [resp, newState] = step1(config)(msg)
            assert(newState[0] === 'uninitialized')
            assert(!('error' in /** @type {object} */ (resp)))
        },

        pingDuringInitializingSucceeds: () => {
            const msg = { jsonrpc: '2.0', method: 'ping', id: 12 }
            const [resp, newState] = step2(config)(initMsg)(msg)
            assert(newState[0] === 'initializing')
            assert(!('error' in /** @type {object} */ (resp)))
        },

        pingAfterInitSucceeds: () => {
            const msg = { jsonrpc: '2.0', method: 'ping', id: 15 }
            const [resp] = step3(config)(initMsg)(initNotif)(msg)
            assert(!('error' in /** @type {object} */ (resp)))
        },

        pingWithObjectParamsSucceeds: () => {
            const msg = { jsonrpc: '2.0', method: 'ping', id: 19, params: {} }
            const [resp] = step1(config)(msg)
            assert(!('error' in /** @type {object} */ (resp)))
        },

        pingInvalidParamsReturnsInvalidParams: () => {
            const msg = { jsonrpc: '2.0', method: 'ping', id: 20, params: 1 }
            const [resp] = step1(config)(msg)
            assertEq(/** @type {{ error: { code: number } }} */ (resp).error.code, -32602)
        },

        initializedNotificationObjectParamsTransitions: () => {
            const notif = { jsonrpc: '2.0', method: 'notifications/initialized', params: {} }
            const [resp, newState] = step2(config)(initMsg)(notif)
            assertEq(resp, null)
            assert(newState[0] === 'initialized')
        },

        initializedNotificationBadParamsIgnored: () => {
            const notif = { jsonrpc: '2.0', method: 'notifications/initialized', params: 1 }
            const [resp, newState] = step2(config)(initMsg)(notif)
            assertEq(resp, null)
            assert(newState[0] === 'initializing')
        },

        methodBeforeInitReturnsNotInitialized: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/list', id: 3 }
            const [resp, newState] = step1(config)(msg)
            assert(newState[0] === 'uninitialized')
            assertEq(/** @type {{ error: { code: number } }} */ (resp).error.code, notInitialized.code)
        },

        methodDuringInitializingReturnsNotInitialized: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/list', id: 16 }
            const [resp, newState] = step2(config)(initMsg)(msg)
            assert(newState[0] === 'initializing')
            assertEq(/** @type {{ error: { code: number } }} */ (resp).error.code, notInitialized.code)
        },

        invalidEnvelopeReturnsInvalidRequest: () => {
            const bad = { jsonrpc: '1.0', method: 'ping', id: 4 }
            const [resp] = step1(config)(bad)
            assertEq(/** @type {{ error: { code: number }; id: unknown }} */ (resp).error.code, -32600)
            assertEq(/** @type {{ error: { code: number }; id: unknown }} */ (resp).id, null)
        },
    },

    tools: {
        toolsListSucceeds: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/list', id: 5 }
            const [resp] = step3(config)(initMsg)(initNotif)(msg)
            assertEq(/** @type {{ result: ToolsListResult }} */ (resp).result.tools.length, 1)
            assertEq(/** @type {{ result: ToolsListResult }} */ (resp).result.tools[0].name, 'greet')
        },

        toolsListPassesCursorToHandler: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/list', id: 17,
                params: { cursor: 'page-2' } }
            const [resp] = step3(config)(initMsg)(initNotif)(msg)
            assertEq(/** @type {{ result: ToolsListResult }} */ (resp).result.nextCursor, 'page-2')
        },

        toolsListInvalidCursorReturnsInvalidParams: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/list', id: 18,
                params: { cursor: 42 } }
            const [resp] = step3(config)(initMsg)(initNotif)(msg)
            assertEq(/** @type {{ error: { code: number } }} */ (resp).error.code, -32602)
        },

        toolsCallSucceeds: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/call', id: 6,
                params: { name: 'greet', arguments: {} } }
            const [resp] = step3(config)(initMsg)(initNotif)(msg)
            assertEq(/** @type {{ text: string }} */ (/** @type {{ result: ToolsCallResult }} */ (resp).result.content[0]).text, 'hello')
        },

        toolsCallBadParamsReturnsInvalidParams: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/call', id: 7, params: { missing: true } }
            const [resp] = step3(config)(initMsg)(initNotif)(msg)
            assertEq(/** @type {{ error: { code: number } }} */ (resp).error.code, -32602)
        },

        toolsCallAbsentArgumentsSucceeds: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/call', id: 13,
                params: { name: 'greet' } }
            const [resp] = step3(config)(initMsg)(initNotif)(msg)
            assertEq(/** @type {{ text: string }} */ (/** @type {{ result: ToolsCallResult }} */ (resp).result.content[0]).text, 'hello')
        },

        toolsCallNullArgumentsReturnsInvalidParams: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/call', id: 14,
                params: { name: 'greet', arguments: null } }
            const [resp] = step3(config)(initMsg)(initNotif)(msg)
            assertEq(/** @type {{ error: { code: number } }} */ (resp).error.code, -32602)
        },

        toolsListWithoutCapabilityReturnsMethodNotFound: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/list', id: 8 }
            const [resp] = step3(configNoTools)(initMsg)(initNotif)(msg)
            assertEq(/** @type {{ error: { code: number } }} */ (resp).error.code, -32601)
        },

        toolsCallWithoutCapabilityReturnsMethodNotFound: () => {
            const msg = { jsonrpc: '2.0', method: 'tools/call', id: 9,
                params: { name: 'greet', arguments: {} } }
            const [resp] = step3(configNoTools)(initMsg)(initNotif)(msg)
            assertEq(/** @type {{ error: { code: number } }} */ (resp).error.code, -32601)
        },

        unknownMethodReturnsMethodNotFound: () => {
            const msg = { jsonrpc: '2.0', method: 'resources/list', id: 10 }
            const [resp] = step3(config)(initMsg)(initNotif)(msg)
            assertEq(/** @type {{ error: { code: number } }} */ (resp).error.code, -32601)
        },
    },

    registry: {
        // `fromRegistry`'s `toolsCall` defaults a missing `arguments` field to
        // `{}` before dispatching to the matched entry's `handle`. Exercised
        // here directly (bypassing `mcpStep`) so the default reaches
        // `toolEntry`'s own validation: if it were left `undefined` instead,
        // validating it against the empty-object schema below would fail and
        // this would observe an error result instead of `ok`.
        toolsCallAbsentArgumentsDefaultsToEmptyObject: () => {
            const echoArgs = /** @type {const} */ ({})
            const entry = toolEntry('echo', 'echoes', echoArgs,
                () => pure(okResult('ok')))
            const handlers = fromRegistry([entry])
            const [result] = runPure(handlers.toolsCall({ name: 'echo' }))
            assert(result !== undefined)
            assertEq(/** @type {{ readonly text: string }} */ (result.content[0]).text, 'ok')
        },
    },
}
