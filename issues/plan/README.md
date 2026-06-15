# Project Goals & Plan

## Vision

A layered, universal **DISOT** (Decentralized Immutable Source of Truth) platform accessible via MCP.

DISOT is a content-addressable store (CAS) that holds only original, non-recomputable content, keyed by content hash. It is distinct from a cache CAS, which may also be CAS-backed but holds derived or computed data.

The MCP server runs locally over stdio first, with HTTP/HTTPS added later via clean transport abstraction.

### Why DISOT as foundation

DISOT blocks are globally addressed by content hash. Synchronization between any two DISOT stores is always conflict-free: same hash = same content, so merging is a pure set union — no reconciliation, no conflict resolution, no ordering required.

This property is the foundation for:
- **Multi-device** — sync any two stores, online or offline, always consistent
- **Multi-user** — multiple agents (human or AI) write independently, merge freely
- **Web of trust** — signatures and timestamps are themselves DISOT blocks, so trust chains are verifiable content, not metadata; each participant assigns relative trust levels to signers in their circle
- **Scalability** — stores can be sharded, replicated, or federated without coordination

### DISOT vs cache

| | DISOT | Cache |
|---|---|---|
| Content | Original, signed, timestamped | Derived, computed |
| Recomputable? | No (requires secret or external act) | Yes |
| Trust | Inherent — hash is proof | None without signature |
| Sync | Conflict-free by definition | Rebuild on demand |

The cache may internally use CAS for storage, but it is not DISOT.

---

## Layers

```
┌──────────────────────────────────────────────────┐
│  6. Revision layer (Git-like commits in DISOT)    │
├──────────────────────────────────────────────────┤
│  5. Trusted timestamps (RFC 3161 → DISOT)         │
├──────────────────────────────────────────────────┤
│  4. Digital signatures (server key → DISOT)       │
├──────────────────────────────────────────────────┤
│  3. Type detection (magic bytes → cache only)     │
├──────────────────────────────────────────────────┤
│  2. Content encoding (base64 for MCP)             │
├──────────────────────────────────────────────────┤
│  1. Base: cas_add / cas_get / cas_list            │
└──────────────────────────────────────────────────┘
```

**Rule:** Only original content goes in DISOT. Recomputable derived data (type, metadata, computation results) stays in the cache. Non-recomputable original data (signatures, timestamps) goes in DISOT.

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

The HTTP effect infrastructure (`CreateServer`, `Listen`, `Fetch`) already exists in
`fs/effects/node/module.f.ts` — the transport wrapper is the only missing piece.

---

## Priorities

### Now — Layer 1 + 2 + 3

**Layer 1 — Base (done, needs wiring)**
- `cas_add`, `cas_get`, `cas_list` implemented in `fs/cas/mcp/module.f.ts` ✓
- stdio transport implemented in `fs/mcp/stdio/module.f.ts` ✓
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

Crypto primitives are **already implemented**: ECDSA with RFC 6979 deterministic nonces in
`fs/crypto/sign/`, `fs/crypto/secp/`, `fs/crypto/sha2/`. Work is MCP wiring only.

- MCP server holds a private key at startup (loaded from config/env)
- New tools: `cas_public_key()`, `cas_verify(hash, signature, pubkey)`
- Auto-sign on `cas_add`: signature block `{ content_hash, signature, signer_pubkey }` stored in DISOT as its own block
- Return the signature block hash alongside the content hash on add

### Later — Layer 5 (trusted timestamps)

- New tool: `cas_timestamp(hash)` — calls external RFC 3161 TSA
- Timestamp token stored in DISOT as its own block; tool returns its hash
- Server config specifies which TSA URL(s) to use

### Future — Layer 6 (revisions)

- Git-like commit structures stored in DISOT
- A commit block references parent commit hash(es) + content hash + metadata
- Tools: `cas_commit`, `cas_log`, `cas_diff`

### Future — HTTP transport

HTTP effect infrastructure already exists in `fs/effects/node/` (`CreateServer`, `Listen`, `Fetch`).
Work is writing `httpTransport` to wrap `casMcpStep` — no new effects needed.

- Auth, TLS, session management handled at transport layer only
- Handlers and protocol logic unchanged

### Future — FunctionalScript compiler via fs/bnf

**Current state:**
- `fs/bnf/` — BNF combinator framework exists (terminal ranges, LL(1) dispatch rules); no FunctionalScript grammar written yet
- `fs/djs/` — Full tokenizer → parser → AST → evaluator pipeline working for data (`const`, `import`, objects, arrays, primitives); **functions not yet supported**
- `nanvm-lib` (Rust) — Type system implemented (primitives, arrays, objects, bigints, strings); **no bytecode instruction set, no emitter, no execution loop**

