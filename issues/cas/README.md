# File Strategy

## Strategy 1: Staging + Rename

### Overview

Large files are written to a staging area first, then atomically renamed to their
final content-addressed path once the hash is known. This avoids reading the file
twice and guarantees the CAS directory contains only complete, verified objects.

### Write pipeline

1. `openWrite()` — creates a staging file under `.cas/_staging/` and acquires an
   OS-level hold (open file descriptor on Windows; `flock` on POSIX). Returns an
   opaque `WriteHandle` token that represents this live resource.
2. `append(handle, chunk)` — writes a chunk through the held file descriptor while
   simultaneously feeding it into the SHA-2 state. The hash is accumulated
   incrementally; no buffering of the full file in memory is required.
3. `commit(handle, key)` — once the stream is exhausted and the hash is known:
   renames the staging file to its final shard path (`.cas/<prefix>/<hash>`), marks
   it read-only (`chmod 444` / equivalent), then closes the handle and releases the
   lock.
4. `abort(handle)` — on any error: closes the handle, releases the lock, and
   deletes the staging file.

The key is passed to `commit`, not to `openWrite`, because it is only known after
the full stream has been consumed. This is what allows `cas.add(stream)` and a
future `add(kv, stream, key)` helper (for the key-known case) to share the same
primitive.

### Staging directory

The staging directory is `.cas/_staging/`. The `_` prefix ensures it cannot be
confused with a hash-prefixed shard path and is excluded naturally by the `list`
operation (which validates each name via `cBase32ToVec`).

### Read-only after commit

After rename, the committed file is marked read-only. This enforces the CAS
immutability invariant at the OS level, prevents accidental overwrites of a shard
by a concurrent upload of the same content, and signals to the OS that the file is
a candidate for deduplication (copy-on-write / reflinks).

### Lock as dead-man's switch

The `WriteHandle` holds a live OS resource for the entire duration of staging:

- **Windows**: an open file handle prevents deletion by any other process.
- **POSIX**: an exclusive `flock` does not block `unlink`, but gives the cleaner a
  reliable signal — it attempts `flock(LOCK_EX | LOCK_NB)` and skips any file for
  which that returns `EWOULDBLOCK`.

When a writer process crashes, the OS releases the handle automatically. The
cleaner can then reclaim the orphan without any manual recovery step. The hold is
simultaneously the "in progress, do not touch" signal and the dead-man's switch.

### Cleaning

Only files under `.cas/_staging/` are eligible for cleaning. Committed shard files
are permanent and never cleaned.

A staging file is safe to delete when its lock can be acquired (POSIX) or its
deletion succeeds (Windows), meaning no live writer holds it. In practice:

- On POSIX: attempt `flock(fd, LOCK_EX | LOCK_NB)`. If it succeeds, the writer is
  gone; delete and close. If it returns `EWOULDBLOCK`, a writer is active; skip.
- On Windows: attempt to delete. Success means the file was not open; failure means
  a writer is active; skip.

Cleaning can run lazily — piggy-backed on `openWrite` — rather than as a scheduled
daemon, since staging files are disposable and space reclamation is not urgent.

### Read path

`readBytes(path, offset, size)` remains stateless. Committed files are immutable
and `chmod 444`, so no concurrent modification is possible and no handle needs to
be held open across calls.

### Key-value interface

```
openWrite()                → WriteHandle
append(handle, chunk)      → ok | error
commit(handle, key)        → ok | error
abort(handle)              → ok | error

get(key)                   → [Meta, ChunkStream] | not_found | error
list()                     → Vec[] | error
```

`WriteHandle` is an opaque nominal token at the FunctionalScript level, backed by
a live OS resource in the runner's interpreter state — analogous to how `Server`
and memory `Key` are modelled.

## Strategy 2: Array of Bit Vectors

### Overview

A file is represented as a `readonly Vec[]` — an ordered list of chunks, each no
larger than `maxLengthBytes` (128 KiB). The whole file is read and written as one
array: there is no windowed access and no streaming handle. This lifts the
per-`Vec` size cap while keeping the interface as simple as the original
whole-file read/write.

### Effect-layer changes

The file operations move from a single `Vec` to an array of `Vec`, and the
windowed read is retired:

