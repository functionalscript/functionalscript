/**
 * Type-level API for `fjs/protocol/mcp/module.f.mjs`: the MCP message
 * schemas' derived types, plus the `McpHandlers`/`ToolEntry`/`Handle`/
 * session-state shapes `mcpStep` is built from.
 *
 * @module
 */

import type { Ts } from '../../rtti/ts/types.ts'
import type { Unknown } from '../../media/json/types.ts'
import type { Effect, Operation } from '../../effects/types.ts'
import type { Type } from '../../rtti/types.ts'
import type { Response } from '../json_rpc/types.ts'
import type {
    implementation,
    serverCapabilities,
    initializeParams,
    initializeResult,
    textContent,
    blobResource,
    embeddedResource,
    contentItem,
    tool,
    toolsListParams,
    toolsListResult,
    toolsCallParams,
    toolsCallResult,
} from './module.f.mjs'

export type Implementation = Ts<typeof implementation>
export type ServerCapabilities = Ts<typeof serverCapabilities>
export type InitializeParams = Ts<typeof initializeParams>
export type InitializeResult = Ts<typeof initializeResult>
export type TextContent = Ts<typeof textContent>
export type BlobResource = Ts<typeof blobResource>
export type EmbeddedResource = Ts<typeof embeddedResource>
export type ContentItem = Ts<typeof contentItem>
export type Tool = Ts<typeof tool>
export type ToolsListParams = Ts<typeof toolsListParams>
export type ToolsListResult = Ts<typeof toolsListResult>
export type ToolsCallParams = Ts<typeof toolsCallParams>
export type ToolsCallResult = Ts<typeof toolsCallResult>

/** Per-method handlers for a hello-world MCP tool server. */
export type McpHandlers<O extends Operation> = {
    readonly toolsList: (params: ToolsListParams) => Effect<O, ToolsListResult, never>
    readonly toolsCall: (params: ToolsCallParams) => Effect<O, ToolsCallResult, never>
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
    readonly handle: (args: Unknown) => Effect<O, ToolsCallResult, never>
}

/**
 * A JSON-RPC step: given a decoded message, produce the response to write, or
 * `null` for a notification.
 *
 * **`never` is a claim, not an absence.** The handler behind this does perform
 * effects and they can fail — a session-state read is dispatched by a runner
 * that may decline it. It says `never` because it has *absorbed* those: a
 * request's failure becomes `errorResponseOf(id)(internalError)` and a
 * notification's is dropped, there being no frame to put it in. Spelling that
 * as `Effect<…, never>` puts the decision in the type where a reader can
 * disagree with it, which an opaque payload could not.
 */
export type Handle<O extends Operation> = (value: Unknown) => Effect<O, Response | null, never>

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

/**
 * The protocol revisions a server supports, **latest first** and non-empty by
 * construction — the tuple's head is what an unsupported request is answered
 * with, so "the server supports nothing" is not a state that can be reached.
 */
export type ProtocolVersions = readonly[string, ...readonly string[]]

/** Static configuration supplied by the server implementer. */
export type McpConfig = {
    readonly serverInfo: Implementation
    readonly capabilities: ServerCapabilities
    /**
     * Every revision this server speaks, latest first. `initialize` answers
     * with the client's requested version when it is in this list and with the
     * head — the latest supported one — otherwise, which is the counter-proposal
     * the lifecycle spec prescribes.
     */
    readonly protocolVersions: ProtocolVersions
}
