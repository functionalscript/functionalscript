# 66N-strategy-1-impl. Implement Strategy 1 (Staging + Rename) in CAS

**Priority:** P2
**Status:** blocked
**Blocked by:** [i66N-strategy-1-effects](./66N-strategy-1-effects.md)

## Problem

The current CAS upload path in `fs/cas/module.f.ts` uses an ad-hoc `.cas/.stage/`
directory with per-upload temp files but no persistent OS-level lock. This means:

- A cleaner cannot distinguish an active upload from an orphaned staging file —
  there is no dead-man's switch to release on process crash.
- The `.stage/` directory predates the formal Strategy 1 design and does not follow
  the `tryLockExclusive` cleaning protocol (see [cas/staging.md](./cas/staging.md)).
- The mtime of a staged file can be arbitrarily old immediately after `casUpload`'s
  internal rename from `cas_upload/` into `.stage/<uuid>`, making a mtime-based
  grace check classify an active upload as stale.

Strategy 1 (see [cas/strategy-1.md](./cas/strategy-1.md)) fixes all of these by:
1. Holding an OS lock for the entire lifetime of each staging file (dead-man's switch).
2. Writing to `.cas/_staging/` (excluded from `list` via `cBase32ToVec`).
3. Atomically renaming to the final shard path once the hash is known.
4. Marking the committed file read-only (`chmod 444`) to signal immutability.

## Proposal

### Write pipeline

```
openExclusive(.cas/_staging/<uuid>)  →  FileHandle
appendHandle(handle, chunk)          →  ok | error   (repeat)
commitHandle(handle, .cas/<prefix>/<hash>)  →  ok | error
abortHandle(handle)                  →  ok | error   (on any error)
```

The `key` (`<prefix>/<hash>`) is passed to `commitHandle`, not `openExclusive`,
because it is only known after the full stream has been consumed.

### Cleaner

Runs lazily, piggy-backed on `openWrite` (CAS layer). Scans `.cas/_staging/`:

1. For each file: call `stat` to get `mtimeMs`.
2. If `mtimeMs` is newer than the grace threshold (60 s recommended), skip.
3. Call `tryLockExclusive`. If it returns `undefined`, a writer is active — skip.
4. If a `FileHandle` is returned, the file is orphaned — call `deleteHandle` (delete-then-close, not close-then-delete).

### Migration from `casUpload`

The existing `casUpload` writes to `.cas/.stage/` and is **not** safe to scan with
the new cleaner (mtime race — see [cas/staging.md](./cas/staging.md)). Migration path:

- Replace `casUpload` with the new `openExclusive / appendHandle / commitHandle / abortHandle`
  pipeline writing into `.cas/_staging/`.
- Remove the old `.stage/` staging path once no callers remain.
- Do **not** teach the new cleaner to scan `.stage/` (unsafe — see staging.md).

### Key-value interface exposed by Strategy 1

```ts
openWrite()                → WriteHandle   // = FileHandle at OS level
append(handle, chunk)      → ok | error
commit(handle, key)        → ok | error
abort(handle)              → ok | error

get(key)                   → [Meta, ChunkStream] | not_found | error
list()                     → Vec[] | error
```

`WriteHandle` at the CAS/KV layer IS the `FileHandle` at the effect layer — the
same opaque nominal token, passed through without inspection.

## Tasks

- [ ] Add `openWrite` / `append` / `commit` / `abort` to the CAS KV layer using
  `openExclusive` / `appendHandle` / `commitHandle` / `abortHandle` effects
- [ ] `openWrite`: ensure `.cas/_staging/` exists with `mkdir({ recursive: true })`
  before calling `openExclusive` — the directory is absent on a fresh store
- [ ] Write to `.cas/_staging/<uuid>` (generate UUID via `randomInt`)
- [ ] On `commit`: call `commitHandle(handle, .cas/<prefix>/<hash>)`; create
  the shard subdirectory with `mkdir` if it does not exist
- [ ] On `abort` (or any error in the pipeline): call `abortHandle`
- [ ] Implement lazy cleaner in `openWrite`: scan `.cas/_staging/`, apply
  mtime grace check + `tryLockExclusive` protocol
- [ ] Replace `casUpload` with the new pipeline; delete the `.stage/` staging path
- [ ] Integration test: write a large file in chunks; verify committed shard is
  read-only and retrievable; simulate a process crash by dropping the virtual
  runner's live `FileHandle` state (do **not** call `abortHandle` — that is
  graceful cleanup, not a crash) and verify the cleaner reclaims the orphan
- [ ] Update `fs/cas/module.f.ts` JSDoc and `cas/README.md` to reflect Strategy 1

## Related

- [cas/strategy-1.md](./cas/strategy-1.md) — full design: Windows asymmetries, read-only semantics, cleaning protocol
- [cas/staging.md](./cas/staging.md) — staging directory behavior, POSIX `flock`/`unlink` asymmetry, mtime grace period
- [cas/README.md](./cas/README.md) — strategy comparison and recommended 1→3 progression
- [i66N-strategy-1-effects](./66N-strategy-1-effects.md) — prerequisite: new effects this implementation depends on
