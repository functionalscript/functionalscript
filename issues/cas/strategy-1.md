# Strategy 1: Staging + Rename

## Overview

Large files are written to a staging area first, then atomically renamed to their
final content-addressed path once the hash is known. This avoids reading the file
twice and guarantees the CAS directory contains only complete, verified objects.

## Write pipeline

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

## Staging directory

The staging directory is `.cas/_staging/`. The `_` prefix ensures it cannot be
confused with a hash-prefixed shard path and is excluded naturally by the `list`
operation (which validates each name via `cBase32ToVec`).

## Read-only after commit

After rename, the committed file is marked read-only (`chmod 444` on POSIX; set
read-only attribute on Windows). This prevents **in-place writes** to the file
content (any subsequent `open` + `write` on the path fails with `EACCES`), signals
immutability intent to the OS (making the file a candidate for copy-on-write /
reflink deduplication), and makes accidental in-place truncation or overwrite by
application code visibly fail rather than silently corrupt a shard.

`chmod 444` does **not** prevent path-level replacement: on POSIX, a process with
write permission on the containing directory can still call `rename` or `unlink` on
the path regardless of the file's mode. Strategy 1's own commit step uses `rename`,
so it can write over an existing `chmod 444` shard. The protection against a
concurrent upload replacing live shard content therefore comes from the
**application-level CAS invariant** — same hash ⇒ same bytes — not from the OS
read-only bit. A rename onto an existing shard path is safe because the replacement
content is byte-for-byte identical to what was already there.

**Windows asymmetry**: on Windows the ReadOnly attribute prevents `MoveFileEx` from
overwriting an existing ReadOnly destination — the call fails with access denied. The
`commitHandle` implementation on Windows must detect this case: if the destination
shard already exists, the CAS invariant guarantees the content is identical, so the
correct response is to delete the staging file and return success without performing
the rename. Alternatively, `commitHandle` may clear the ReadOnly attribute on the
destination before renaming over it; both paths preserve correctness.

## Lock as dead-man's switch

The `WriteHandle` holds a live OS resource for the entire duration of staging:

- **Windows**: an open file handle prevents deletion by any other process. The handle must be opened with the `DELETE` access right so that `commitHandle` can rename the file via `SetFileInformationByHandle` while the handle is still held (see commit note below).
- **POSIX**: an exclusive `flock` does not block `unlink`, but gives the cleaner a
  reliable signal — it attempts `flock(LOCK_EX | LOCK_NB)` and skips any file for
  which that returns `EWOULDBLOCK`.

When a writer process crashes, the OS releases the handle automatically. The
cleaner can then reclaim the orphan without any manual recovery step. The hold is
simultaneously the "in progress, do not touch" signal and the dead-man's switch.

## Cleaning

Only files under `.cas/_staging/` are eligible for cleaning. Committed shard files
are permanent and never cleaned.

A staging file is safe to delete when its lock can be acquired (POSIX) or its
deletion succeeds (Windows), meaning no live writer holds it. On POSIX,
`openExclusive` creates the file and acquires `flock` in two separate syscalls, so
the mtime grace check from `staging.md` must run first — a cleaner that skips it
can win the open-to-flock race on a brand-new upload and unlink an active staging
file. In practice:

- On POSIX:
  1. Check mtime. If the file is newer than the grace-period threshold (e.g. 60 s),
     skip it unconditionally — do not call `flock`. The file may be a new writer
     between `open` and `flock`.
  2. Attempt `flock(fd, LOCK_EX | LOCK_NB)`. If it succeeds, the writer is gone;
     delete and close. If it returns `EWOULDBLOCK`, a writer is active; skip.
- On Windows: attempt to delete. Success means the file was not open; failure
  (`ERROR_SHARING_VIOLATION`) means a writer is active; skip. The mtime check is
  not required on Windows (the open handle is acquired atomically with creation)
  but is harmless to include.

Cleaning can run lazily — piggy-backed on `openWrite` — rather than as a scheduled
daemon, since staging files are disposable and space reclamation is not urgent.

## Read path

`readBytes(path, offset, size)` remains stateless. Committed files are immutable
and `chmod 444`, so no concurrent modification is possible and no handle needs to
be held open across calls.

## New effects required

Strategy 1 cannot be implemented with the existing effect set. The following
additions are needed.

### `FileHandle` type

```
FileHandle = Nominal<'fileHandle', …, unknown>
```

An opaque black-box value, exactly like `Server` and memory `Key` in the existing
effect system. The runner holds the live OS resource (open file descriptor + lock)
in its interpreter state and maps the nominal token to it. Nothing outside the
runner can inspect or forge a `FileHandle`.

### Write-side effects

| Effect | Signature | Notes |
|---|---|---|
| `openExclusive` | `(path) => IoResult<FileHandle>` | Creates the file if absent; acquires an exclusive lock (`flock(LOCK_EX)` on POSIX, inherent on Windows via open handle). |
| `appendHandle` | `(handle, data: Vec) => IoResult<void>` | Writes `data` through the held file descriptor. Bounded to ≤128 KiB per call, matching `maxLengthBytes`. |
| `commitHandle` | `(handle, destPath) => IoResult<void>` | Renames the staging file to `destPath`, marks it read-only (`chmod 444`), then closes the fd and releases the lock. **Windows**: the rename must occur while the handle is still open — use `SetFileInformationByHandle` with `FileRenameInfo` (requires the handle to have `DELETE` access). Closing before rename creates a window where the cleaner can delete the staging file. If `destPath` already exists with the ReadOnly attribute, treat it as success (CAS invariant: same hash ⇒ same bytes) and delete the staging file without renaming. |
| `abortHandle` | `(handle) => IoResult<void>` | Closes the fd and releases the lock, then deletes the staging file. |

### Read-side effects

| Effect | Signature | Notes |
|---|---|---|
| `tryLockExclusive` | `(path) => IoResult<FileHandle \| undefined>` | Non-blocking attempt: returns a `FileHandle` if the lock was acquired (file is orphaned, safe to delete), or `undefined` if another process holds it (file is active, skip). Maps to `flock(LOCK_EX \| LOCK_NB)` on POSIX; on Windows, an attempted open either succeeds or fails for the same reason. |
| `stat` | `(path) => IoResult<{readonly size: number, readonly mtimeMs: number}>` | Returns file metadata without reading content. `size` populates `Meta.size` on the read path; `mtimeMs` is required by the POSIX cleaner's mandatory mtime grace check (the first step before `tryLockExclusive`). This effect is **new** — `fs.promises.stat` is currently private to the Node interpreter's `readFile` and is not exported in the effect set. |

### Relationship to existing effects

`readBytes` (read path) remains stateless and unchanged. The new effects are
write-path and stat-path only. `appendHandle` is distinct from a hypothetical stateless
`appendFile(path, data)`: the latter opens and closes on every call, creating
lock-gap windows the cleaner could exploit; `appendHandle` keeps the fd and lock
held continuously for the lifetime of the staging operation.

## Key-value interface

```
openWrite()                → WriteHandle   (= FileHandle at the OS level)
append(handle, chunk)      → ok | error
commit(handle, key)        → ok | error
abort(handle)              → ok | error

get(key)                   → [Meta, ChunkStream] | not_found | error
list()                     → Vec[] | error
```

`WriteHandle` at the CAS/KV layer IS the `FileHandle` at the effect layer — the
same opaque nominal token, passed through without inspection.
