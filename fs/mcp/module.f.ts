/**
 * MCP (Model Context Protocol) message schemas — minimal subset for a
 * hello-world tool server.
 *
 * Covers the three exchanges a minimal server must handle:
 * - `initialize` / `notifications/initialized` lifecycle
 * - `tools/list` — advertise available tools
 * - `tools/call` — invoke a tool and return text content
 *
 * Each schema is both a runtime decoder (`validate(schema)`) and a static
 * TypeScript type (`Ts<typeof schema>`). Transport framing (stdio) and the
 * JSON-RPC dispatcher are in `fs/json/rpc/module.f.ts`.
 *
 * @module
 */
import { boolean, string, option, array, record } from '../types/rtti/module.f.ts'
import { unknown, type Unknown } from '../json/module.f.ts'
import type { Ts } from '../types/rtti/ts/module.f.ts'
import { pure, type Operation, type Effect } from '../effects/module.f.ts'
import {
    decodeRequest,
    rpcError, invalidRequest, invalidParams, methodNotFound,
    type Response, type Id, type RpcError,
} from '../json/rpc/module.f.ts'
import { validate } from '../types/rtti/validate/module.f.ts'

// ── Shared ─────────────────────────────────────────────────────────────────────

/** Name + version pair sent in `initialize` requests and responses. */
export const implementation = {
    name: string,
    version: string,
} as const
export type Implementation = Ts<typeof implementation>

// ── Capabilities ───────────────────────────────────────────────────────────────

const toolsCapability = { listChanged: option(boolean) } as const

/** Server capabilities advertised in the `initialize` response. */
export const serverCapabilities = {
    tools: option(toolsCapability),
} as const
export type ServerCapabilities = Ts<typeof serverCapabilities>

// ── Lifecycle ──────────────────────────────────────────────────────────────────

/** Params for the `initialize` request. */
export const initializeParams = {
    protocolVersion: string,
    capabilities: unknown,
    clientInfo: implementation,
} as const
export type InitializeParams = Ts<typeof initializeParams>

/** Result for the `initialize` request. */
export const initializeResult = {
    protocolVersion: string,
    capabilities: serverCapabilities,
    serverInfo: implementation,
    instructions: option(string),
} as const
export type InitializeResult = Ts<typeof initializeResult>

// ── Content ────────────────────────────────────────────────────────────────────

/** Plain-text content item returned by a tool call. */
export const textContent = { type: 'text', text: string } as const
export type TextContent = Ts<typeof textContent>

// ── Tools ──────────────────────────────────────────────────────────────────────

/**
 * A tool descriptor returned by `tools/list`.
 * `inputSchema` is a JSON Schema object — use `toJsonSchema` to derive it from
 * an rtti schema.
 */
export const tool = {
    name: string,
    description: option(string),
    inputSchema: unknown,
} as const
export type Tool = Ts<typeof tool>

export const toolsListResult = {
    tools: array(tool),
    nextCursor: option(string),
} as const
export type ToolsListResult = Ts<typeof toolsListResult>

export const toolsCallParams = {
    name: string,
    arguments: option(record(unknown)),
} as const
export type ToolsCallParams = Ts<typeof toolsCallParams>

export const toolsCallResult = {
    content: array(textContent),
    isError: option(boolean),
} as const
export type ToolsCallResult = Ts<typeof toolsCallResult>

// ── Dispatch ───────────────────────────────────────────────────────────────────

/** Per-method handlers for a hello-world MCP tool server. */
export type McpHandlers<O extends Operation> = {
    readonly toolsList: () => Effect<O, ToolsListResult>
    readonly toolsCall: (params: ToolsCallParams) => Effect<O, ToolsCallResult>
}

/** Top-level handler: maps a raw JSON value to a JSON-RPC response (or `null` for notifications). */
export type Handle<O extends Operation> = (value: Unknown) => Effect<O, Response | null>

// ── Lifecycle / capability state machine ───────────────────────────────────────

