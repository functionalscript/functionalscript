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
 * JSON-RPC dispatcher are in `fjs/media/json/rpc/module.f.ts`.
 *
 * @module
 */
import { boolean, string, option, array, record, or } from '../types/rtti/module.f.ts'
import { unknown, type Unknown } from '../media/json/module.f.ts'
import type { Ts } from '../types/rtti/ts/module.f.ts'
import { pure, type Operation, type Effect, step } from '../effects/module.f.ts'
import { read, write, type Key, type MemOp } from '../effects/memory/module.f.ts'
import {
    decodeRequest,
    rpcError, invalidRequest, invalidParams, methodNotFound,
    type Response, type Id, type RpcError,
    jsonrpc,
} from '../media/json/rpc/module.f.ts'
import { validate } from '../types/rtti/validate/module.f.ts'
import { toJsonSchema } from '../media/json/schema/module.f.ts'
import type { Type } from '../types/rtti/module.f.ts'

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

/**
 * A binary resource carried inside an {@link embeddedResource}: a base64
 * `blob`, an addressing `uri`, and an optional `mimeType`. This is MCP's
 * `BlobResource` shape — the idiomatic way to return typed binary content so a
 * `mimeType` travels alongside the bytes and clients know how to route them.
 */
export const blobResource = {
    uri: string,
    mimeType: option(string),
    blob: string,
} as const
export type BlobResource = Ts<typeof blobResource>

/** An `EmbeddedResource` content item wrapping a {@link blobResource}. */
export const embeddedResource = {
    type: 'resource',
    resource: blobResource,
} as const
export type EmbeddedResource = Ts<typeof embeddedResource>

/**
 * A single item in a `tools/call` result's `content` array: either plain
 * {@link textContent} or an {@link embeddedResource} for typed binary. The
 * `image` and `audio` variants are not modelled yet.
 */
export const contentItem = or(textContent, embeddedResource)
export type ContentItem = Ts<typeof contentItem>

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

/**
 * Params for the `tools/list` request. `cursor` is an opaque pagination token
 * from a previous `ToolsListResult.nextCursor`.
 */
export const toolsListParams = {
    cursor: option(string),
} as const
export type ToolsListParams = Ts<typeof toolsListParams>

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
    content: array(contentItem),
    isError: option(boolean),
} as const
export type ToolsCallResult = Ts<typeof toolsCallResult>

// ── Dispatch ───────────────────────────────────────────────────────────────────

/** Per-method handlers for a hello-world MCP tool server. */
export type McpHandlers<O extends Operation> = {
    readonly toolsList: (params: ToolsListParams) => Effect<O, ToolsListResult>
    readonly toolsCall: (params: ToolsCallParams) => Effect<O, ToolsCallResult>
}

/**
 * A single declarative tool entry combining metadata, input schema, and type-safe handler.
 *
 * The handler receives pre-validated arguments of type `Ts<inputRtti>`, eliminating the need
 * for manual validation or type casting. All validation is encapsulated in the entry.
 */
export type ToolEntry<O extends Operation> = {
    readonly name: string
    readonly description: string
    readonly inputRtti: Type
    readonly handle: (args: Unknown) => Effect<O, ToolsCallResult>
}

/**
 * Creates a type-safe tool entry that binds an RTTI schema with a handler.
 *
 * The builder validates arguments at runtime using the RTTI and passes pre-validated
 * arguments (typed as `Ts<T>`) to the handler. This eliminates manual validation
 * boilerplate and type assertions.
 *
 * @param name - The tool name (used in `tools/call` requests)
 * @param description - Human-readable description for `tools/list`
 * @param inputRtti - Runtime type info for input validation
 * @param handle - Handler receiving validated arguments of type `Ts<inputRtti>`
 * @returns A `ToolEntry` ready to be added to a registry
 */
export const toolEntry = <T extends Type, O extends Operation>(
    name: string,
    description: string,
    inputRtti: T,
    handle: (args: Ts<T>) => Effect<O, ToolsCallResult>
): ToolEntry<O> => ({
    name,
    description,
    inputRtti,
    handle: (a: Unknown) => {
        const [t, r] = validate(inputRtti as any)(a)
        return t === 'error'
            ? pure(errorResult(`invalid arguments: ${r.message}`))
            : handle(r as Ts<T>)
    }
})

/**
 * Helper to create a successful single-text-block tool result.
 *
 * @param text - The text to return to the client
 * @returns A `ToolsCallResult` with the text content
 */
export const okResult = (text: string): ToolsCallResult =>
    ({ content: [{ type: 'text', text }] })

/**
 * Helper to create a tool-level error result with plain text explanation.
 *
 * @param text - The error message to return to the client
 * @returns A `ToolsCallResult` with `isError: true` and the text explanation
 */
export const errorResult = (text: string): ToolsCallResult =>
    ({ ...okResult(text), isError: true })

/**
 * Builds `McpHandlers` from a registry of tool entries.
 *
 * This factory generates `toolsList` and `toolsCall` handlers that work with a
 * declarative registry, eliminating boilerplate. The `toolsList` handler converts
 * entries into MCP `Tool` descriptors, and `toolsCall` dispatches by name and
 * delegates to the appropriate handler.
 *
 * @param registry - Array of tool entries
 * @returns Complete `McpHandlers` ready for use with `mcpStep`
 */
export const fromRegistry = <O extends Operation>(
    registry: readonly ToolEntry<O>[],
): McpHandlers<O> => ({
    toolsList: () => {
        const tools: Tool[] = registry.map(entry => ({
            name: entry.name,
            description: entry.description,
            inputSchema: toJsonSchema(entry.inputRtti),
        }))
        return pure({ tools })
    },
    toolsCall: ({ name, arguments: args }) => {
        const entry = registry.find(e => e.name === name)
        return entry === undefined
            ? pure(errorResult(`unknown tool: ${name}`))
            : entry.handle(args === undefined ? {} : args)
    },
})

