# Architecture

## DISOT vs cache

DISOT (Decentralized Immutable Source of Truth) holds only content that is original and non-recomputable. A cache CAS may also use content-addressing internally, but it holds derived or computed data and carries no inherent trust.

| | DISOT | Cache |
|---|---|---|
| Content | Original, signed, timestamped | Derived, computed |
| Recomputable? | No (requires secret or external act) | Yes |
| Trust | Inherent — hash is proof | None without signature |
| Sync | Conflict-free by definition | Rebuild on demand |

**Rule:** Only original content goes in DISOT. Recomputable derived data (type detection, computation results, metadata) stays in the cache. Non-recomputable original data (signatures, timestamps, user content) goes in DISOT.

## Transport abstraction

The MCP dispatcher (`mcpStep`) is transport-agnostic — it produces a pure `Step<O>` function. Transport wrappers are separate and interchangeable.

```
casMcpStep(c)(stateKey)(value)   ← pure, no transport
    ↓
stdioTransport(step)             ← local, current
httpTransport(step, port)        ← remote, future
```

Concretely: `casMcpStep` is extracted from `casMcpServer` in `fs/cas/mcp/module.f.ts` so the stdio server is a one-liner and the HTTP server is additive, not a rewrite.

The HTTP effect infrastructure (`CreateServer`, `Listen`, `Fetch`) already exists in `fs/effects/node/module.f.ts` — only the transport wrapper is missing.

## Content encoding

All content crosses the MCP wire as **base64** (MCP-idiomatic for binary data).
Hashes are encoded as **cBase32**.

## Addressing

### Global addresses

Content is addressed globally by hash. There is no registry or central authority.

### Human-readable paths

A directory is a DISOT block mapping names to values (content hashes, public keys, contact properties). When signed by a user it becomes their personal namespace.

Paths traverse chains of signed directories across user boundaries:

```
~/Alice/Bob/Charlie/plan.md
/secp256k1:hsiebduw..../Alice/Bob/Charlie/plan.md
```

Global paths start with a public key in `/<curve>:<key>/` form — addressable by anyone who knows the key. `~` is syntactic sugar for the current user's own public key. Both forms resolve identically.

Every hop is verifiable: each directory is a signed DISOT block, so you know exactly who vouched for each name-to-hash mapping. Names are only meaningful relative to a trust anchor (`~` or a known public key) — there is no global namespace to control or squat.

## SUL — structural deduplication

`fs/sul/` implements **SUL** (Synthetic Universal Language): a bijective encoding that maps any finite bit sequence to a single 256-bit root ID via a balanced binary tree. Identical content always produces the same ID; common sub-sequences automatically share tree nodes.

- **For large BLOBs in DISOT** — structural deduplication without a separate index; shared sub-sequences across different BLOBs are stored once
- **For CA FunctionalScript** — SUL's bijective tree structure naturally content-addresses ASTs; structurally equal sub-expressions collapse to the same ID without a separate canonicalization step

Current state: literal levels (L1–L3) and hash levels (L4+, SHA-2 based) are implemented.

## Key design rules

1. **DISOT holds only originals.** Content that cannot be recomputed without a secret (signatures, timestamps) or original user/AI content. Never cached derivations.
2. **Cache is not DISOT.** Computation results, type detection, and other derived data live in the cache. Cache may be CAS-backed but carries no inherent trust.
3. **Trust requires signatures.** A block shared outside its author's process must be signed and timestamped to be trusted. Multiple independent signatures on the same block accumulate trust.
4. **Transport is a wrapper.** The pure step function is swappable between stdio and HTTP without touching handlers or protocol logic.
5. **Working version first.** No cache, no optimization until the base layer is solid.
