/**
 * MCP (Model Context Protocol) message schemas — minimal subset for a
 * hello-world tool server.
 *
 * Covers the three exchanges a minimal server must handle:
 * - `initialize` / `notifications/initialized` lifecycle
 * - `tools/list` — advertise available tools
 * - `tools/call` — invoke a tool and return text content
 *
 * Each schema is both a runtime decoder (`parse(schema)`) and a static
 * TypeScript type (`Ts<typeof schema>`). Transport framing (stdio) and the
 * JSON-RPC dispatcher are in `fjs/protocol/json_rpc/module.f.mjs`.
 *
 * @module
 *
 * @import { Unknown } from '../../media/json/types.ts'
 * @import { Ts } from '../../types/rtti/ts/types.ts'
 * @import { Effect, Operation } from '../../effects/types.ts'
 * @import { Key, MemOp } from '../../effects/memory/types.ts'
 * @import { Response } from '../json_rpc/types.ts'
 * @import { Type } from '../../rtti/types.ts'
 * @import { Implementation, ServerCapabilities, InitializeResult, Tool, ToolsListParams, ToolsCallResult, McpHandlers, ToolEntry, McpSessionState, McpConfig, ProtocolVersions } from './types.ts'
 */

import { boolean, string, open, option, array, record, or } from '../../types/rtti/module.f.mjs'
import { pureOk, resultMapStep, resultStep, step as ioStep } from '../../effects/module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'
import { read, write } from '../../effects/memory/module.f.mjs'
import {
    decodeRequest,
    rpcError, internalError, invalidRequest, invalidParams, methodNotFound,
    errorResponseOf, successResponseOf,
} from '../json_rpc/module.f.mjs'
import { parse } from '../../types/rtti/parse/module.f.mjs'
import { toJsonSchema } from '../../media/json/schema/module.f.mjs'
import { unknown } from '../../media/json/rtti/module.f.mjs'

// ── Shared ─────────────────────────────────────────────────────────────────────

// Every struct below says `open`, and that is the protocol's requirement
// rather than a default: a bare struct is closed, and a peer implementing a
// later revision of MCP sends members this one does not name — a schema that
// rejected them would fail every such peer outright, where ignoring them is
// what the specification asks for. Do not drop a wrapper.

/** Name + version pair sent in `initialize` requests and responses. */
export const implementation = open(/** @type {const} */ ({
    name: string,
    version: string,
}))

// ── Capabilities ───────────────────────────────────────────────────────────────

const toolsCapability = open(/** @type {const} */ ({ listChanged: option(boolean) }))

/** Server capabilities advertised in the `initialize` response. */
export const serverCapabilities = open(/** @type {const} */ ({
    tools: option(toolsCapability),
}))

// ── Lifecycle ──────────────────────────────────────────────────────────────────

/** Params for the `initialize` request. */
export const initializeParams = open(/** @type {const} */ ({
    protocolVersion: string,
    capabilities: unknown,
    clientInfo: implementation,
}))

/** Result for the `initialize` request. */
export const initializeResult = open(/** @type {const} */ ({
    protocolVersion: string,
    capabilities: serverCapabilities,
    serverInfo: implementation,
    instructions: option(string),
}))

// ── Content ────────────────────────────────────────────────────────────────────

/** Plain-text content item returned by a tool call. */
export const textContent = open(/** @type {const} */ ({ type: 'text', text: string }))

/**
 * A binary resource carried inside an {@link embeddedResource}: a base64
 * `blob`, an addressing `uri`, and an optional `mimeType`. This is MCP's
 * `BlobResource` shape — the idiomatic way to return typed binary content so a
 * `mimeType` travels alongside the bytes and clients know how to route them.
 */
export const blobResource = open(/** @type {const} */ ({
    uri: string,
    mimeType: option(string),
    blob: string,
}))

/** An `EmbeddedResource` content item wrapping a {@link blobResource}. */
export const embeddedResource = open(/** @type {const} */ ({
    type: 'resource',
    resource: blobResource,
}))

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
export const tool = open(/** @type {const} */ ({
    name: string,
    description: option(string),
    inputSchema: unknown,
}))

/**
 * Params for the `tools/list` request. `cursor` is an opaque pagination token
 * from a previous `ToolsListResult.nextCursor`.
 */
export const toolsListParams = open(/** @type {const} */ ({
    cursor: option(string),
}))

export const toolsListResult = open(/** @type {const} */ ({
    tools: array(tool),
    nextCursor: option(string),
}))

export const toolsCallParams = open(/** @type {const} */ ({
    name: string,
    arguments: option(record(unknown)),
}))

export const toolsCallResult = open(/** @type {const} */ ({
    content: array(contentItem),
    isError: option(boolean),
}))

