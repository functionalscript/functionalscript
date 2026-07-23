# Staging File Behavior

## Purpose

Files written to `.cas/_stage/` are work-in-progress uploads. The final hash
(and therefore the final shard path) is not known until the full stream has been
consumed, so the file must live somewhere temporary while data accumulates. The
`_stage/` directory serves that role.

A staging file is created by `openExclusive`, written incrementally by
`appendHandle`, and either promoted to its final path by `commitHandle` (rename +
chmod 444) or discarded by `abortHandle`. If the writer process crashes, the
staging file becomes an orphan that must be reclaimed by the cleaner.

## OS lock as dead-man's switch

`openExclusive` acquires an OS-level hold at creation time and keeps it for the
entire lifetime of the staging operation:

- **POSIX**: `flock(fd, LOCK_EX)` — exclusive advisory lock on the open file
  descriptor.
- **Windows**: the open file handle itself — Windows denies deletion of any file
  with an open handle by default.

This hold is the dead-man's switch. When a writer process crashes, the OS
releases the hold automatically. The cleaner can therefore detect orphaned files
without any manual recovery step: a file whose hold can be acquired is safe to
delete; a file whose hold cannot be acquired has an active writer and must be
left alone.

## Critical POSIX asymmetry: `unlink` bypasses `flock`

On POSIX, `flock` is a **cooperative advisory** mechanism. It has no effect on
`unlink` (the system call behind file deletion):

- A process holding `flock(LOCK_EX)` on a file does **not** prevent another
  process from calling `unlink` on that path.
- `unlink` removes the directory entry immediately. The file's inode and data
  remain accessible to any process that already has an open file descriptor, but
  the path is gone.

This means a cleaner that naively calls `unlink` on everything it finds in
`_stage/` will silently delete active staging files on POSIX. The writer
continues writing to the now-unnamed inode — `appendHandle` succeeds — but
`commitHandle`'s rename step fails with `ENOENT` because the source path no
longer exists. The committed file is never written; the data is lost.

On **Windows**, this does not happen. An open file handle blocks `DeleteFile`
(error `ERROR_SHARING_VIOLATION`), so a naive cleaner simply fails to delete
active files and skips them naturally.

| Platform | Lock mechanism | `unlink`/`DeleteFile` on locked file | Protection |
|----------|---------------|--------------------------------------|-----------|
| POSIX    | `flock(LOCK_EX)` | Succeeds — directory entry removed immediately | Cooperative only |
| Windows  | Open handle    | Fails — `ERROR_SHARING_VIOLATION`    | Hard (OS-enforced) |

## Required cleaning protocol

Because `flock` is advisory on POSIX, the cleaner **must** attempt
`tryLockExclusive` before deleting any staging file. Only if the non-blocking
lock attempt succeeds (meaning no writer holds it) is the file safe to remove.

```
tryLockExclusive(path):
  POSIX:   flock(fd, LOCK_EX | LOCK_NB)
             → FileHandle  if LOCK_NB succeeds (file is orphaned, delete it)
             → undefined   if EWOULDBLOCK     (writer is active, skip)
  Windows: attempt open with exclusive access
             → FileHandle  if open succeeds   (file is orphaned, delete it)
             → undefined   if sharing error   (writer is active, skip)
```

After acquiring the lock, the cleaner deletes the file and closes the handle.
The acquired `FileHandle` must be kept open during the delete: releasing it
before deleting would create a window where a new writer could acquire the lock
and begin staging to the same path.

A cleaner that calls `unlink` / `DeleteFile` **without** going through
`tryLockExclusive` is correct on Windows (the OS enforces the guard) but
**unsafe on POSIX** (silently corrupts active writes).

## Mtime grace period (required first check)

On POSIX, file creation (`open`) and lock acquisition (`flock`) are **separate
syscalls**. A cleaner can slip in between them: after `openExclusive` creates the
path but before the writer calls `flock(LOCK_EX)`, `tryLockExclusive` would succeed
and the cleaner would delete an active upload. The mtime grace period closes this
window and is therefore **mandatory**, not optional defence in depth.

