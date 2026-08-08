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
into a tree of `<=maxLengthBytes` data-leaf and reference nodes, with a
`_roots/` / `_parts/` / `_hashes/` directory split, mark-and-sweep GC guarded
by a write/GC lock, and (optionally) SUL-based content-defined chunk
boundaries for real deduplication. The full design — node encoding,
write/read pipelines, the boundary-shift problem, GC locking, and the cached
multi-hash maps — is written up in that document; this issue tracks turning
it into code.

**API cutover needed first.** The design doc predates the current `Cas<O>`
API: it describes reusing a whole-blob `write(Vec) => hash` / `read(hash) =>
Vec` small-object primitive and `fileKvStore.list`-based directory
filtering, but `fjs/cas/module.f.ts` today has neither — `Cas<O>.read` /
`.write` are streaming-only (`List<O, IoResult<Vec>>`), `fileKvStore` is
gone, and `write` always publishes to the single hash-derived shard path
with no `_parts/` layout. Implementing this design against current code
therefore starts with defining the small-object (`<=maxLengthBytes`, single
CAS object) read/write primitives and the `_roots/`/`_parts/`/`_hashes/`
storage layer the tree nodes need — the doc's `write`/`read`/`fileKvStore`
references describe the *shape* of that primitive, not code that exists
today.

### Tasks

- [ ] Define small-object read/write primitives and the `_roots/`/`_parts/`/
      `_hashes/` storage layer against the current streaming `Cas<O>` API
      (there is no whole-blob `write`/`read` or `fileKvStore` to reuse).
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
- [ ] Decide fixed-size vs. SUL content-defined chunk boundaries. **SUL needs
      a byte-alignment design before it's usable here, not just a yes/no
      call**: `fjs/sul/module.f.ts`'s `Encode` consumes one *bit* at a time
      and its `push` returns only the next `EncodeState` — no word-boundary
      event is exposed (only the internal `literalStep` sees the completed-word
      signal, and `push` discards it) — while Strategy 3 leaves store whole
      bytes with no field for a trailing partial-byte length. Using SUL as the
      boundary algorithm therefore requires either exposing a boundary event
      from `push` plus a canonical byte-alignment rule (e.g. round up to the
      next byte and record how, deterministically, so re-encoding the same
      content reproduces the same split points), or extending the leaf
      encoding to carry a partial-byte length. Fixed-size chunking has no such
      gap and remains the safe fallback if this isn't resolved first.
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
