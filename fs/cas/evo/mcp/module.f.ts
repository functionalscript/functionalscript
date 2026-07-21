/**
 * MCP adapter for the Evo API (`fs/cas/evo/module.f.ts`): subjects and
 * revision heads over the content-addressable store, backed by the in-memory
 * cache the core module maintains.
 *
 * ## Tools
 *
 * | Tool        | args                                     | action        | result                    |
 * |-------------|-------------------------------------------|---------------|---------------------------|
 * | `evo_list`  | `{}`                                       | `e.list()`    | subjects, one per line    |
 * | `evo_head`  | `{ subject }`                              | `e.head(...)` | head hashes, one per line |
 * | `evo_add`   | `{ parents, snapshot?, subject?, archived? }` | `e.add(...)`  | hash (cBase32)            |
 *
 * `evoMcpServer` scans the whole store once at startup (`initEvo`) to build
 * the cache, then serves `tools/call` requests over stdio purely from that
 * cache (`evo_list`/`evo_head`) or by updating both the store and the cache
 * (`evo_add`) — never rescanning the store per request.
 *
 * @module
 */
import { string, option, array } from '../../../types/rtti/module.f.ts'
import { pure, type Effect, type Operation } from '../../../effects/module.f.ts'
import { create, type MemOp } from '../../../effects/memory/module.f.ts'
import { type Read, type Write } from '../../../effects/node/module.f.ts'
import { stdioTransport } from '../../../mcp/stdio/module.f.ts'
import {
    mcpStep, uninitializedState,
    toolEntry, fromRegistry, errorResult, okResult,
    type McpConfig, type McpHandlers, type ToolEntry,
    type ToolsCallResult,
} from '../../../mcp/module.f.ts'
import { fileCas, type FileCasOperation } from '../../module.f.ts'
import { sha256 } from '../../../crypto/sha2/module.f.ts'
import { initEvo, evo, type Evo } from '../module.f.ts'

// ── Argument schemas (declared once, used for both inputSchema and validate) ─────

/** Arguments for `evo_list`: none. */
export const evoListArgs = {} as const

/** Arguments for `evo_head`: the subject whose current heads are requested. */
export const evoHeadArgs = {
    subject: string,
} as const

/** Arguments for `evo_add`: a new revision, per `fs/cas/evo`'s `AddRevision`. */
export const evoAddArgs = {
    parents: array(string),
    snapshot: option(string),
    subject: option(string),
    archived: option(true),
} as const

// ── Tool registry ────────────────────────────────────────────────────────────────

/** Registry of all Evo tools, bound to an `Evo<O>`. */
export const evoToolRegistry =
    <O extends Operation>(e: Evo<O>): readonly ToolEntry<O | MemOp>[] => [
    toolEntry(
        'evo_list',
        'List all subjects with at least one stored revision, one per line.',
        evoListArgs,
        (): Effect<MemOp, ToolsCallResult> =>
            e.list().step(subjects => pure(okResult(subjects.join('\n')))),
    ),
    toolEntry(
        'evo_head',
        'List the current head hashes (cBase32) of a subject, one per line. Empty when the subject is unknown.',
        evoHeadArgs,
        ({ subject }): Effect<MemOp, ToolsCallResult> =>
            e.head(subject).step(heads => pure(okResult(heads.join('\n')))),
    ),
    toolEntry(
        'evo_add',
        'Add a new revision (a `vnd.fjs.revision` blob) and return its hash (cBase32). `subject` is required unless there is exactly one parent, from which it is inherited. `snapshot` follows the `vnd.fjs.revision` inheritance rules when omitted (see `fs/media/revision`).',
        evoAddArgs,
        (input): Effect<O | MemOp, ToolsCallResult> =>
            e.add(input).step(result => pure(result[0] === 'error' ? errorResult(result[1]) : okResult(result[1]))),
    ),
]

// ── Handlers ────────────────────────────────────────────────────────────────────

/** MCP handlers for the Evo API bound to `e`. */
export const evoMcpHandlers = <O extends Operation>(e: Evo<O>): McpHandlers<O | MemOp> =>
    fromRegistry(evoToolRegistry(e))

// ── Session configuration ───────────────────────────────────────────────────────

/**
 * Static MCP configuration for the Evo server: advertises the `tools`
 * capability, identifies the server, and pins the protocol version.
 */
export const evoConfig: McpConfig = {
    serverInfo: { name: 'functionalscript-cas-evo', version: '0.30.0' },
    capabilities: { tools: {} },
    protocolVersion: '2024-11-05',
}

// ── Server ──────────────────────────────────────────────────────────────────────

/**
 * Runs the Evo MCP server over stdio: scans `~/.cas/` once to build the
 * subject/head cache (`initEvo`), allocates the session-state slot, and
 * drives the read → parse → dispatch → write loop until stdin EOF.
 */
export const evoMcpServer = (
    home: string,
): Effect<Read | Write | MemOp | FileCasOperation, void> => {
    const cas = fileCas(sha256)(home)
    return initEvo(cas).step(cacheKey =>
        create(uninitializedState).step(sessionKey =>
            stdioTransport(mcpStep(evoConfig)(evoMcpHandlers(evo(cas)(cacheKey)))(sessionKey))))
}

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    // evoMcpServer is never called in integration tests because it drives a
    // real stdio server; call it here to cover its Effect-building body.
    evoMcpServer: () => { evoMcpServer('/') },
}