**Remaining work:**
1. Function support in `fs/djs/` parser and AST
2. FunctionalScript grammar in `fs/bnf/` (drives both parser and generated language spec)
3. Bytecode instruction set in `nanvm-lib`
4. Bytecode emitter (compiler backend)
5. VM execution loop in `nanvm-lib`

This is the longest dependency chain in the roadmap. Everything after it (sandboxed execution, CA FunctionalScript) depends on it.

### Future — Content-addressable FunctionalScript

Prerequisite: VM implementation in `nanvm-lib` complete.

A canonical serialization of FunctionalScript values where structural equality implies hash equality:
two objects with the same shape and values always produce the same hash.

This turns FunctionalScript itself into a content-addressable language:
- Functions, modules, and data structures are addressed by hash
- Identical sub-expressions are deduplicated automatically (structural sharing)
- Immutable by definition — same hash always means same value
- Enables a global, conflict-free object graph across devices and users
- Natural foundation for a distributed module system and memoization cache

Inspired by Unison's hash-addressed codebase model, applied to FunctionalScript's purely functional subset of JavaScript.

Implementation home: `nanvm-lib` (Rust).

### Future — Sandboxed code execution via MCP

Prerequisite: compiler + CA FunctionalScript complete.

- FunctionalScript modules are stored in DISOT (addressed by content hash)
- New MCP tool: `cas_run(hash, input?)` — loads bytecode from DISOT and executes it on nanvm
- Execution is sandboxed: hard limits on memory and CPU time
- Pure functions only — no side effects escape the sandbox
- Enables AI agents to write, store, and invoke FunctionalScript code through the same MCP interface used for storage

This makes the MCP server a compute platform: store code in DISOT, run it by hash.

**The full loop:** AI writes FunctionalScript code that references existing DISOT blocks by hash as its inputs. Execution is deterministic — same code + same input hashes always produce the same output. The output is cached (cache may itself be CAS-backed) but is not DISOT. To share a result with others, the author must sign and timestamp it: an unsigned block claiming to represent a computation cannot be trusted by anyone outside the author's own process.

Because the computation is deterministic, any user can independently re-run it and sign the same result block if they agree. A result block that accumulates signatures from many independent, trusted signers becomes progressively more trustworthy — without any central authority. Trust is mediated by a web of trust where each participant assigns relative trust levels to signers in their circle.

### Future — Signed directories and human-readable paths

A directory is a DISOT block that maps names to values — where a value can be:
- A hash of another DISOT block (a file or subdirectory)
- A public key
- A phone number or other contact property

When signed by a user, the directory becomes their personal namespace: a human-readable layer over global content addresses. Directories are themselves immutable DISOT blocks, so any update produces a new block (and a new hash) — history is preserved automatically.

**Path resolution:** Paths traverse chains of signed directories across user boundaries:

```
~/Alice/Bob/Charlie/plan.md
```

- `~` — your own root directory (signed by you)
- `Alice` — an entry in your directory, resolving to Alice's directory hash
- `Bob` — an entry in Alice's directory, resolving to Bob's directory hash
- `Charlie` — an entry in Bob's directory, resolving to Charlie's directory hash
- `plan.md` — an entry in Charlie's directory, resolving to a content hash

Every hop is verifiable: each directory is a signed DISOT block, so you know exactly who vouched for each name-to-hash mapping. Trust propagates through the path — reaching `plan.md` requires trusting the full chain `~ → Alice → Bob → Charlie`.

This gives the network human-readable, trust-anchored addressing without a central DNS or registry. Names are only meaningful relative to a starting trust anchor (`~`), which is always the user's own signed root.

### Future — SUL-based deduplication for large BLOBs

`fs/sul/` implements **SUL** (Synthetic Universal Language): a bijective encoding that maps any finite bit sequence to a single 256-bit root ID via a balanced binary tree. Identical content always produces the same ID; common sub-sequences automatically share tree nodes.

Current state: literal levels (L1–L3) and hash levels (L4+, SHA-2 based) are implemented. The `Id` type encodes three cases: L3 literal (≤254 bits inline), raw bit vector, or hash identifier.

**Connection to DISOT:**
- SUL IDs are content addresses by construction — same content, same ID, globally
- Large BLOBs stored in DISOT via SUL get automatic structural deduplication: shared sub-sequences across different BLOBs are stored once
- The 256-bit fixed-size ID integrates naturally with the existing CAS hash scheme