| Operation   | Before                                  | After                                    |
|-------------|-----------------------------------------|------------------------------------------|
| `readFile`  | `(path) => IoResult<Vec>`               | `(path) => IoResult<readonly Vec[]>`     |
| `writeFile` | `(path, Vec) => IoResult<void>`         | `(path, readonly Vec[]) => IoResult<void>` |
| `readBytes` | `(path, offset, size) => IoResult<Vec>` | **retired**                              |

`readFile` returns every chunk at once; `writeFile` accepts every chunk at once.
`readBytes` existed only to read a file in bounded windows without exceeding the
`Vec` cap — once `readFile` returns a bounded-chunk array, windowed reads serve no
purpose and are removed.

### Why an array rather than a single `Vec`

A single `Vec` is capped at `maxLengthBytes`, so any file larger than that cannot
be represented at all. Splitting into a list of bounded chunks lifts the cap to the
total of all chunks while keeping every individual allocation within the runtime
limit. The chunk boundary is an implementation detail of storage, not of content.

### Why this is simpler than Strategy 1

Strategy 1's staging-and-rename machinery exists because it streams: it never holds
the whole file, so it must write the bytes before the hash (and therefore the final
name) is known. Strategy 2 holds the entire file in memory as an array, so the hash
is computed *before* the write:

1. Build / read the `readonly Vec[]` into memory.
2. Compute the hash over the array.
3. `writeFile(finalPath, array)` directly.

This removes the reason for the two-phase write entirely:

- **No `WriteHandle`, no `openWrite` / `append` / `commit` / `abort`** — a plain
  `read(key) => readonly Vec[]` / `write(key, readonly Vec[])` key-value interface
  suffices.
- **No staging-for-unknown-key** — the key is known before the single `writeFile`.
- **No lock / dead-man's switch / cleaning** — nothing is ever written under a name
  it does not yet match.

### Trade-off

The whole file is materialized in memory as the array. Strategy 2 is therefore
bounded by available memory (across all chunks), not by disk — it does **not**
stream. This is the opposite trade-off from Strategy 1, which streams in constant
memory but needs the staging pipeline. Strategy 2 suits the in-memory / virtual
store (tests, non-filesystem backings) and files that comfortably fit in memory;
Strategy 1 suits arbitrarily large files on a real filesystem.

> Note: on a real filesystem a single `writeFile` of a large array is not
> crash-atomic — a crash mid-write can leave a partial file under its final hash
> name. Where that matters, Strategy 2 would still borrow Strategy 1's
> write-to-staging-then-rename for atomicity. In the virtual store, `writeFile` is a
> single atomic assignment, so the concern does not arise.

### Meta and read path

`Meta.size` is the sum of the byte lengths of the chunks. Obtaining size without
reading the content still requires a separate `stat`; otherwise the size falls out
of the array `readFile` already returns. Reads are pure: a committed file is
immutable.

## Strategy 3: Merkle Tree

### Overview

Every object written to CAS is a small file of at most `maxLengthBytes` (128 KiB).
A large file is not stored as one object but as a **tree** of such objects. Each
node is one of two kinds:

- **Data leaf** — raw bytes, up to 128 KiB of file content.
- **Reference node** — an array of references to other nodes (leaves or further
  reference nodes).

The file's identity is the hash of its **root** node. A small file (≤ 128 KiB) is
the degenerate case: a single data leaf, addressed by its own hash. The address
space is uniform — every file, large or small, is named by one root hash.

### Why every object stays small

Because no node ever exceeds 128 KiB, every node fits in a single `Vec` and is
stored through the **existing** small-file primitive — `write(Vec) => hash` and
`read(hash) => Vec` — with no change. This strategy needs no streaming handle, no
staging-and-rename for large files, no windowed `readBytes`, and no new effects: it
builds arbitrarily large files entirely out of the small-file CAS that already
exists. The "large file problem" dissolves into "many small files plus a tree".

### Node encoding