// ── Dispatch ───────────────────────────────────────────────────────────────────

/**
 * Creates a type-safe tool entry that binds an RTTI schema with a handler.
 *
 * The builder validates arguments at runtime using the RTTI and passes pre-validated
 * arguments (typed as `Ts<T>`) to the handler. This eliminates manual validation
 * boilerplate and type assertions.
 *
 * @template {Type} const T
 * @template {Operation} O
 * @param {string} name - The tool name (used in `tools/call` requests)
 * @param {string} description - Human-readable description for `tools/list`
 * @param {T} inputRtti - Runtime type info for input validation
 * @param {(args: Ts<T>) => Effect<O, ToolsCallResult, never>} handle - Handler receiving validated arguments of type `Ts<inputRtti>`
 * @returns {ToolEntry<O>} A `ToolEntry` ready to be added to a registry
 */
export const toolEntry = (name, description, inputRtti, handle) => ({
    name,
    description,
    inputRtti,
    /** @type {(a: Unknown) => Effect<O, ToolsCallResult, never>} */
    handle: a => {
        const [t, r] = parse(/** @type {any} */ (inputRtti))(a)
        return t === 'error'
            ? pureOk(errorResult(`invalid arguments: ${r.message}`))
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
 * Answers a tool call with the outcome of one fallible operation: the `ok`
 * value rendered by `text`, the failure rendered by `errorText` and tagged
 * `isError`. It is the third member of the {@link okResult} / {@link errorResult}
 * family — the one that picks between them — and it empties the error channel,
 * because a tool-level failure is a result the client reads, never a transport
 * error.
 *
 * Every tool whose body is a single `Evo`- or `Cas`-shaped call is that
 * dispatch and nothing else, so each one is a single line:
 *
 * ```js
 * ({ subject }) => toolResultStep(e.head(subject), lines, evoSummary)
 * ```
 *
 * **Both renderers are required, and `errorText` is the load-bearing one** —
 * for the reason `unwrapStep` gives for its own `summary`
 * (`fjs/effects/module.f.mjs`): a renderer written for a particular error
 * channel cannot accept a wider one, so a fallible call added upstream turns
 * into a compile error at the tool that has to say what the new failure reads
 * like, instead of silently reaching the client as whatever `String` made of
 * it. `evoSummary` and `errorSummary` are the two in use today.
 *
 * @type {<O extends Operation, T, E>(
 *     e: Effect<O, T, E>,
 *     text: (value: T) => string,
 *     errorText: (e: E) => string,
 * ) => Effect<O, ToolsCallResult, never>}
 */
export const toolResultStep = (e, text, errorText) => resultMapStep(
    e,
    ([tag, value]) => ok(tag === 'error'
        ? errorResult(errorText(value))
        : okResult(text(value))))

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
        return pureOk({ tools })
    },
    toolsCall: ({ name, arguments: args }) => {
        const entry = registry.find(e => e.name === name)
        return entry === undefined
            ? pureOk(errorResult(`unknown tool: ${name}`))
            : entry.handle(args === undefined ? {} : args)
    },
})

// ── Lifecycle / capability state machine ───────────────────────────────────────

/** MCP error -32002: the client called a method before `initialize`. */
export const notInitialized = rpcError(-32002)('Server not initialized')

// Params for methods that take no arguments (`ping`, `notifications/initialized`):
// absent, or an object (which may carry `_meta`).
const _noParams = option(record(unknown))

/** Initial session state — always start here. */
/** @type {McpSessionState} */
export const uninitializedState = ['uninitialized']

/**
 * Version negotiation: the revision to answer an `initialize` with. The
 * requested one when this server speaks it, the latest one it does speak
 * otherwise — a counter-proposal, not an error, because the
 * [lifecycle spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle#version-negotiation)
 * leaves the decision to the client (`SHOULD disconnect`). `supported` is
 * non-empty by type, so there is always something to propose.
 * @type {(supported: ProtocolVersions, requested: string) => string}
 */
const _negotiateVersion = (supported, requested) => {
    const [latest] = supported
    return supported.includes(requested) ? requested : latest
}

/**
 * State-machine step for an MCP session using memory effects.
 *
 * Given configuration, handlers, and a memory key holding the session state,
 * returns a function `(value) => Effect<MemOp | O, Response | null, never>`.
 *
 * Rules:
 * - `ping` returns an empty success regardless of session state; non-object
 *   params → -32602.
 * - `initialize` is accepted only while uninitialized; a second call returns -32600.
 *   On success the state moves to `initializing`, not `initialized`. The answered
 *   `protocolVersion` is negotiated against `config.protocolVersions`: the client's
 *   requested revision when the server supports it, the latest supported one
 *   otherwise. A counter-proposal is a success frame like any other — the client,
 *   not the server, decides whether the answer is usable — so the state moves the
 *   same way in both cases.
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
 * @returns {<O extends Operation>(handlers: McpHandlers<O>) => (stateKey: Key<McpSessionState>) => (value: Unknown) => Effect<MemOp | O, Response | null, never>}
 */
