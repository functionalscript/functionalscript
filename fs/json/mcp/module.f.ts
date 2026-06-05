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
import { boolean, string, option, array, record } from '../../types/rtti/module.f.ts'
import { unknown, type Unknown } from '../module.f.ts'
import type { Ts } from '../../types/rtti/ts/module.f.ts'
import type { Operation, Effect } from '../../effects/module.f.ts'
import type { Response } from '../rpc/module.f.ts'

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
