# Strategy 3: Merkle Tree

## Overview

Every object written to CAS is a small file of at most `maxLengthBytes` (128 KiB).
A large file is not stored as one object but as a **tree** of such objects. Each
node is one of two kinds:

- **Data leaf** — raw bytes, up to `maxLengthBytes - 1` bytes (131,071 bytes) of file
  content. The one-byte type tag is included within `maxLengthBytes`, so the payload
  cap is one byte less than the primitive's limit.
- **Reference node** — an array of references to other nodes (leaves or further
  reference nodes).

The file's identity is the hash of its **root** node. A small file
(≤ `maxLengthBytes - 1` = 131,071 bytes) is the degenerate case: a single data leaf,
addressed by its own hash. Files of exactly `maxLengthBytes` or larger are always
split into at least two nodes. The address space is uniform — every file, large or
small, is named by one root hash.

## Why every object stays small

Because no node ever exceeds 128 KiB, every node fits in a single `Vec` and is
stored through the **existing** small-file primitive — `write(Vec) => hash` and
`read(hash) => Vec` — with no change. At the **logical layer**, this strategy needs
no streaming handle, no windowed `readBytes`, and no new effects: it builds
arbitrarily large files entirely out of the small-file CAS that already exists. The
"large file problem" dissolves into "many small files plus a tree".

On a real filesystem, individual `_parts/` writes must still be atomic and
no-clobber — the existing `fileKvStore.write` (which truncates in place) is not
compliant. Strategy 1's staging-and-rename is one compliant path; a new `O_EXCL`
create-or-skip effect would be another. See "Writing `_parts/` directly" for
details.

## Node encoding

