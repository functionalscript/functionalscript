# Roadmap

## Layer stack

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

---

## Now — Layers 1 + 2 + 3

**Layer 1 — Base (done)**
- `cas_add`, `cas_get`, `cas_list` implemented in `fjs/mcp/cas/module.f.mjs` ✓
- stdio transport implemented in `fjs/protocol/mcp/stdio/module.f.mjs` ✓
- `fjs cas mcp` CLI subcommand registered in `fjs/cas/module.f.mjs` ✓
- Remaining: refactor to extract `casMcpStep` for transport-agnostic shape

**Layer 2 — Content encoding (done)**
- No more cBase32 for content — replaced by text/base64 (MCP-idiomatic for
  binary), wired in `fjs/mcp/cas/module.f.mjs` via `fjs/basen/base64/module.f.mjs`
  (`encode`/`decode`) ✓
- `cas_add`: caller declares the encoding via `type` (`'text'`, the default,
  or `'base64'`) — decoding follows what the caller says, not autodetection ✓
- `cas_get`: encoding is chosen by the server — a magic-byte hit or non-UTF-8
  fallback returns `type: 'base64'`; whole-blob-valid, all-text UTF-8 (no
  NUL/other control code points) returns `type: 'text'` ✓
- Hashes stay as cBase32 ✓

**Layer 3 — Type detection (done)**
- Detection via magic bytes: PNG, JPEG, GIF, WebP, PDF, ZIP → `null` for unrecognized bytes ✓
- Pure logic in `fjs/media/type/module.f.mjs` ✓
- `cas_get`: when type is detected → returns `EmbeddedResource` with `mimeType`; when `null` → falls back to existing `textContent` response for backward compatibility ✓
- `fjs/protocol/mcp/module.f.mjs` gained `blobResource` / `embeddedResource` schemas and a `contentItem` union ✓
- A separate on-demand `cas_type` tool is a possible extension; needs its own design issue before implementation

---

## Next — Layer 4 (signing)

ECDSA signing (RFC 6979 deterministic nonces) already implemented in `fjs/crypto/sign/`, `fjs/crypto/secp/`, `fjs/crypto/sha2/` ✓. ECDSA **verification** is not yet implemented — that is part of this layer's work.

- Implement ECDSA verify in `fjs/crypto/sign/`
- MCP server holds a private key at startup (from config/env)
- New tools: `cas_public_key()`, `cas_verify(hash, signature, pubkey)`
- Auto-sign on `cas_add`: signature block `{ content_hash, signature, signer_pubkey }` stored in DISOT
- Return signature block hash alongside content hash

---

## Later — Layer 5 (trusted timestamps)

- New tool: `cas_timestamp(hash)` — calls external RFC 3161 TSA
- Timestamp token stored in DISOT as its own block
- Server config specifies TSA URL(s)

---

## Future — Layer 6 (revisions)

- Git-like commit blocks in DISOT: parent hash(es) + content hash + metadata
- Tools: `cas_commit`, `cas_log`, `cas_diff`

---

## Future — HTTP transport

Plain HTTP effects already exist in `fjs/effects/node/` (`CreateServer`, `Listen`, `Fetch`) backed by `node:http`. The initial transport target is **HTTP** (not HTTPS — no certificate/key inputs or `https.createServer` support exist yet).

- `httpTransport` wraps `casMcpStep` over plain HTTP
- TLS/HTTPS support is separate work: requires HTTPS effects + certificate config
- Auth and session management at transport layer only; handlers unchanged

---

## Future — Signed directories

See [architecture.md §Human-readable paths](./architecture.md).

- Directory DISOT block: maps names → hashes, public keys, or properties
- Path resolution: `~/Alice/Bob/plan.md` or `/secp256k1:<key>/Alice/Bob/plan.md`
- Every hop signed and verifiable

---

## Future — FunctionalScript compiler via fjs/bnf

**Current state:**
- `fjs/bnf/` — combinator framework exists; no FunctionalScript grammar written yet
- `fjs/djs/` — full data pipeline (tokenizer → parser → AST → evaluator) for `const`, `import`, objects, arrays; **functions not yet supported**
- `nanvm-lib` (Rust) — type system implemented (primitives, arrays, objects, bigints); **no interpreter, no execution loop**

**Remaining work:**
1. Function support in `fjs/djs/`
2. FunctionalScript grammar in `fjs/bnf/` (single source for parser + generated language spec)
3. Rust code generator (FJS) — compiles FJS modules into Rust code calling the `nanvm-lib` API;
   the MVP pipeline, the compiler-bootstrap vehicle, and the AOT backend
   (see [`nanvm-lib/todo/mvp-roadmap.md`](../../nanvm-lib/todo/mvp-roadmap.md))
4. `Function` constructor + interpreter in `nanvm-lib` — executes the EDAG as data
   (see [`spec/todo/serialization.md`](../../spec/todo/serialization.md));
   bytecode is an optional, VM-internal, performance-oriented representation