**Connection to CA FunctionalScript:**
- SUL's bijective tree structure is a natural fit for content-addressing FunctionalScript ASTs — structurally equal sub-expressions collapse to the same ID without any separate canonicalization step

Work needed: integration layer between `fs/sul/` and `fs/cas/`, defining how SUL IDs map to CAS block addresses for large-BLOB storage.

### Future — Hybrid intelligence network

Each trusted node in the web of trust is a combination of AI and humans — not purely one or the other. Nodes communicate, verify each other's work, and build trust relationships over time.

Because DISOT is the storage layer, the network can persist:
- Conversations between humans and AI
- Reasoning trajectories (the chain of thought, not just the conclusion)
- Computation results with their full provenance (code hash + input hashes + signatures)

This makes the network itself a form of hybrid intelligence: knowledge and reasoning accumulate in DISOT, are signed by their authors, verified by peers, and become progressively more trusted as signatures accumulate. No single node holds the intelligence — it emerges from the signed, timestamped, conflict-free graph of content stored across all nodes.

The web of trust is not just an access-control mechanism — it is the trust topology of the intelligence itself.

### Long-term societal impact

A sufficiently mature DISOT + web of trust network can effectively replace most modern centralized services:

- **Communications** — messages are signed DISOT blocks; delivery is routing between trusted nodes, not through a central server
- **Email & messaging** — same model: content-addressed, signed, delivered peer-to-peer within trust circles
- **Social networks** — the social graph is the web of trust itself; content is DISOT blocks signed by authors; no platform owns the graph
- **Advertising** — trusted advertisement using relative ratings within trust circles; content surfaces based on vouching from people you trust, not opaque algorithmic targeting by a platform
- **Finance** — a financial system without Proof of Work; trust-based consensus via the web of trust replaces energy-intensive mining; value and credit flow through trust relationships, not a global PoW race. Theft is structurally hard: currency only has meaning between trusted parties, so stolen currency can only be spent with people who trust the thief — and once identified as a thief, those trust relationships are revoked, leaving the stolen currency worthless. The attack surface is limited to the thief's own trust circle, which contains their real identity.
- **Identity** — public keys are identity; trust is earned through signatures and vouching, not granted by a central authority

The common thread: every centralized service today exists because it solves a trust problem (who do I trust to deliver this message? who do I trust to vouch for this identity?) that a sufficiently rich web of trust solves without a center. DISOT provides the immutable, conflict-free substrate; signatures and timestamps provide the provenance; the web of trust provides the social layer.

This is not a near-term goal — it is the horizon the architecture points toward.

---

## Implementation status summary

| Layer | What exists | What's missing |
|---|---|---|
| 1. Base MCP (add/get/list) | `fs/cas/mcp/`, `fs/mcp/stdio/` ✓ | CLI subcommand, `casMcpStep` extraction |
| 2. Content encoding (base64) | — | `fs/base64/` impl, then MCP wiring |
| 3. Type detection | — | `fs/mime/` magic-byte detection, MCP tool |
| 4. Signatures | `fs/crypto/sign/`, `fs/crypto/secp/` ✓ | MCP wiring only |
| 5. Trusted timestamps | — | RFC 3161 client + MCP tool |
| 6. Revision layer | — | Design + implementation |
| HTTP transport | `fs/effects/node/` effects ✓ | `httpTransport` wrapper only |
| Compiler (parsing) | `fs/djs/` data pipeline ✓, `fs/bnf/` framework ✓ | Function support, FS grammar |
| Compiler (codegen) | — | Bytecode ISA, emitter, VM loop in `nanvm-lib` |
| SUL deduplication | `fs/sul/` L1–L4 implemented ✓ | CAS integration layer |
| CA FunctionalScript | — | Depends on VM + SUL integration |
| Sandboxed execution | — | Depends on CA FS |
| Hybrid intelligence | — | Depends on all above |

---

## Key design rules

1. **DISOT holds only originals.** Content that cannot be recomputed without a secret (signatures, timestamps) or original user/AI content. Never cached derivations.
2. **Cache is not DISOT.** Computation results, type detection, and other derived data live in the cache. Cache may be CAS-backed but carries no inherent trust.
3. **Trust requires signatures.** A block shared outside its author's process must be signed and timestamped to be trusted. Multiple independent signatures on the same block accumulate trust.
4. Transport is a wrapper around the pure step function — swappable without touching handlers.
5. All content crosses the MCP wire as base64; hashes as cBase32.
6. Type detection is always lazy (on-demand tool call); caching is a later optimization.
7. Working version first, then cache, then performance.