Leaf and reference nodes must be distinguishable, and that distinction must be
bound into the hash (so a node's kind cannot be reinterpreted). A one-byte type tag
prefixes the object:

- `0x00` + raw bytes → data leaf.
- `0x01` + a sequence of references → reference node.

A **reference** is a `(hash, size)` pair: the child's hash plus the total byte size
of the subtree it roots. Carrying `size` in the reference (rather than only the
hash) is what enables cheap `Meta` and random access (below).

### Fan-out

With a 256-bit (32-byte) hash plus a size field, a reference node holds on the order
of thousands of references per 128 KiB object. A two-level tree therefore addresses
hundreds of MiB, three levels addresses TiB — trees stay shallow, so the per-read
node overhead is small.

### Write — bottom-up, streaming

The tree is built bottom-up while consuming the input in 128 KiB chunks, so peak
memory is `O(depth × fan-out)`, not `O(file size)`:

1. Read the next ≤128 KiB input chunk, write it as a data leaf, collect its
   `(hash, size)`.
2. Accumulate references at the current level. When enough fill a reference node (or
   input ends), write that node and promote its `(hash, size)` one level up.
3. Repeat until input is exhausted, then finalize each level. When a single
   reference remains, its hash is the root.

Every write in this pipeline is a small ≤128 KiB CAS object, so the small-file write
path (Strategy 1 or 2, or any backing) is reused unchanged.

### Read — depth-first, streaming

Reading walks the tree depth-first, left to right, yielding each data leaf's bytes
in order — a `ChunkStream` whose memory cost is the root-to-leaf path, `O(depth)`.
The consumer sees a flat byte stream and never observes the tree structure.

### Meta and random access

Because each reference carries its subtree `size`, the root reference node gives
`Meta.size` (the sum of its children's sizes) after reading **only the root** — no
full traversal. The same sizes make random access cheap: to reach byte offset `X`,
descend from the root choosing, at each level, the child whose cumulative size range
contains `X`. A single byte is reached in `O(depth)` node reads rather than scanning
the file.

### Deduplication and structural sharing

Identical content yields identical hashes, so any repeated chunk or repeated subtree
is stored once and shared across files. Editing or appending produces a new root
that **shares** every unchanged subtree, so a small change to a large file costs only
the nodes on the path from the changed leaf to the root — not a full rewrite. This is
the same property that makes Git and IPFS efficient.

> Chunking choice affects dedup. **Fixed-size** chunking (split every 128 KiB) is
> simplest but an insertion early in a file shifts every later boundary and defeats
> downstream sharing. **Content-defined** chunking (a rolling hash chooses
> boundaries) preserves sharing across insertions at the cost of complexity. Default
> to fixed-size; revisit if dedup across edited files becomes a goal.

### Trade-offs

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

### Directory structure

Strategy 3 splits the CAS directory into two subdirectories:

```
.cas/
  roots/   ← externally known root hashes (GC roots)
  parts/   ← all tree nodes: data leaves and reference nodes
```

**`roots/`** contains one file per live root hash. Adding a file writes its entire
Merkle tree into `parts/` and then registers the root hash in `roots/`. Removing a
file deletes its entry from `roots/` and triggers (or schedules) GC.

**`parts/`** contains every node that has ever been written — data leaves and
reference nodes alike. Nodes are addressed by their hash and may be shared across
multiple roots. A node in `parts/` is live if and only if it is reachable from some
entry in `roots/`.

Strategies 1 and 2 have no such split: each CAS object IS a complete file, so
deleting it reclaims exactly one thing. Strategy 3 needs the split because a part
may be referenced by many roots and cannot be deleted by removing any one root.

### Garbage collection

Because parts are shared across roots, there is no per-file delete: reclaiming space
requires tracing the live set.

**Mark phase** — starting from every hash in `roots/`, walk each Merkle tree
recursively (deserialising each reference node encountered) and mark every reachable
hash in `parts/`.

**Sweep phase** — delete every file in `parts/` that was not marked.

**Concurrency hazard.** A writer building a new tree writes parts bottom-up and
registers the root last. If GC runs between the first part write and the root
registration, those parts are not yet reachable from `roots/` and will be swept,
corrupting the partially-built tree. Mitigations follow the same pattern as
`_staging` cleanup in Strategy 1: write parts to a temporary subtree under `_staging/`,
then atomically link the root into `roots/` and the parts into `parts/`, or hold a
lock / open handle during the write phase so the GC recognises in-progress writes
and skips them.

### Relationship to the other strategies

Strategy 3 is **layered on top of** Strategies 1 and 2 rather than an alternative to
them: it decides how a large file is *decomposed into* small objects, while
Strategy 1 or 2 decides how each small object is *physically stored*. Strategies 1
and 2 make the small-file write large-file-capable; Strategy 3 sidesteps the
large-file write entirely by never producing an object larger than 128 KiB.
