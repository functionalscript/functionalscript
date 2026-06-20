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

A file is represented in memory as a `readonly Vec[]` — an ordered list of chunks,
each no larger than `maxLengthBytes` (128 KiB). Because no single allocation
exceeds the runtime's `bigint` cap, arbitrarily large files can be held without
hitting the per-`Vec` size limit. This is the in-memory representation used by the
virtual store (tests, and any non-filesystem backing).

### Why an array rather than a single `Vec`

A single `Vec` is capped at `maxLengthBytes`, so any file larger than that cannot
be represented at all. Splitting into a list of bounded chunks lifts the cap to the
total of all chunks while keeping every individual allocation within the runtime
limit. The chunk boundary is an implementation detail of storage, not of content —
`get` re-exposes the chunks as a `ChunkStream` in order, and the consumer never
sees where one chunk ends and the next begins.

### Write pipeline

There is no real filesystem, so the staging-and-rename machinery collapses:

1. `openWrite()` — allocates an empty in-memory buffer (a growing `Vec[]`). The
   `WriteHandle` is the memory `Key` of that buffer. No OS resource, no lock.
2. `append(handle, chunk)` — pushes the chunk onto the buffer and feeds it into the
   SHA-2 state, exactly as in Strategy 1. Each chunk is bounded by `maxLengthBytes`.
3. `commit(handle, key)` — stores the accumulated `Vec[]` under `key`. This is a
   single memory assignment and is therefore atomic by construction; there is no
   partially-visible intermediate state to guard against.
4. `abort(handle)` — discards the buffer.

### What collapses relative to Strategy 1

Because commit is a single in-memory assignment rather than a cross-filesystem
rename:

- **No staging directory.** There is nothing to clean; an aborted or crashed write
  simply leaves an unreferenced buffer that is garbage-collected.
- **No lock / dead-man's switch.** No concurrent process can observe or race a
  half-written buffer, so no `flock` / open-handle hold is needed.
- **No read-only marking.** Immutability is enforced by the store never reissuing a
  `commit` for an existing key, not by OS permissions.

### Meta and read path

`Meta.size` is the sum of the byte lengths of the chunks — computed directly from
the array without consuming it. `get(key)` returns `[Meta, ChunkStream]`, where the
`ChunkStream` yields each `Vec` in stored order. Reads are pure: the buffer is
immutable once committed.

### Relationship to Strategy 1

Both strategies implement the same key-value interface
(`openWrite` / `append` / `commit` / `abort`, `get` / `list`). The streaming
caller — `cas.add(stream)` folding SHA-2 over a `ChunkStream` — is identical for
both; only the `WriteHandle` differs (a memory `Key` here, a live OS file handle in
Strategy 1). This is what lets the same `Cas<O>` handlers run over a memory backing
in tests and a filesystem backing in production.
