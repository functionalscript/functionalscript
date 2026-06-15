# Architecture

## DISOT vs cache vs CAS

**CAS** (Content-Addressable Storage) is the generic mechanism: any content, keyed by its hash. It makes no claims about what is stored or why.

**DISOT** (Decentralized Immutable Source of Truth) is a specific use of CAS: it holds signed content — user-authored blocks, signature blocks, trusted timestamps, license blocks, trust blocks. The social contract of DISOT is that its content is vouched for by identifiable authors. DISOT is CAS with a trust layer on top.

**Cache** is a broader concept — derived or computed content that can be discarded and rebuilt. CAS can be used as a cache backend, but cache can also use other mechanisms, such as vector embeddings for semantic search and indexing. The defining property of cache is not its storage mechanism but that its content carries no authorship guarantee.

| | CAS | DISOT | Cache |
|---|---|---|---|
| What's stored | Anything | Signed/trusted content | Derived/computed content |
| Authorship | Not required | Required | Not applicable |
| Recomputable? | N/A | No | Yes |
| Trust | None inherent | From signatures | None |
| Storage mechanism | Hash → content | Hash → content (via CAS) | CAS, vector DB, or other |

DISOT is built on CAS. Cache is independent of the storage mechanism.

## Protocol independence

CAS synchronization requires no specific protocol. Blocks can be exchanged over HTTP, P2P, Bluetooth, USB, physical media (sneakernet), or any other channel — because authenticity is proven cryptographically, not by the delivery mechanism. If a block's hash matches its content and its signature verifies against a trusted public key, it is authentic regardless of how it arrived.

This means the network is resilient by construction: no single protocol to block, no single infrastructure to take down. Two nodes can sync by emailing each other a file, and the result is just as trustworthy as a direct HTTPS transfer.

This also makes it censorship-resistant. In countries where the internet is controlled or filtered, content can travel via USB drives, offline sync, Bluetooth, or any other side channel — and recipients can still cryptographically verify that it is authentic and unmodified. Firewalls can block protocols; they cannot invalidate a signature.

## Transport abstraction

The MCP dispatcher (`mcpStep`) is transport-agnostic — it produces a pure `Step<O>` function. Transport wrappers are separate and interchangeable.

```
casMcpStep(c)(stateKey)(value)   ← pure, no transport  [planned]
    ↓
stdioTransport(step)             ← local, current
httpTransport(step, port)        ← remote, future
```

Planned refactor: extract `casMcpStep` from `casMcpServer` in `fs/cas/mcp/module.f.ts`. Currently `casMcpServer` wires stdio directly; once extracted, the stdio server becomes a one-liner and the HTTP server is additive, not a rewrite.

The HTTP effect infrastructure (`CreateServer`, `Listen`, `Fetch`) already exists in `fs/effects/node/module.f.ts` — only the transport wrapper is missing.

## Content encoding

**Current:** content crosses the MCP wire as **cBase32** (same encoding as hashes).
**Target (Layer 2):** switch content to **base64** (MCP-idiomatic for binary data); hashes stay as cBase32. The base64 codec (`fs/base64/module.f.ts`) is already implemented — only the MCP wiring remains.

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
