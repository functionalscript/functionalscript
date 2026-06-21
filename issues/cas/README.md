# CAS File Strategies

Three strategies for storing files of arbitrary size in a content-addressable store,
each with different trade-offs between memory use, streaming, atomicity, and
deduplication.

- [Strategy 1: Staging + Rename](strategy-1.md) — stream data through a staging file;
  rename to the final hash-addressed path on commit. Constant memory, safe for
  arbitrarily large files on a real filesystem. The staging mechanism is described by two
  alternatives:
  - [Staging file behavior](staging.md) — the original OS-lock (`flock` / open-handle)
    dead-man's switch.
  - [Lock-free staging via deadline leases](staging-lease.md) — **the chosen design.** A
    deadline encoded in the staging file name replaces the lock. It is lock-free,
    platform-symmetric, survives reboots, works across machines, and fails safe (worst case
    is a restarted upload, never a corrupted shard). See that doc's comparison table for why
    it wins over the lock-based approach.

- [Strategy 2: Array of Bit Vectors](strategy-2.md) — read and write the whole file
  as a `readonly Vec[]`; retire `readBytes`. Hash is known before the write, so no
  staging is needed. Bounded by available memory.

- [Strategy 3: Merkle Tree](strategy-3.md) — decompose any file into a tree of
  ≤128 KiB objects, each stored through the existing small-file primitive. Enables
  streaming, cheap metadata, random access, and content-defined deduplication via
  SUL. Requires garbage collection (`_roots/` + `_parts/` directory split) and uses
  cached multi-hash maps (SHA-256 / SHA3-512 → Strategy 3 Merkle root) for external addressing.

## Recommended progression: 1 → 3

Strategies 1 and 3 compose naturally; Strategy 2 is an alternative in-memory path
(useful for the virtual store in tests) rather than a stepping stone.

### `readFile` / `writeFile` stay small-only — by design

In the 1→3 path, `readFile` / `writeFile` are **not** stretched to handle large
files. They remain the ≤128 KiB small-object primitive, and that boundary is
intentional: every Merkle node in Strategy 3's `parts/` is stored and retrieved
through exactly these functions. They are not legacy — they are the foundation the
tree is built on.

The layering is explicit:

| Concern | Mechanism |
|---|---|
| Small objects (≤128 KiB) | `readFile` / `writeFile` — stable, bounded, honest |
| Streaming large-file reads | `readBytes` — kept, not retired |
| Streaming large-file writes | Strategy 1: `openWrite / append / commit / abort` |
| Arbitrary-size files as CAS objects | Strategy 3: Merkle tree over `readFile`/`writeFile` nodes |

Calling `readFile` on a large CAS blob is a clear error that steers the caller
toward the tree API — not a silent truncation or a crash. The 128 KiB limit is a
documented, enforced contract rather than an implementation accident.

This also explains why Strategy 2's proposal to change `readFile` / `writeFile` to
`readonly Vec[]` and retire `readBytes` is the wrong direction for the 1→3 path: it
stretches two primitives upward where Strategies 1 and 3 instead add the right
abstractions *above* a stable foundation.
