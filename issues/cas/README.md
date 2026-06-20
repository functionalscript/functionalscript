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
