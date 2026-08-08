## strategy-3-merkle-tree. Implement Merkle-tree decomposition for large files

**Priority:** P3
**Status:** open

### Problem

`fjs/cas/module.f.ts` currently implements only Strategy 1 (stream through a
staging file, rename to the hash-addressed path on commit): `write` streams
an arbitrarily large input into **one** shard via the lock-free lease
protocol, and `read` streams that one shard back in `<=128 KiB` chunks. There
is no decomposition into a tree of small (`<=128 KiB`) objects, so none of
the properties that require one — cheap `Meta.size` without a full read,
random access by offset, chunk-level deduplication, and structural sharing
across edits — are available. Every read/write of a large file still touches
the whole shard.

### Proposal

Implement Strategy 3 as designed in
[`fjs/cas/plan/strategy-3.md`](../plan/strategy-3.md): decompose any file
into a tree of `<=maxLengthBytes` data-leaf and reference nodes stored
through the existing small-object primitives, with a `_roots/` / `_parts/` /
`_hashes/` directory split, mark-and-sweep GC guarded by a write/GC lock, and
(optionally) SUL-based content-defined chunk boundaries for real
deduplication. The full design — node encoding, write/read pipelines, the
boundary-shift problem, GC locking, and the cached multi-hash maps — is
written up in that document; this issue tracks turning it into code.

### Tasks

- [ ] Node encoding: one-byte type tag (`0x00` data leaf / `0x01` reference
      node), `(hash, size)` references, empty-file canonical root.
- [ ] Bottom-up streaming write: chunk input at `maxLengthBytes - 1`,
      accumulate reference nodes level by level.
- [ ] Depth-first streaming read yielding a flat byte stream.
- [ ] `Meta.size` from the root reference and offset-based random access.
- [ ] `_roots/` / `_parts/` / `_hashes/` directory layout; atomic no-clobber
      part writes (reuse Strategy 1's staging-and-rename).
- [ ] Mark-and-sweep GC with the required write/GC mutual-exclusion lock.
- [ ] Cached `_hashes/<algo>/<digest>` → Strategy 3 Merkle root maps
      (sha256, sha3-512), lazily validated on lookup.
- [ ] Decide fixed-size vs. SUL content-defined chunk boundaries (SUL is
      recommended for real cross-edit deduplication).
- [ ] Proof coverage: streaming write/read round-trip, dedup across shared
      subtrees, GC reclaiming orphaned parts, a write concurrent with GC.

### Related

- [`fjs/cas/plan/strategy-3.md`](../plan/strategy-3.md) — the full design
  this issue implements.
- [`fjs/cas/plan/README.md`](../plan/README.md) — strategy layering (1 → 3
  recommended progression).
- [`fjs/cas/plan/scrub.md`](../plan/scrub.md) — the committed-store integrity
  backstop this strategy still needs, independent of write path.
- `fjs/cas/module.f.ts` — current Strategy 1 implementation this builds on.