The cleaner protocol on POSIX must be:

1. **Check mtime first.** If the file's mtime is more recent than a configured
   threshold (e.g. 60 seconds), skip it unconditionally — do not call
   `tryLockExclusive` at all. The file may be a brand-new writer in the gap between
   `open` and `flock`.
2. **Only then call `tryLockExclusive`.** If mtime is older than the threshold, the
   file is either orphaned or has a live writer. `tryLockExclusive` distinguishes the
   two cases correctly at that point.

On Windows this race does not exist (the open handle is acquired atomically with
creation), so the grace period is a belt-and-suspenders extra there; on POSIX it is
required for correctness.

The grace period threshold must exceed the longest realistic time between
`openExclusive`'s `open` call and its subsequent `flock` call. In practice this
is microseconds, so even a 1-second threshold is conservative. 60 seconds is
recommended to absorb scheduler jitter, slow disks, and process pauses.

## What happens on writer crash

1. Writer calls `openExclusive` → staging file created, flock held.
2. Writer process crashes.
3. OS releases the flock (POSIX) or closes the handle (Windows) automatically.
4. Cleaner runs, calls `tryLockExclusive` on the orphaned staging file.
5. Lock acquired → file is orphaned → cleaner deletes it and closes the handle.

No manual recovery step is needed. The dead-man's switch design means the
cleaner's protocol is identical for graceful abort and crash: in both cases,
the hold is gone and the file is collectible.

## Commit path

`commitHandle(handle, destPath)`:

1. Rename the staging file to `destPath` (the final shard path under `.cas/`).
2. Mark the file read-only (`chmod 444` on POSIX; set read-only attribute on Windows).
3. Close the file descriptor / handle and release the flock.

The rename is atomic on both POSIX and Windows (within the same filesystem). If
the process crashes between steps 1 and 2, a writable shard file may appear at
`destPath`. This is correctable: the next writer of the same content will
overwrite it (rename is atomic and idempotent for the same content), or a
repair pass can chmod it. The file's content is always correct even if the
read-only bit is missing.

## Cleaning scope

Only files under `.cas/_stage/` are eligible for cleaning. Committed shard
files under `.cas/<prefix>/` are permanent, immutable, and never cleaned.

The `_` prefix ensures `_stage/` is excluded from the `list` operation, which
validates each directory name via `cBase32ToVec` and would reject `_stage` as
an invalid base-32 prefix anyway.

## Compatibility with the existing `casUpload` path

The existing `casUpload` implementation (`fjs/cas/module.f.ts`) uses a different
staging path: `.cas/.stage/` (dot-prefixed, not underscore-prefixed). This is an
ad-hoc staging directory that predates the formal Strategy 1 design and does not
follow the `tryLockExclusive` cleaning protocol — it creates per-upload temp files
but holds no persistent flock.

The formal design uses `_stage/` because:
- The `_` prefix is the project convention for non-hash directories (excluded by
  `list` via `cBase32ToVec`).
- `.stage/` uses a dot prefix, which is valid on POSIX but can conflict with hidden
  directory conventions and is less clearly "internal infrastructure."

During the transition, a cleaner implementing Strategy 1 would scan `_stage/` and
miss any orphans left by `casUpload` in `.stage/`. Two options:

1. **Migrate `casUpload`** to write into `_stage/` so all staging files share one
   cleaning scope. This is the recommended path once Strategy 1 effects are
   implemented.
2. **Scan both** — teach the cleaner to cover `.stage/` as well. However, this
   option is **unsafe** and the mtime grace period provides no protection here:
   `casUpload` **renames** the source from `cas_upload/` into `.stage/<uuid>`
   (`fjs/cas/module.f.ts:152`), which preserves the source file's original mtime
   rather than setting a fresh one. The staged file can therefore appear arbitrarily
   old immediately after the rename — even older than the grace-period threshold —
   making a mtime-based check classify a just-started active upload as a stale orphan.
   This option must not be used until `casUpload` acquires an OS-level hold on its
   staging file (e.g. via `openExclusive` after migrating to `_stage/`).
