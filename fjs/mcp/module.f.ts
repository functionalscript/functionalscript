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
 */
import { step } from '../effects/module.f.mjs'
import type { Effect } from '../effects/types.ts'
import { create, type MemOp } from '../effects/memory/module.f.ts'
import { type Read, type Write } from '../effects/node/module.f.ts'
import { stdioTransport } from '../protocol/mcp/stdio/module.f.ts'
import {
    mcpStep, uninitializedState, fromRegistry,
    type McpConfig, type McpHandlers,
} from '../protocol/mcp/module.f.ts'
import { fileCas, type FileCasOperation } from '../cas/module.f.ts'
import { initEvo, evo, type Cache } from '../cas/evo/module.f.ts'
import { sha256 } from '../crypto/sha2/module.f.mjs'
import { casToolRegistry } from './cas/module.f.ts'
import { evoToolRegistry } from './evo/module.f.ts'
import type { Key } from '../effects/memory/module.f.ts'

// ── Handlers ────────────────────────────────────────────────────────────────────

/**
 * MCP handlers for `FileCas` (`fjs/mcp/cas`) plus the Evo API (`fjs/mcp/evo`)
 * layered on it, bound to `home` and an already-built Evo cache slot (see
 * `initEvo`).
 */
export const casMcpHandlers = (home: string) => (cacheKey: Key<Cache>): McpHandlers<FileCasOperation | MemOp> =>
    fromRegistry([...casToolRegistry(home)(cacheKey), ...evoToolRegistry(evo(fileCas(sha256)(home))(cacheKey))])

// ── Session configuration ───────────────────────────────────────────────────────

/**
 * Static MCP configuration for the CAS server: advertises the `tools`
 * capability, identifies the server, and pins the protocol version.
 */
export const casConfig: McpConfig = {
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
 */
export const casMcpServer = (
    home: string,
): Effect<Read | Write | MemOp | FileCasOperation, void> => step(
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
