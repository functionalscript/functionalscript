/**
 * Type-level API for `fjs/protocol/mcp/module.f.mjs`: the MCP message
 * schemas' derived types, plus the `McpHandlers`/`ToolEntry`/`Handle`/
 * session-state shapes `mcpStep` is built from.
 *
 * @module
 */

import type { Ts } from '../../types/rtti/ts/types.ts'
import type { Unknown } from '../../media/json/types.ts'
import type { Operation, RawEffect } from '../../effects/types.ts'
import type { Type } from '../../types/rtti/types.ts'
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
    readonly toolsList: (params: ToolsListParams) => RawEffect<O, ToolsListResult>
    readonly toolsCall: (params: ToolsCallParams) => RawEffect<O, ToolsCallResult>
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
    readonly handle: (args: Unknown) => RawEffect<O, ToolsCallResult>
}

/** Top-level handler: maps a raw JSON value to a JSON-RPC response (or `null` for notifications). */
export type Handle<O extends Operation> = (value: Unknown) => RawEffect<O, Response | null>

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

/** Static configuration supplied by the server implementer. */
export type McpConfig = {
    readonly serverInfo: Implementation
    readonly capabilities: ServerCapabilities
    readonly protocolVersion: string
}