const _jsonrpc = '2.0' as const

const _errResponse = (id: Id) => (e: RpcError): Response =>
    ({ jsonrpc: _jsonrpc, error: e, id })

const _okResponse = (id: Id) => (result: unknown): Response =>
    ({ jsonrpc: _jsonrpc, result: result as Unknown, id })

/** MCP error -32002: the client called a method before `initialize`. */
export const notInitialized = rpcError(-32002)('Server not initialized')

/** State carried before the peer sends `initialize`. */
export type Uninitialized = readonly ['uninitialized']

/** State carried after a successful `initialize` exchange. */
export type InitializedState = {
    readonly protocolVersion: string
    readonly capabilities: ServerCapabilities
}

/** The two phases of an MCP session. */
export type McpSessionState =
    | Uninitialized
    | readonly ['initialized', InitializedState]

/** Initial session state — always start here. */
export const uninitializedState: McpSessionState = ['uninitialized']

/** Static configuration supplied by the server implementer. */
export type McpConfig = {
    readonly serverInfo: Implementation
    readonly capabilities: ServerCapabilities
    readonly protocolVersion: string
}

/**
 * Pure state-machine step for an MCP session.
 *
 * Given configuration and method handlers, returns a curried function:
 *   `(state) => (value) => [newState, Effect<O, Response | null>]`
 *
 * Rules:
 * - Notifications (no `id`) are silently accepted in any state; state is unchanged.
 * - `initialize` is accepted in any state and transitions to `initialized`.
 * - Any other method before `initialize` → error -32002 (not initialized).
 * - Methods gated by a capability (e.g. `tools/list`) → -32601 when the capability
 *   is absent.
 */
export const mcpStep = <O extends Operation>(config: McpConfig) =>
    (handlers: McpHandlers<O>) =>
    (state: McpSessionState) =>
    (value: Unknown): readonly [McpSessionState, Effect<O, Response | null>] => {
        const decoded = decodeRequest(value)
        if (decoded[0] === 'error') {
            return [state, pure(_errResponse(null)(invalidRequest))]
        }
        const message = decoded[1]
        const msgId = message.id

        // Notifications never receive a response; state is unchanged.
        if (msgId === undefined) {
            return [state, pure(null)]
        }

        const id: Id = msgId

        // `initialize` is always handled by the lifecycle layer itself.
        if (message.method === 'initialize') {
            const pr = validate(initializeParams)(message.params)
            if (pr[0] === 'error') {
                return [state, pure(_errResponse(id)(invalidParams))]
            }
            const newInitialized: InitializedState = {
                protocolVersion: config.protocolVersion,
                capabilities: config.capabilities,
            }
            const result: InitializeResult = {
                protocolVersion: config.protocolVersion,
                capabilities: config.capabilities,
                serverInfo: config.serverInfo,
                instructions: undefined,
            }
            return [
                ['initialized', newInitialized],
                pure(_okResponse(id)(result)),
            ]
        }

        // All other methods require initialized state.
        if (state[0] === 'uninitialized') {
            return [state, pure(_errResponse(id)(notInitialized))]
        }

        const { capabilities } = state[1]

        if (message.method === 'tools/list') {
            if (capabilities.tools === undefined) {
                return [state, pure(_errResponse(id)(methodNotFound))]
            }
            return [state, handlers.toolsList().step(r => pure(_okResponse(id)(r)))]
        }

        if (message.method === 'tools/call') {
            if (capabilities.tools === undefined) {
                return [state, pure(_errResponse(id)(methodNotFound))]
            }
            const pr = validate(toolsCallParams)(message.params)
            if (pr[0] === 'error') {
                return [state, pure(_errResponse(id)(invalidParams))]
            }
            return [state, handlers.toolsCall(pr[1]).step(r => pure(_okResponse(id)(r)))]
        }

        return [state, pure(_errResponse(id)(methodNotFound))]
    }
