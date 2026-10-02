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
 * | `cas_get`      | `{ hash, content?: boolean }`                 | `c.read(key)`    | JSON `{length,mimeType,type,uri[,text\|blob]}` |
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
 * @import { Effect, Operation } from '../effects/types.ts'
 * @import { MemOp } from '../effects/memory/types.ts'
 * @import { IoChannel, Read, Write } from '../effects/node/types.ts'
 * @import { McpConfig, McpHandlers, Handle } from '../protocol/mcp/types.ts'
 * @import { FileCas, FileCasOperation } from '../cas/types.ts'
 * @import { Cache } from '../cas/evo/types.ts'
 * @import { Key } from '../effects/memory/types.ts'
 */

import { step, history, historyStep } from '../effects/module.f.mjs'
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
 * MCP handlers for a file-backed CAS store (`fjs/mcp/cas`) plus the Evo API
 * (`fjs/mcp/evo`) layered on that same store, bound to an already-built Evo
 * cache slot (see `initEvo`).
 * @type {(cas: FileCas) => (cacheKey: Key<Cache>) => McpHandlers<FileCasOperation | MemOp>}
 */
export const casMcpHandlers = cas => cacheKey =>
    fromRegistry([...casToolRegistry(cas)(cacheKey), ...evoToolRegistry(evo(cas)(cacheKey))])

// ── Session configuration ───────────────────────────────────────────────────────

/**
 * Static MCP configuration for the CAS server: advertises the `tools`
 * capability, identifies the server, and lists the protocol revisions it
 * speaks — one, so every client is answered with `2024-11-05`, whether that is
 * an echo or a counter-proposal.
 * @type {McpConfig}
 */
export const casConfig = {
    serverInfo: { name: 'functionalscript-cas', version: '0.30.0' },
    capabilities: { tools: {} },
    protocolVersions: ['2024-11-05'],
}

// ── Server ──────────────────────────────────────────────────────────────────────

/**
 * The CAS + Evo MCP session, wired once for any transport: builds the one
 * `fileCas` store under `home`, scans it once to build the Evo subject/head
 * cache (`initEvo`), allocates the session-state slot, and hands the
 * `mcpStep` for the merged tool registry to `transport`.
 *
 * Exported only so the proofs drive the production wiring rather than a copy
 * of it; {@link casMcpServer} is the entry point.
 * @type {(home: string) => <O extends Operation, T, E>(transport: (handle: Handle<FileCasOperation | MemOp>) => Effect<O, T, E>) => Effect<O | FileCasOperation | MemOp, T, E | IoChannel>}
 */
export const _casMcpSession = home => transport => {
    const cas = fileCas(sha256)(home)
    const keys = historyStep(history(initEvo(cas)), () => create(uninitializedState))
    return step(keys, ([sessionKey, cacheKey]) =>
        transport(mcpStep(casConfig)(casMcpHandlers(cas)(cacheKey))(sessionKey)))
}

/**
 * Runs the combined CAS + Evo MCP server over stdio: {@link _casMcpSession}
 * driving the read → parse → dispatch → write loop until stdin EOF.
 * @type {(home: string) => Effect<Read | Write | MemOp | FileCasOperation, void, IoChannel>}
 */
export const casMcpServer = home => _casMcpSession(home)(stdioTransport)

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    // casMcpServer is never called in integration tests because it drives a
    // real stdio server; call it here to cover its effect-building body.
    casMcpServer: () => { casMcpServer('/') },
}
