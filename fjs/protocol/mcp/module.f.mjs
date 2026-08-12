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
 * JSON-RPC dispatcher are in `fjs/protocol/json_rpc/module.f.mjs`.
 *
 * @module
 *
 * @import { Unknown } from '../../media/json/types.ts'
 * @import { Ts } from '../../types/rtti/ts/types.ts'
 * @import { Operation, Effect } from '../../effects/types.ts'
 * @import { Key, MemOp } from '../../effects/memory/types.ts'
 * @import { Response, Id, RpcError } from '../json_rpc/types.ts'
 * @import { Type } from '../../types/rtti/types.ts'
 * @import {
 *   Implementation, ServerCapabilities, InitializeResult, Tool,
 *   ToolsListParams, ToolsCallResult, McpHandlers, ToolEntry,
 *   InitializedState, McpSessionState, McpConfig,
 * } from './types.ts'
 */

import { boolean, string, option, array, record, or } from '../../types/rtti/module.f.mjs'
import { pure, step } from '../../effects/module.f.mjs'
import { read, write } from '../../effects/memory/module.f.mjs'
import {
    decodeRequest,
    rpcError, invalidRequest, invalidParams, methodNotFound,
    jsonrpc,
} from '../json_rpc/module.f.mjs'
import { validate } from '../../types/rtti/validate/module.f.mjs'
import { toJsonSchema } from '../../media/json/schema/module.f.mjs'
import { unknown } from '../../media/json/rtti/module.f.mjs'

// ── Shared ─────────────────────────────────────────────────────────────────────

/** Name + version pair sent in `initialize` requests and responses. */
export const implementation = /** @type {const} */ ({
    name: string,
    version: string,
})

// ── Capabilities ───────────────────────────────────────────────────────────────

const toolsCapability = /** @type {const} */ ({ listChanged: option(boolean) })

/** Server capabilities advertised in the `initialize` response. */
export const serverCapabilities = /** @type {const} */ ({
    tools: option(toolsCapability),
})

// ── Lifecycle ──────────────────────────────────────────────────────────────────

/** Params for the `initialize` request. */
export const initializeParams = /** @type {const} */ ({
    protocolVersion: string,
    capabilities: unknown,
    clientInfo: implementation,
})

/** Result for the `initialize` request. */
export const initializeResult = /** @type {const} */ ({
    protocolVersion: string,
    capabilities: serverCapabilities,
    serverInfo: implementation,
    instructions: option(string),
})

// ── Content ────────────────────────────────────────────────────────────────────

/** Plain-text content item returned by a tool call. */
export const textContent = /** @type {const} */ ({ type: 'text', text: string })

/**
 * A binary resource carried inside an {@link embeddedResource}: a base64
 * `blob`, an addressing `uri`, and an optional `mimeType`. This is MCP's
 * `BlobResource` shape — the idiomatic way to return typed binary content so a
 * `mimeType` travels alongside the bytes and clients know how to route them.
 */
export const blobResource = /** @type {const} */ ({
    uri: string,
    mimeType: option(string),
    blob: string,
})

/** An `EmbeddedResource` content item wrapping a {@link blobResource}. */
export const embeddedResource = /** @type {const} */ ({
    type: 'resource',
    resource: blobResource,
})

/**
 * A single item in a `tools/call` result's `content` array: either plain
 * {@link textContent} or an {@link embeddedResource} for typed binary. The
 * `image` and `audio` variants are not modelled yet.
 */
export const contentItem = or(textContent, embeddedResource)

// ── Tools ──────────────────────────────────────────────────────────────────────

/**
 * A tool descriptor returned by `tools/list`.
 * `inputSchema` is a JSON Schema object — use `toJsonSchema` to derive it from
 * an rtti schema.
 */
export const tool = /** @type {const} */ ({
    name: string,
    description: option(string),
    inputSchema: unknown,
})

/**
 * Params for the `tools/list` request. `cursor` is an opaque pagination token
 * from a previous `ToolsListResult.nextCursor`.
 */
export const toolsListParams = /** @type {const} */ ({
    cursor: option(string),
})

export const toolsListResult = /** @type {const} */ ({
    tools: array(tool),
    nextCursor: option(string),
})