5. Generic `Any` serialization (CBOR) in `nanvm-lib` — covers code as data; needed for CAS/CAVM

**Repository source migration and compiler coverage:**

The repository source-language migration is independent of compiler feature
coverage. Its stage-1 issue is complete and deleted; the contract it left is
[`fjs/fsc/README.md`](../../fjs/fsc/README.md):

1. **Stage 1 is done.** It migrated authored `.f.ts` to `.f.mjs`
   dependency-first, moving types to JSDoc or to an authored `types.ts` beside
   the implementation. No authored implementation or proof `.f.ts` remains;
   `types.ts` (and an optional `private.ts`) is the only authored TypeScript in
   the tree. `.f.mjs` means FunctionalScript-intent JavaScript and may contain
   syntax the current compiler does not support.
2. The compiler may validate any `.f.mjs` module it already supports, and
   synthetic compiler fixtures may land earlier, but compiler readiness never
   decided whether a Stage-1 source or proof file migrated.
3. Stage 2 migrates compiler-supported dependency-closed groups from `.f.mjs` to
   `.f.js`. One thing gates the first rename now that stage 1 is done, and
   [`fjs-nanvm-integration.md`](../fjs-nanvm-integration.md) — which performs it
   — carries it as its only **Blocked by**:
   [authored `.f.js` package support](../../fjs/ci/todo/f-js-package-support.md),
   so that a standalone `.f.js` is directly type-checked, gets a `.d.ts`, is
   packed, and resolves for a clean consumer. That task is itself no longer
   blocked — its stage-1 precondition is met — so it can proceed now. The
   boundary the rename must respect is in
   [`fjs/fsc/README.md`](../../fjs/fsc/README.md).
4. An authored `.f.js` is the compiler-compatibility marker: the parser/compiler
   in the same repository revision must accept it. Unsupported modules remain
   `.f.mjs` until their compiler features land.

This lets TypeScript removal and compiler implementation proceed independently
without either one blocking unrelated progress. The authoritative extension
contract and detailed workflow are documented in
[`fjs/fsc/README.md`](../../fjs/fsc/README.md), and the Stage-2 compiler migration
is tracked in [`todo/fjs-nanvm-integration.md`](../fjs-nanvm-integration.md).

This is the longest dependency chain. Everything after it depends on it.

---

## Future — Content-addressable FunctionalScript

Prerequisite: VM complete in `nanvm-lib`.

Canonical serialization where structural equality implies hash equality — same shape, same hash. To be implemented in `nanvm-lib` (Rust); requires canonicalization of property order and a content-hashing layer, neither of which exists yet. The canonicalization scheme will be derived from the EDAG's own grammar — not SUL, which is designed for data of unknown structure and would impose the wrong tree shape onto a semantically structured EDAG.

---

## Future — Sandboxed code execution via MCP

Prerequisite: compiler + CA FunctionalScript complete.

- FunctionalScript modules stored in DISOT by content hash
- New tool: `cas_run(hash, input?)` — loads the serialized EDAG, executes on nanvm with hard memory/time limits
- Pure functions only; no side effects escape the sandbox

---

## Implementation status

| Layer | What exists | What's missing |
|---|---|---|
| 1. Base MCP (add/get/list) | `fjs/mcp/cas/`, `fjs/protocol/mcp/stdio/`, CLI ✓ | `casMcpStep` extraction |
| 2. Content encoding (base64) | `fjs/basen/base64/`, `fjs/mcp/cas/` wiring ✓ | — |
| 3. Type detection | `fjs/media/type/` magic-byte detection (PNG/JPEG/GIF/WebP/PDF/ZIP), `cas_get` wiring, `embeddedResource` schema ✓ | — |
| 4. Signatures | `fjs/crypto/sign/` (sign only), `fjs/crypto/secp/` ✓ | ECDSA verify + MCP wiring |
| 5. Trusted timestamps | — | RFC 3161 client + MCP tool |
| 6. Revision layer | — | Design + implementation |
| HTTP transport | `fjs/effects/node/` effects ✓ | `httpTransport` wrapper only |
| Signed directories | — | Directory block type + path resolver |
| SUL deduplication | `fjs/sul/` L1–L4 ✓ | CAS integration layer |
| Compiler (parsing) | `fjs/djs/` data pipeline ✓, `fjs/bnf/` framework ✓ | Function support, FS grammar |
| Compiler (codegen) | — | Rust code generator (FJS), `Function` constructor + interpreter in `nanvm-lib` |
| Compiler (repository coverage) | Stage-1 `.f.mjs` source migration complete and compiler-independent ✓ | Validate supported `.f.mjs` as coverage grows; then authored-`.f.js` package support, then rename supported groups `.f.mjs` → `.f.js` |
| CA FunctionalScript | — | Depends on VM + EDAG canonicalization |
| Sandboxed execution | — | Depends on CA FS |
| Hybrid intelligence | — | Depends on all above |
