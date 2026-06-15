# Project Goals & Plan

## Vision

A layered, universal content-addressable storage (CAS) platform accessible via MCP.
All original content (primary source of truth) is stored in CAS, keyed by content hash.
Derived/computed information lives only in the MCP server's cache, not in CAS.
The server runs locally over stdio first, with HTTP/HTTPS added later via clean transport abstraction.

### Why CAS as foundation

CAS blocks are globally addressed by content hash. This means synchronization between any two CAS stores is always conflict-free: same hash = same content, so merging is a pure set union — no reconciliation, no conflict resolution, no ordering required.

This property is the foundation for:
- **Multi-device** — sync any two stores, online or offline, always consistent
- **Multi-user** — multiple agents (human or AI) write independently, merge freely
- **Web of trust** — signatures and timestamps are themselves CAS blocks, so trust chains are verifiable content, not metadata
- **Scalability** — stores can be sharded, replicated, or federated without coordination

---

## Layers

```
┌─────────────────────────────────────────────┐
│  6. Revision layer (Git-like commits in CAS) │
├─────────────────────────────────────────────┤
│  5. Trusted timestamps (RFC 3161 → CAS)      │
├─────────────────────────────────────────────┤
│  4. Digital signatures (server key → CAS)    │
├─────────────────────────────────────────────┤
│  3. Type detection (magic bytes → cache)     │
├─────────────────────────────────────────────┤
│  2. Content encoding (base64 for MCP)        │
├─────────────────────────────────────────────┤
│  1. Base: cas_add / cas_get / cas_list       │
└─────────────────────────────────────────────┘
```

**Rule:** Only original content goes in CAS. Recomputable derived data (type, metadata) stays in the MCP server cache. Non-recomputable original data (signatures, timestamps) goes in CAS.

---

## Transport architecture

The MCP dispatcher (`mcpStep`) is transport-agnostic — it produces a pure `Step<O>` function.
Transport wrappers (stdio, HTTP) are separate and interchangeable.

```
casMcpStep(c)(stateKey)(value)   ← pure, no transport
    ↓
stdioTransport(step)             ← local, current
httpTransport(step, port)        ← remote, future
```

Concretely: extract `casMcpStep` from `casMcpServer` in `fs/cas/mcp/module.f.ts` so the
stdio server becomes a one-liner and the HTTP server is additive, not a rewrite.

---

## Priorities

### Now — Layer 1 + 2 + 3

**Layer 1 — Base (done, needs wiring)**
- `cas_add`, `cas_get`, `cas_list` implemented in `fs/cas/mcp/module.f.ts`
- `fjs cas mcp` CLI subcommand to launch the stdio server (tracked: `66E-fjs-cas-mcp-subcommand`)
- Refactor to extract `casMcpStep` for transport-agnostic shape

**Layer 2 — Content encoding**
- Switch `cas_add` / `cas_get` content encoding from cBase32 to base64 (MCP-idiomatic for binary)
- Hashes stay as cBase32
- Blocked on `66E-base64` (base64 implementation); tracked: `66E-cas-mcp-base64-content`

**Layer 3 — Type detection**
- New tool: `cas_type(hash) → MIME type`
- On-demand only (lazy) — no cache required for working version
- Detection via magic bytes: PNG, JPEG, GIF, WebP → then UTF-8 validity check → fallback `application/octet-stream`
- Pure detection logic in new file `fs/mime/module.f.ts`
- `cas_get` returns `EmbeddedResource` with `mimeType` when type is known
- Tracked: `66E-cas-mcp-file-type`

### Next — Layer 4 (signing)

- MCP server holds a private key at startup (loaded from config/env)
- New tools: `cas_public_key()`, `cas_verify(hash, signature, pubkey)`
- Auto-sign on `cas_add`: signature block `{ content_hash, signature, signer_pubkey }` stored in CAS as its own block
- Return the signature block hash alongside the content hash on add

### Later — Layer 5 (trusted timestamps)

- New tool: `cas_timestamp(hash)` — calls external RFC 3161 TSA
- Timestamp token stored in CAS as its own block; tool returns its hash
- Server config specifies which TSA URL(s) to use

### Future — Layer 6 (revisions)

- Git-like commit structures stored in CAS
- A commit block references parent commit hash(es) + content hash + metadata
- Tools: `cas_commit`, `cas_log`, `cas_diff`

### Future — HTTP transport

- `httpTransport` wraps the same `casMcpStep` over HTTPS
- Auth, TLS, session management handled at transport layer only
- Handlers and protocol logic unchanged

### Future — Content-addressable FunctionalScript

A canonical serialization of FunctionalScript values where structural equality implies hash equality:
two objects with the same shape and values always produce the same CAS hash.

This turns FunctionalScript itself into a content-addressable language:
- Functions, modules, and data structures are addressed by hash
- Identical sub-expressions are deduplicated automatically (structural sharing)
- Immutable by definition — same hash always means same value
- Enables a global, conflict-free object graph across devices and users
- Natural foundation for a distributed module system and memoization cache

Inspired by Unison's hash-addressed codebase model, applied to FunctionalScript's purely functional subset of JavaScript.

Implementation home: `nanvm-lib` (Rust).

---

## Key design rules

1. CAS stores only content that cannot be recomputed without a secret (signatures, timestamps) or original user/AI content. Never cached derivations.
2. Transport is a wrapper around the pure step function — swappable without touching handlers.
3. All content crosses the MCP wire as base64; hashes as cBase32.
4. Type detection is always lazy (on-demand tool call); caching is a later optimization.
5. Working version first, then cache, then performance.
