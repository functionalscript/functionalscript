/**
 * The FJS MCP server: the composition root the `fjs mcp` / `m` CLI command
 * runs. Session configuration (`McpConfig`), the top-level entry point
 * (`casMcpServer`, wiring `mcpStep` + `stdioTransport` from
 * `fjs/protocol/mcp/`), and the composed tool registry — nothing CAS- or
 * Evo-specific lives here, it only knows about tool *registries*, not what is
 * in them, so a future non-CAS tool set can land as a new sibling of
 * `fjs/mcp/cas/` and `fjs/mcp/evo/` without touching either of them.
 *
 * ## Tools
 *
 * | Tool           | args                                          | action           | result                              |
 * |----------------|------------------------------------------------|------------------|--------------------------------------|
 * | `cas_add`      | `{ content, type? }`                          | `c.write(...)`   | hash (cBase32)                      |
 * | `cas_get`      | `{ hash, content?: boolean }`                 | `c.read(key)`    | JSON `{length,mimeType,type[,uri][,text\|blob]}` |
 * | `cas_list`     | `{}`                                          | `c.list()`       | hashes, one per line                |
 * | `evo_list`     | `{ archived? }`                               | `e.list(...)`    | subjects, as a JSON array of strings |
 * | `evo_head`     | `{ subject }`                                 | `e.head(...)`    | head hashes, one per line           |
 * | `evo_revision` | `{ hash }`                                    | `e.revision(...)`| the revision, as JSON               |
 * | `evo_add`      | `{ parents, snapshot?, subject?, archived? }` | `e.add(...)`     | hash (cBase32)                      |
 *
 * `cas_add`/`cas_get`/`cas_list` are `fjs/mcp/cas` — see that module for tool
 * documentation (input encoding, output shape, error convention). `evo_*` is
 * `fjs/mcp/evo`. Both tool sets run in one process, sharing one `~/.cas/`
 * store and one in-memory Evo cache scanned once at startup (`initEvo`).
 *
 * @module
 *
 * @import { Effect } from '../effects/types.ts'
 * @import { MemOp } from '../effects/memory/types.ts'
 * @import { Read, Write } from '../effects/node/types.ts'
 * @import { McpConfig, McpHandlers } from '../protocol/mcp/types.ts'
 * @import { FileCasOperation } from '../cas/types.ts'
 * @import { Cache } from '../cas/evo/types.ts'
 * @import { Key } from '../effects/memory/types.ts'
 */

import { step } from '../effects/module.f.mjs'
import { create } from '../effects/memory/module.f.mjs'
import { stdioTransport } from '../protocol/mcp/stdio/module.f.mjs'
import {
    mcpStep, uninitializedState, fromRegistry,
} from '../protocol/mcp/module.f.mjs'
import { fileCas } from '../cas/module.f.mjs'
import { initEvo, evo } from '../cas/evo/module.f.mjs'
import { sha256 } from '../crypto/sha2/module.f.mjs'
import { casToolRegistry } from './cas/module.f.mjs'
import { evoToolRegistry } from './evo/module.f.mjs'

// ── Handlers ────────────────────────────────────────────────────────────────────

/**
 * MCP handlers for `FileCas` (`fjs/mcp/cas`) plus the Evo API (`fjs/mcp/evo`)
 * layered on it, bound to `home` and an already-built Evo cache slot (see
 * `initEvo`).
 * @type {(home: string) => (cacheKey: Key<Cache>) => McpHandlers<FileCasOperation | MemOp>}
 */
export const casMcpHandlers = home => cacheKey =>
    fromRegistry([...casToolRegistry(home)(cacheKey), ...evoToolRegistry(evo(fileCas(sha256)(home))(cacheKey))])

// ── Session configuration ───────────────────────────────────────────────────────

/**
 * Static MCP configuration for the CAS server: advertises the `tools`
 * capability, identifies the server, and pins the protocol version.
 * @type {McpConfig}
 */
export const casConfig = {
    serverInfo: { name: 'functionalscript-cas', version: '0.30.0' },
    capabilities: { tools: {} },
    protocolVersion: '2024-11-05',
}

// ── Server ──────────────────────────────────────────────────────────────────────

/**
 * Runs the combined CAS + Evo MCP server over stdio: scans `~/.cas/` once to
 * build the Evo subject/head cache (`initEvo`), allocates the session-state
 * slot, builds the `mcpStep` for the merged tool registry, and drives the
 * read → parse → dispatch → write loop until stdin EOF.
 * @type {(home: string) => Effect<Read | Write | MemOp | FileCasOperation, void>}
 */
export const casMcpServer = home => step(
    initEvo(fileCas(sha256)(home)),
    cacheKey => step(
        create(uninitializedState),
        sessionKey =>
            stdioTransport(mcpStep(casConfig)(casMcpHandlers(home)(cacheKey))(sessionKey)),
    ),
)

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    // casMcpServer is never called in integration tests because it drives a
    // real stdio server; call it here to cover its Effect-building body.
    casMcpServer: () => { casMcpServer('/') },
}