/** Top-level handler: maps a raw JSON value to a JSON-RPC response (or `null` for notifications). */
export type Handle<O extends Operation> = (value: Unknown) => Effect<O, Response | null>

// ── Lifecycle / capability state machine ───────────────────────────────────────

const _errResponse = (id: Id) => (error: RpcError): Response =>
    ({ jsonrpc, error, id })

const _okResponse = (id: Id) => (result: Unknown): Response =>
    ({ jsonrpc, result, id })

/** MCP error -32002: the client called a method before `initialize`. */
export const notInitialized = rpcError(-32002)('Server not initialized')

// Params for methods that take no arguments (`ping`, `notifications/initialized`):
// absent, or an object (which may carry `_meta`).
const _noParams = option(record(unknown))

/** State carried before the peer sends `initialize`. */
export type Uninitialized = readonly ['uninitialized']

/** State after `initialize` response was sent but before `notifications/initialized` arrives. */
export type Initializing = readonly ['initializing']

/** State carried after a successful `initialize` exchange. */
export type InitializedState = true

/** The three phases of an MCP session. */
export type McpSessionState =
    | Uninitialized
    | Initializing
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
 * State-machine step for an MCP session using memory effects.
 *
 * Given configuration, handlers, and a memory key holding the session state,
 * returns a function `(value) => Effect<MemOp | O, Response | null>`.
 *
 * Rules:
 * - `ping` returns an empty success regardless of session state; non-object
 *   params → -32602.
 * - `initialize` is accepted only while uninitialized; a second call returns -32600.
 *   On success the state moves to `initializing`, not `initialized`.
 * - `notifications/initialized` (no `id`) transitions `initializing` → `initialized`;
 *   a malformed one (non-object params) is ignored and the session stays gated;
 *   other notifications are silently ignored in any state.
 * - Any other method before `notifications/initialized` → error -32002 (not initialized).
 * - Methods gated by a capability (e.g. `tools/list`) → -32601 when the capability
 *   is absent.
 * - `tools/list` params (an optional pagination `cursor`) are validated and passed
 *   to the handler; invalid params → -32602.
 */
export const mcpStep =
    ({
        protocolVersion,
        capabilities,
        serverInfo,
    }: McpConfig) =>
    <O extends Operation>(handlers: McpHandlers<O>) =>
    (stateKey: Key<McpSessionState>) =>
    (value: Unknown): Effect<MemOp | O, Response | null> => {
        const [t, message] = decodeRequest(value)
        if (t === 'error') {
            return pure(_errResponse(null)(invalidRequest))
        }
        const { id, method, params } = message

        // Notifications (no `id`) never receive a response.
        // `notifications/initialized` transitions the session from initializing → initialized.
        if (id === undefined) {
            if (method === 'notifications/initialized') {
                const [pt] = validate(_noParams)(params)
                if (pt === 'error') {
                    // Malformed handshake — ignore it; the session stays gated.
                    return pure(null)
                }
                return step(
                    read(stateKey),
                    ([t]) => t === 'initializing'
                        ? step(
                            write(stateKey, ['initialized', true as InitializedState]),
                            () => pure(null),
                        )
                        : pure(null),
                )
            }
            return pure(null)
        }

        // `ping` is always valid regardless of session state, but its params
        // (if present) must be an object.
        if (method === 'ping') {
            const [pt] = validate(_noParams)(params)
            return pt === 'error'
                ? pure(_errResponse(id)(invalidParams))
                : pure(_okResponse(id)({}))
        }

        // `initialize` transitions uninitialized → initializing; reject if already done.
        if (method === 'initialize') {
            return step(
                read(stateKey),
                ([t]) => {
                    if (t !== 'uninitialized') {
                        return pure(_errResponse(id)(invalidRequest))
                    }
                    const [pr] = validate(initializeParams)(params)
                    if (pr === 'error') {
                        return pure(_errResponse(id)(invalidParams))
                    }
                    const result: InitializeResult = {
                        protocolVersion,
                        capabilities,
                        serverInfo,
                    }
                    return step(
                        write(stateKey, ['initializing']),
                        () => pure(_okResponse(id)(result))
                    )
                },
            )
        }

        // All other methods require fully initialized state — read it first.
        return step(
            read(stateKey),
            ([t]) => {
                if (t !== 'initialized') {
                    return pure(_errResponse(id)(notInitialized))
                }

                if (method === 'tools/list') {
                    if (capabilities.tools === undefined) {
                        return pure(_errResponse(id)(methodNotFound))
                    }
                    // `params` may be absent — `tools/list` without a cursor.
                    const [t, pr] = validate(toolsListParams)(params === undefined ? {} : params)
                    return t === 'error'
                        ? pure(_errResponse(id)(invalidParams))
                        : step(
                            handlers.toolsList(pr),
                            r => pure(_okResponse(id)(r)),
                        )
                }

                if (method === 'tools/call') {
                    if (capabilities.tools === undefined) {
                        return pure(_errResponse(id)(methodNotFound))
                    }
                    const [t, pr] = validate(toolsCallParams)(params)
                    return t === 'error'
                        ? pure(_errResponse(id)(invalidParams))
                        : step(
                            handlers.toolsCall(pr),
                            r => pure(_okResponse(id)(r)),
                        )
                }

                return pure(_errResponse(id)(methodNotFound))
            },
        )
    }
