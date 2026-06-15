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
- `cas_add`, `cas_get`, `cas_list` implemented in `fs/cas/mcp/module.f.ts` ✓
- stdio transport implemented in `fs/mcp/stdio/module.f.ts` ✓
- `fjs cas mcp` CLI subcommand registered in `fs/cas/module.f.ts` ✓
- Remaining: refactor to extract `casMcpStep` for transport-agnostic shape

**Layer 2 — Content encoding**
- Switch `cas_add` / `cas_get` content from cBase32 to base64 (MCP-idiomatic for binary)
- Hashes stay as cBase32
- `fs/base64/module.f.ts` (`encode`/`decode`) already implemented ✓; only MCP wiring remains
- Tracked: [i66E-cas-mcp-base64-content](../66E-cas-mcp-base64-content.md)

**Layer 3 — Type detection**
- New tool: `cas_type(hash) → MIME type`, on-demand only
- Detection via magic bytes: PNG, JPEG, GIF, WebP, PDF, ZIP → UTF-8 check → `application/octet-stream`
- Pure logic in new file `fs/mime/module.f.ts`
- `cas_get` returns `EmbeddedResource` with `mimeType` when type is known
- Tracked: [i66E-cas-mcp-file-type](../66E-cas-mcp-file-type.md)

---

## Next — Layer 4 (signing)

ECDSA signing (RFC 6979 deterministic nonces) already implemented in `fs/crypto/sign/`, `fs/crypto/secp/`, `fs/crypto/sha2/` ✓. ECDSA **verification** is not yet implemented — that is part of this layer's work.

- Implement ECDSA verify in `fs/crypto/sign/`
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

HTTP effects already exist in `fs/effects/node/` (`CreateServer`, `Listen`, `Fetch`). Only the transport wrapper is missing.

- `httpTransport` wraps `casMcpStep` over HTTPS
- Auth, TLS, session management at transport layer only; handlers unchanged

---

## Future — Signed directories

See [architecture.md §Human-readable paths](./architecture.md).

- Directory DISOT block: maps names → hashes, public keys, or properties
- Path resolution: `~/Alice/Bob/plan.md` or `/secp256k1:<key>/Alice/Bob/plan.md`
- Every hop signed and verifiable

---

## Future — FunctionalScript compiler via fs/bnf

**Current state:**
- `fs/bnf/` — combinator framework exists; no FunctionalScript grammar written yet
- `fs/djs/` — full data pipeline (tokenizer → parser → AST → evaluator) for `const`, `import`, objects, arrays; **functions not yet supported**
- `nanvm-lib` (Rust) — type system implemented (primitives, arrays, objects, bigints); **no bytecode ISA, no emitter, no execution loop**

**Remaining work:**
1. Function support in `fs/djs/`
2. FunctionalScript grammar in `fs/bnf/` (single source for parser + generated language spec)
3. Bytecode instruction set in `nanvm-lib`
4. Bytecode emitter (compiler backend)
5. VM execution loop in `nanvm-lib`

This is the longest dependency chain. Everything after it depends on it.

---

## Future — Content-addressable FunctionalScript

Prerequisite: VM complete in `nanvm-lib`.

Canonical serialization where structural equality implies hash equality — same shape, same hash. Implemented in `nanvm-lib` (Rust). SUL's bijective tree structure is the natural fit; see [architecture.md §SUL](./architecture.md).

---

## Future — Sandboxed code execution via MCP

Prerequisite: compiler + CA FunctionalScript complete.

- FunctionalScript modules stored in DISOT by content hash
- New tool: `cas_run(hash, input?)` — loads bytecode, executes on nanvm with hard memory/time limits
- Pure functions only; no side effects escape the sandbox

---

## Implementation status

| Layer | What exists | What's missing |
|---|---|---|
| 1. Base MCP (add/get/list) | `fs/cas/mcp/`, `fs/mcp/stdio/`, CLI ✓ | `casMcpStep` extraction |
| 2. Content encoding (base64) | `fs/base64/` ✓ | MCP wiring only |
| 3. Type detection | — | `fs/mime/` magic-byte detection (PNG/JPEG/GIF/WebP/PDF/ZIP/text), MCP tool |
| 4. Signatures | `fs/crypto/sign/` (sign only), `fs/crypto/secp/` ✓ | ECDSA verify + MCP wiring |
| 5. Trusted timestamps | — | RFC 3161 client + MCP tool |
| 6. Revision layer | — | Design + implementation |
| HTTP transport | `fs/effects/node/` effects ✓ | `httpTransport` wrapper only |
| Signed directories | — | Directory block type + path resolver |
| SUL deduplication | `fs/sul/` L1–L4 ✓ | CAS integration layer |
| Compiler (parsing) | `fs/djs/` data pipeline ✓, `fs/bnf/` framework ✓ | Function support, FS grammar |
| Compiler (codegen) | — | Bytecode ISA, emitter, VM loop in `nanvm-lib` |
| CA FunctionalScript | — | Depends on VM + SUL integration |
| Sandboxed execution | — | Depends on CA FS |
| Hybrid intelligence | — | Depends on all above |