export const mcpStep = ({
        protocolVersions,
        capabilities,
        serverInfo,
    }) =>
    handlers =>
    stateKey =>
    value => {
        const [t, message] = decodeRequest(value)
        if (t === 'error') {
            return pureOk(errorResponseOf(null)(invalidRequest))
        }
        const { id, method, params } = message

        // Notifications (no `id`) never receive a response.
        // `notifications/initialized` transitions the session from initializing → initialized.
        if (id === undefined) {
            if (method === 'notifications/initialized') {
                const [pt] = parse(_noParams)(params)
                if (pt === 'error') {
                    // Malformed handshake — ignore it; the session stays gated.
                    return pureOk(null)
                }
                // A notification never receives a response, so a session-state
                // failure here has nowhere to be reported: the transition is
                // skipped and the session stays gated, which the client then
                // observes as `notInitialized` on its next call. That is the
                // honest degradation — better than a panic, and there is no
                // response frame to put an error in.
                return resultStep(read(stateKey), r => {
                    if (r[0] === 'error' || r[1][0] !== 'initializing') {
                        return pureOk(null)
                    }
                    // `resultMapStep`: a notification has no response frame, so
                    // the write's own outcome is absorbed here for the same
                    // reason the read's is above.
                    return resultMapStep(write(stateKey, ['initialized', true]), () => ok(null))
                })
            }
            return pureOk(null)
        }

        // `ping` is always valid regardless of session state, but its params
        // (if present) must be an object.
        if (method === 'ping') {
            const [pt] = parse(_noParams)(params)
            return pt === 'error'
                ? pureOk(errorResponseOf(id)(invalidParams))
                : pureOk(successResponseOf(id)({}))
        }

        // `initialize` transitions uninitialized → initializing; reject if already done.
        if (method === 'initialize') {
            return resultStep(
                read(stateKey),
                r => {
                    if (r[0] === 'error') { return pureOk(errorResponseOf(id)(internalError)) }
                    if (r[1][0] !== 'uninitialized') {
                        return pureOk(errorResponseOf(id)(invalidRequest))
                    }
                    const [pr, pv] = parse(initializeParams)(params)
                    if (pr === 'error') {
                        return pureOk(errorResponseOf(id)(invalidParams))
                    }
                    /** @type {InitializeResult} */
                    const result = {
                        protocolVersion: _negotiateVersion(protocolVersions, pv.protocolVersion),
                        capabilities,
                        serverInfo,
                    }
                    // The write's outcome decides the answer. It used to be
                    // discarded by a `() =>` continuation, so a session that
                    // failed to record the transition still replied with a
                    // successful handshake and then rejected every call after
                    // it as `notInitialized`.
                    return resultStep(
                        write(stateKey, ['initializing']),
                        w => pureOk(w[0] === 'error'
                            ? errorResponseOf(id)(internalError)
                            : successResponseOf(id)(result)),
                    )
                },
            )
        }

        // All other methods require fully initialized state — read it first.
        // A session whose state cannot be read is an internal server error, not
        // an uninitialized one: `notInitialized` tells the client to run the
        // handshake it has already run, and it would run it again forever.
        return resultStep(
            read(stateKey),
            r => {
                if (r[0] === 'error') { return pureOk(errorResponseOf(id)(internalError)) }
                if (r[1][0] !== 'initialized') {
                    return pureOk(errorResponseOf(id)(notInitialized))
                }

                if (method === 'tools/list') {
                    if (capabilities.tools === undefined) {
                        return pureOk(errorResponseOf(id)(methodNotFound))
                    }
                    // `params` may be absent — `tools/list` without a cursor.
                    const [t, pr] = parse(toolsListParams)(params === undefined ? {} : params)
                    return t === 'error'
                        ? pureOk(errorResponseOf(id)(invalidParams))
                        : ioStep(
                            handlers.toolsList(pr),
                            r => pureOk(successResponseOf(id)(r)),
                        )
                }

                if (method === 'tools/call') {
                    if (capabilities.tools === undefined) {
                        return pureOk(errorResponseOf(id)(methodNotFound))
                    }
                    const [t, pr] = parse(toolsCallParams)(params)
                    return t === 'error'
                        ? pureOk(errorResponseOf(id)(invalidParams))
                        : ioStep(
                            handlers.toolsCall(pr),
                            r => pureOk(successResponseOf(id)(r)),
                        )
                }

                return pureOk(errorResponseOf(id)(methodNotFound))
            },
        )
    }