export const toolsCallParams = /** @type {const} */ ({
    name: string,
    arguments: option(record(unknown)),
})

export const toolsCallResult = /** @type {const} */ ({
    content: array(contentItem),
    isError: option(boolean),
})

// ── Dispatch ───────────────────────────────────────────────────────────────────

/**
 * Creates a type-safe tool entry that binds an RTTI schema with a handler.
 *
 * The builder validates arguments at runtime using the RTTI and passes pre-validated
 * arguments (typed as `Ts<T>`) to the handler. This eliminates manual validation
 * boilerplate and type assertions.
 *
 * @template {Type} T
 * @template {Operation} O
 * @param {string} name - The tool name (used in `tools/call` requests)
 * @param {string} description - Human-readable description for `tools/list`
 * @param {T} inputRtti - Runtime type info for input validation
 * @param {(args: Ts<T>) => Effect<O, ToolsCallResult>} handle - Handler receiving validated arguments of type `Ts<inputRtti>`
 * @returns {ToolEntry<O>} A `ToolEntry` ready to be added to a registry
 */
export const toolEntry = (name, description, inputRtti, handle) => ({
    name,
    description,
    inputRtti,
    /** @type {(a: Unknown) => Effect<O, ToolsCallResult>} */
    handle: a => {
        const [t, r] = validate(/** @type {any} */ (inputRtti))(a)
        return t === 'error'
            ? pure(errorResult(`invalid arguments: ${r.message}`))
            : handle(/** @type {Ts<T>} */ (r))
    }
})

/**
 * Helper to create a successful single-text-block tool result.
 *
 * @param {string} text - The text to return to the client
 * @returns {ToolsCallResult} A `ToolsCallResult` with the text content
 */
export const okResult = text =>
    ({ content: [{ type: 'text', text }] })

/**
 * Helper to create a tool-level error result with plain text explanation.
 *
 * @param {string} text - The error message to return to the client
 * @returns {ToolsCallResult} A `ToolsCallResult` with `isError: true` and the text explanation
 */
export const errorResult = text =>
    ({ ...okResult(text), isError: true })

/**
 * Builds `McpHandlers` from a registry of tool entries.
 *
 * This factory generates `toolsList` and `toolsCall` handlers that work with a
 * declarative registry, eliminating boilerplate. The `toolsList` handler converts
 * entries into MCP `Tool` descriptors, and `toolsCall` dispatches by name and
 * delegates to the appropriate handler.
 *
 * @template {Operation} O
 * @param {readonly ToolEntry<O>[]} registry - Array of tool entries
 * @returns {McpHandlers<O>} Complete `McpHandlers` ready for use with `mcpStep`
 */
export const fromRegistry = registry => ({
    toolsList: () => {
        /** @type {Tool[]} */
        const tools = registry.map(entry => ({
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

// ── Lifecycle / capability state machine ───────────────────────────────────────

/** @type {(id: Id) => (error: RpcError) => Response} */
const _errResponse = id => error => ({ jsonrpc, error, id })

/** @type {(id: Id) => (result: Unknown) => Response} */
const _okResponse = id => result => ({ jsonrpc, result, id })

/** MCP error -32002: the client called a method before `initialize`. */
export const notInitialized = rpcError(-32002)('Server not initialized')

// Params for methods that take no arguments (`ping`, `notifications/initialized`):
// absent, or an object (which may carry `_meta`).
const _noParams = option(record(unknown))

/** Initial session state — always start here. */
export const uninitializedState = /** @type {McpSessionState} */ (['uninitialized'])

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
 *
 * @param {McpConfig} config
 * @returns {<O extends Operation>(handlers: McpHandlers<O>) => (stateKey: Key<McpSessionState>) => (value: Unknown) => Effect<MemOp | O, Response | null>}
 */
export const mcpStep = ({
        protocolVersion,
        capabilities,
        serverInfo,
    }) =>
    handlers =>
    stateKey =>
    value => {
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
                            write(stateKey, ['initialized', /** @type {InitializedState} */ (true)]),
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
                    /** @type {InitializeResult} */
                    const result = {
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