Leaf and reference nodes must be distinguishable, and that distinction must be
bound into the hash (so a node's kind cannot be reinterpreted). A one-byte type tag
prefixes the object:

- `0x00` + raw bytes → data leaf.
- `0x01` + a sequence of references → reference node.

A **reference** is a `(hash, size)` pair: the child's hash plus the total byte size
of the subtree it roots. Carrying `size` in the reference (rather than only the
hash) is what enables cheap `Meta` and random access (below).

### Payload cap

Each stored node must fit within `maxLengthBytes` (131,072 bytes) **including the
one-byte type tag**. Therefore:

- Maximum data leaf payload: `maxLengthBytes - 1` = **131,071 bytes**.
- Maximum reference node payload: `maxLengthBytes - 1` bytes of `(hash, size)` entries.

The write pipeline must therefore chunk the input stream at `maxLengthBytes - 1` per
leaf, not at `maxLengthBytes`. Using a full 128 KiB (131,072 byte) chunk would produce
a 131,073-byte stored object, which cannot pass through `readFile`/`writeFile`.

## Fan-out

With a 256-bit (32-byte) hash plus a size field (e.g. 8 bytes = u64), each reference
is 40 bytes. A reference node can therefore carry up to
`⌊(maxLengthBytes - 1) / 40⌋ = 3,276` references per node. A two-level tree
addresses ≈ 3,276 × 131,071 bytes ≈ 429 MiB; three levels addresses ≈ 1.4 TiB —
trees stay shallow and the per-read node overhead is small.

## Write — bottom-up, streaming

The tree is built bottom-up while consuming the input in `maxLengthBytes - 1` chunks,
so peak memory is `O(depth × fan-out)`, not `O(file size)`:

1. Read the next ≤`maxLengthBytes - 1` input bytes, write it as a data leaf (with
   the `0x00` tag prepended), collect its `(hash, size)`.
2. Accumulate references at the current level. When enough fill a reference node (or
   input ends), write that node and promote its `(hash, size)` one level up.
3. Repeat until input is exhausted, then finalize each level. When a single
   reference remains, its hash is the root.

Every write in this pipeline is a small ≤`maxLengthBytes` CAS object. The
small-file write path is reused, but the backing **must** provide atomic, no-clobber
writes for `_parts/` — not a plain in-place overwrite. See the "Writing parts
directly" section for the full requirement. Strategy 1's staging-and-rename path
satisfies this; a naive `fileKvStore.write` (which truncates in place) does not.

## Read — depth-first, streaming

Reading walks the tree depth-first, left to right, yielding each data leaf's bytes
in order — a `ChunkStream` whose memory cost is the root-to-leaf path, `O(depth)`.
The consumer sees a flat byte stream and never observes the tree structure.

## Meta and random access

Because each reference carries its subtree `size`, the root reference node gives
`Meta.size` (the sum of its children's sizes) after reading **only the root** — no
full traversal. The same sizes make random access cheap: to reach byte offset `X`,
descend from the root choosing, at each level, the child whose cumulative size range
contains `X`. A single byte is reached in `O(depth)` node reads rather than scanning
the file.

## Deduplication and structural sharing

Identical content yields identical hashes, so any repeated chunk or repeated subtree
is stored once and shared across files. Editing or appending produces a new root
that **shares** every unchanged subtree, so a small change to a large file costs only
the nodes on the path from the changed leaf to the root — not a full rewrite. This is
the same property that makes Git and IPFS efficient.

How much sharing is actually achieved, however, depends entirely on **where chunk
boundaries fall**, and that is the weak point of the naive scheme.

### The boundary-shift problem

With **fixed-size** chunking (split every 128 KiB), boundaries are tied to absolute
byte offsets. Inserting or deleting even a single byte near the start of a file
shifts every subsequent boundary by that amount: every downstream chunk now spans
different bytes, gets a different hash, and is stored anew. Two files that differ by
one early edit share almost nothing. Fixed-size chunking deduplicates only *identical
runs that happen to stay aligned to the 128 KiB grid* — in practice, little.

For real deduplication the boundaries must follow the **content**, not the offset, so
that a local edit perturbs only local boundaries and the rest of the file re-uses its
existing chunks unchanged.

### Content-defined chunking via SUL

The project already has a content-defined construction: **SUL** (Synthetic Universal
Language, `fs/sul`). SUL bijectively maps a bit stream to a single 256-bit root `Id`
through a tree whose shape is determined by the data itself:

- Boundaries come from SUL's **word structure** (a strictly decreasing prefix
  followed by a terminator), which is a function of the symbols seen — not of
  absolute position. A local edit changes only the words it touches; surrounding
  words keep their boundaries.
- Beyond the literal levels, each symbol is a 256-bit content-addressed `Id`, and any
  two `Id`s merge via a SHA2-based `compress`. That **hash level is a content-addressed
  Merkle tree** whose shape and root are content-defined.
- Because the encoding is bijective and deterministic, identical content always
  produces the identical tree and root `Id` regardless of how the stream was fed in,
  which is exactly the invariant deduplication relies on.

SUL is the most efficient content-defined chunking available in the project so far. It
is recommended as the boundary algorithm for Strategy 3 when cross-file dedup is a
goal. Fixed-size chunking (splitting every `maxLengthBytes - 1` bytes) remains a
simpler fallback when dedup is not needed.

#### SUL boundary algorithm vs. SUL native tree encoding

SUL can contribute to Strategy 3 in two distinct ways, and it is important not to
conflate them:

**As a boundary algorithm only**: Use SUL's word structure to determine where to split
the input into chunks. Once chunk boundaries are identified, write each chunk as a data
leaf and build the tree using Strategy 3's own `(hash, size)` reference encoding.
This retains `Meta.size` and random access, but the stored tree is in Strategy 3's
format — not the native SUL hash-level format.

**As the native tree (pure SUL)**: Use the native SUL hash-level Merkle tree directly
as the stored structure. The root is the SUL root `Id`. However, the native SUL
hash-level merge callback (`compress(left, right) → merged`) stores only the merged
`Id` — it carries no `size` field per child. Consequently, a lookup by SUL root cannot
determine total byte length or choose the child containing an offset without a
separate size index or full traversal. `Meta.size` and random access require additional
bookkeeping beyond the native SUL encoding.

**Strategy 3 chooses option 1**: SUL provides the content-defined boundary algorithm;
the tree is stored in Strategy 3's own `(hash, size)` reference encoding. This is
required because `Meta.size` (size without full traversal) and random access
(descend by offset) are core Strategy 3 features — both depend on `size` being
present in every reference. The native SUL tree (option 2) would need an additional
size index and is not chosen for this design.

As a result, the canonical identity of a file in Strategy 3 is the **Strategy 3
Merkle root** — the hash of the root reference node in Strategy 3's encoding — not
the native SUL root `Id`. These are different values for the same content.

See [`fs/sul/README.md`](../../fs/sul/README.md) for the encoding and streaming API.

## Trade-offs

- **Cost: read/write amplification.** One logical file becomes many CAS objects, so
  reads issue more lookups (internal nodes + leaves) and writes create more objects
  (more inodes, more filesystem overhead) than a single flat file.
- **Cost: identity is the Merkle root, not `sha256(raw bytes)`.** A file's hash
  depends on the chunk size, fan-out, and node encoding, so two CAS instances must
  agree on these parameters to compute the same root. This is the same trade Git and
  IPFS make; it is not interoperable with a plain whole-file digest.
- **Benefit:** arbitrarily large files with constant-memory streaming, cheap size
  and random access, chunk-level deduplication, and structural sharing — all on top
  of the unchanged small-file CAS primitive.

## Directory structure

Strategy 3 splits the CAS directory into these subdirectories:

```
.cas/
  _roots/            ← externally known root hashes (GC roots)
  _parts/            ← all tree nodes: data leaves and reference nodes
  _hashes/
    sha256/<h>       ← maps whole-file SHA-256 → Strategy 3 Merkle root
    sha3-512/<h>     ← maps whole-file SHA3-512 → Strategy 3 Merkle root
```

The `_` prefix on all three directories ensures they are excluded from the existing
`fileKvStore.list` operation, which validates each entry via `cBase32ToVec` —
`_` is not a valid CBase32 character, so `_roots`, `_parts`, and `_hashes` are
rejected naturally. Without the `_` prefix, names like `roots` and `parts` could
pass CBase32 validation and be emitted as bogus content hashes by `list`.

**`_roots/`** contains one file per live root hash. Adding a file writes its entire
Merkle tree into `_parts/` and then registers the root hash in `_roots/`. Removing a
file deletes its entry from `_roots/` and triggers (or schedules) GC.

**`_parts/`** contains every node that has ever been written — data leaves and
reference nodes alike. Nodes are addressed by their hash and may be shared across
multiple roots. A node in `_parts/` is live if and only if it is reachable from some
entry in `_roots/`.

**`_hashes/`** holds the cached hash maps described below.

Strategies 1 and 2 have no such split: each CAS object IS a complete file, so
deleting it reclaims exactly one thing. Strategy 3 needs the split because a part
may be referenced by many roots and cannot be deleted by removing any one root.

## Cached hash maps (multi-hash)

### The identity problem

Strategy 3's native identity is the **Strategy 3 Merkle root** — the hash of the root
reference node in Strategy 3's `(hash, size)` encoding. This is a function of the
chunking boundaries, node encoding, and content — not just the raw bytes. A client
that knows a file only by its plain whole-file digest (`sha256(bytes)`,
`sha3-512(bytes)`) cannot address it directly, and the Merkle root is not
interoperable with external tools that speak those digests. Strategies 1 and 2,
whose identity *is* the whole-file digest, do not have this gap.

Note: even if SUL is used to determine chunk boundaries, the Strategy 3 Merkle root
and the native SUL root `Id` are **different values** — they come from different tree
encodings. The cached hash maps point to the Strategy 3 Merkle root, not to the SUL
root `Id`.

### The map

The fix is a cached, content-addressed map from each external digest to the Strategy 3
Merkle root. Each entry under `_hashes/<algo>/<digest>` is a small file whose content
is the Strategy 3 Merkle root of the file with that digest:

```
sha256(bytes)   → _hashes/sha256/<digest>     → Strategy 3 Merkle root
sha3-512(bytes) → _hashes/sha3-512/<digest>   → Strategy 3 Merkle root
```

Lookup by external digest: shard into `_hashes/<algo>/`, read the Merkle root, then
walk the Strategy 3 tree as usual. The map carries no content of its own — it is pure
metadata pointing into `_parts/`.

This keeps the internal canonical identity (the Merkle root) decoupled from external
identities (the digests), so the tree representation can evolve while callers keep
addressing content by a stable, familiar digest.

### Why validation is easier here than in Strategy 1

A flat Strategy-1 file can only be verified by reading it whole and rehashing, and a
mismatch tells you nothing about *where* the corruption is. The Merkle structure plus
the map gives finer, cheaper checks:

- **Node-level integrity** — every node carries its own hash, so a single corrupted
  node is locatable and any subtree can be validated independently, without reading
  the rest of the file.
- **Streaming whole-file verification** — recompute a digest by walking the tree
  depth-first in `O(depth)` memory, and compare to the cached entry.
- **Self-auditable map** — an entry `digest → root` is verified by re-streaming the
  tree from `root`, recomputing `digest`, and confirming it matches the key. The map
  cannot silently drift from the content it indexes.

### Multiple algorithms

Maintaining more than one algorithm (e.g. both `sha256/` and `sha3-512/`) is cheap —
one extra small file per algorithm per file — and worth doing **from the start**,
because back-filling a second digest later means re-streaming every stored file:

- **Forward security** — if one algorithm is weakened, entries for the stronger one
  already exist.
- **Interoperability** — tools that speak different digests resolve the same content.
- **Graceful migration** — stop issuing entries for a retired algorithm while keeping
  old ones readable, with no lookup gaps.

Algorithms are **optional**: write entries only for the digests you care about and
skip the rest. The Strategy 3 Merkle root is always the canonical internal identity;
the maps are an addressing convenience layered over it.

## Writing parts directly

Parts are written **directly** to `_parts/`; there is no per-tree staging area. A
writer builds its tree bottom-up, writing each part straight into `_parts/`, and
registers the root in `_roots/` only at the very end.

### Each part write must be atomic and no-clobber

Content-addressing makes a re-write *logically* idempotent — the same hash always
maps to the same bytes — but that guarantee only holds if the physical write to
`_parts/<hash>` is **atomic** and **no-clobber**. A naive backing that ends in a
plain `writeFile` to the final content path (as `fileKvStore.write` does today)
does **not** satisfy this:

- `writeFile` truncates the existing path and rewrites it in place. While those
  bytes are being written, the path is observable in a half-written state.
- If a second writer emits a part whose hash already exists, it re-truncates a part
  that is already **live** (reachable from some root). A reader walking the tree
  concurrently — or a crash mid-write — can then observe a truncated or partial
  part. This is **corruption of live content**, not a harmless orphan.

The design therefore requires that writing `_parts/<hash>` be done through one of:

- **Write-to-staging-then-rename** (Strategy 1's pipeline): write to a temp name,
  `fsync`, then atomically `rename` onto `_parts/<hash>`. `rename` is atomic, so a
  reader sees either the old complete part or the new complete part, never a partial
  one. Because content is identical for a given hash, clobbering via rename is safe.
- **No-clobber / verify-existing skip**: if `_parts/<hash>` already exists, skip the
  write entirely (optionally verifying length). Create only when absent, using an
  atomic create (`O_EXCL` link/rename), so two writers racing on the same new hash
  resolve to one complete file and the loser's attempt is a no-op.

Either path keeps the "repeated writes never conflict" property true. The plain
in-place `writeFile` path is **not** acceptable for `_parts/`: it is the one case
where re-writing an existing object is unsafe.

### Orphans from interrupted writes

Given atomic no-clobber part writes, an interrupted or abandoned write (the process
dies before registering its root) leaves **orphaned parts** in `_parts/` — complete
parts reachable from no root. These are harmless: they occupy space but are never
read, and the next GC reclaims them. No rollback, no staging cleanup, no atomic
multi-file move across the whole tree is required. This is the key simplification
over Strategy 1: an incomplete write produces collectible garbage, not corruption —
*provided each individual part write is itself atomic and no-clobber*.

## Garbage collection

Because parts are shared across roots and orphans accumulate from incomplete writes,
reclaiming space is the job of a periodic mark-and-sweep GC rather than any per-file
delete:

**Mark phase** — starting from every hash in `_roots/`, walk each Merkle tree
recursively (deserialising each reference node encountered) and mark every reachable
hash in `_parts/`.

**Sweep phase** — delete every file in `_parts/` that was not marked.

Deleting a file is just removing its entry from `_roots/`; its parts persist until a
later GC finds them unreachable.

**Concurrency hazard.** The one case GC must not mishandle is a write *in progress*:
its parts are already in `_parts/` but its root is not yet in `_roots/`, so a naive
sweep would delete parts the writer still needs. Since the lazy model already
tolerates orphans, the simplest guard is a **grace period** — never sweep a part
whose mtime is younger than the longest plausible write (it is either in-progress or
freshly orphaned, and reclaiming it can wait for the next cycle). Where a hard
guarantee is wanted instead, hold a write-phase lock (or a global GC/write mutex) so
GC skips parts belonging to a live writer — the same dead-man's-switch mechanism as
Strategy 1's `_staging` lock.

**Hash-map cleanup.** A `_hashes/<algo>/<digest>` entry points to a Strategy 3
Merkle root that GC may eventually sweep, so the map must not be allowed to dangle
into deleted content. Two options, mirroring the eager/lazy split above:

- **Eager** — when a root leaves `_roots/`, delete its `_hashes/` entries in the same
  operation. Simple, but the multi-file delete is not atomic: a crash in between
  leaves a dangling entry pointing to a now-unreachable root.
- **Lazy** (recommended) — leave entries in place and validate on lookup: resolve the
  Strategy 3 Merkle root, and if it is no longer reachable from `_roots/`, treat the
  lookup as not-found (and optionally prune the stale entry then). A dangling entry
  wastes a few bytes but never causes corruption — the same "orphans are harmless"
  reasoning that justifies direct-to-`_parts/` writes.

## Relationship to the other strategies

Strategy 3 is **layered on top of** Strategies 1 and 2 rather than an alternative to
them: it decides how a large file is *decomposed into* small objects, while
Strategy 1 or 2 decides how each small object is *physically stored*. Strategies 1
and 2 make the small-file write large-file-capable; Strategy 3 sidesteps the
large-file write entirely by never producing an object larger than 128 KiB.
