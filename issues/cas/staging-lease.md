# Lock-Free Staging via Deadline Leases

## Purpose

This is a lock-free alternative to the OS-lock design in [`staging.md`](staging.md).
It solves the same problem — distinguishing an active staging upload from a crashed
orphan — but replaces the `flock` / open-handle "dead-man's switch" with a **deadline
encoded in the staging file's name**. A writer stays alive by keeping its file's
deadline in the future; a garbage collector reclaims any file whose deadline has
passed.

The motivation is threefold:

1. **No lock.** `flock` on POSIX is cooperative-advisory and does not block `unlink`,
   which forces the elaborate `tryLockExclusive` + mtime-grace protocol of `staging.md`.
   Windows needs `DELETE`-access handle gymnastics for rename-while-held. The lease has
   none of this.
2. **Platform symmetry.** The protocol is byte-for-byte identical on POSIX and Windows.
   There is no advisory-vs-hard asymmetry, no open→lock race, and therefore no mandatory
   mtime grace period.
3. **Reboot-survivable uploads.** A lock is process-bound: a reboot drops it and the file
   looks orphaned. A deadline in a durable filename is process-independent, so an upload
   can survive a reboot and resume — a capability the lock design structurally cannot have.

## Core idea

A staging file's name carries its own expiry:

```
.cas/_staging/<deadline>-<random256>
```

- **`<deadline>`** — a wall-clock expiry, formatted so that lexical order equals
  chronological order (fixed-width, zero-padded, UTC). This is the **generation**.
- **`<random256>`** — 256 bits of randomness. This is the **stable identity** of the
  upload; it never changes for the life of the staging file.

A writer keeps the file alive by ensuring its deadline stays in the future, either by
**renewing** (renaming to a new deadline) or by **pre-assigning** a far-future deadline
at creation. The GC rule is simply:

> A file is reclaimable when its `<deadline>` is in the past.

Because `rename` and `unlink` on a single name are atomic, the name itself is a fencing
token: there is never a window where both "the writer keeps the file" and "the GC deleted
the file" believe they won.

## Name format

The `<deadline>` must sort lexically as it sorts chronologically, so the GC can order the
directory with a plain `readdir` + sort. Use UTC and fixed width — e.g. zero-padded epoch
milliseconds:

```
0000001750512000000-3f9a…<64 hex chars>
```

or an ISO-8601 basic-format UTC stamp:

```
20260621T120000Z-3f9a…<64 hex chars>
```

Local time ("GST"/wall-clock-with-offset) must **not** be used: it fails to sort across
DST transitions and offset changes.

## Effect set

The lease design needs **no `FileHandle` type** and no held OS resource. The `WriteHandle`
returned to the caller is plain data — `{ path, offset, hash }` — not an opaque
runner-held token. Every effect is stateless and path-based, exactly like the existing
`readBytes` / `writeFile` / `rename` effects in `fs/effects/node/module.f.ts`.

| Effect | Signature | Notes |
|---|---|---|
| `createExclusive` | `(path) => IoResult<void>` | `O_CREAT\|O_EXCL`. Creates a brand-new staging file at a `<deadline>-<random256>` name. `EEXIST` is a hard error (a 256-bit collision or a bug), not a retry signal. |
| `writeBytes` | `(path, offset, data: Vec) => IoResult<void>` | The symmetric mirror of `readBytes`. Opens the **existing** file (no create), writes `data` at `offset`. `ENOENT` ⇒ the GC reclaimed this file ⇒ the writer lost its lease and must abort. Bounded to ≤128 KiB per call, matching `maxLengthBytes`. |
| `rename` | `(src, dst) => IoResult<void>` | Already exists. Used both for **renew** (`<oldDeadline>-<rand>` → `<newDeadline>-<rand>`) and for **commit** (`_staging/...` → `.cas/<prefix>/<hash>`). |
| `rm` | `(path) => IoResult<void>` | Already exists. Used for **abort** and by the GC. |
| `stat` | `(path) => IoResult<{size, mtimeMs}>` | Used for **resume** (`offset = size`) and optional bookkeeping. `mtimeMs` is **not** required for correctness here — unlike `staging.md`, there is no open→lock gap to cover. |

`O_EXCL` is **not** mutual exclusion (the random suffix already guarantees uniqueness).
Its job is **mode discrimination**: creation must not find an existing file; appends must
find one. This makes the create-vs-append state machine total and self-checking:

- A "new upload" that hits `EEXIST` → fail loud rather than truncate live data.
- An "append" that hits `ENOENT` → the fencing signal to abort.

## Write protocol

```
WriteHandle = { path, offset, hash }   // plain data, no OS resource

openWrite(ttl):
  rand  = random256()
  dl    = now() + ttl                      // or a writer-chosen far-future deadline
  path  = `_staging/${fmt(dl)}-${rand}`
  createExclusive(path)                     // EEXIST ⇒ bug, fail
  return { path, offset: 0, hash: shaInit }

append(handle, chunk):
  if near(deadline(handle.path)):           // renew lazily, only when close to expiry
      handle = renew(handle)
  writeBytes(handle.path, handle.offset, chunk)   // ENOENT ⇒ lease lost ⇒ abort
  return { ...handle,
           offset: handle.offset + len(chunk),
           hash:   shaUpdate(handle.hash, chunk) }

renew(handle):
  newDl   = now() + ttl
  newPath = `_staging/${fmt(newDl)}-${rand(handle.path)}`
  rename(handle.path, newPath)              // ENOENT ⇒ GC reclaimed us ⇒ abort
  return { ...handle, path: newPath }

commit(handle, key):
  fsync(handle.path)                        // bytes durable before the shard is visible
  rename(handle.path, `.cas/${shard(key)}`) // ENOENT ⇒ lease lost ⇒ error, restart upload
  setReadonly(`.cas/${shard(key)}`)         // chmod 444 / ReadOnly attribute

abort(handle):
  rm(handle.path)                           // ENOENT is fine — already reclaimed
```

`append` writes at an **explicit offset** rather than `O_APPEND`. This makes every write
idempotent: a transient failure can be retried with the same bytes at the same offset
without risk of a double-append diverging the file from the in-memory hash state. An
`appendBytes(path, data)` convenience is just `writeBytes(path, stat(path).size, data)`,
but the offset belongs in the primitive.

## Why it is safe (the fencing argument)

The full name is the lease token. The GC only ever unlinks a name whose embedded deadline
has already passed. Consider a slow-but-alive writer that wakes after its deadline:

- **Writer renews first, then GC acts.** `rename(old → new)` succeeds; the GC's later
  `unlink(old)` hits `ENOENT` and is a no-op. The renewed file survives.
- **GC acts first, then writer renews.** `unlink(old)` succeeds; the writer's
  `rename(old → new)` hits `ENOENT` and the writer aborts.

There is never an interleaving in which both sides win. The only data a reclaimed writer
can have written goes to a now-unlinked inode and is discarded — exactly as in a clean
abort. **No committed shard is ever corrupted; the worst case is a wasted, restarted
upload.**

This is a strictly better failure mode than the lock design, where `staging.md` documents
that a cleaner which skips `tryLockExclusive` *silently corrupts* active POSIX writes.

## Garbage collection

GC reclaims files whose deadline is in the past, in oldest-deadline-first order:

```
gc():
  for name in sort(readdir(`_staging/`)):   // lexical sort = chronological
      if deadline(name) < now():
          rm(`_staging/${name}`)            // ENOENT is fine
      else:
          break                             // the rest are not yet expired
```

GC can run lazily (piggy-backed on `openWrite`) rather than as a daemon, since staging
space reclamation is not urgent.

### Manual / degraded-mode GC

A key property of this design: **no manual action in `_staging/` can corrupt a committed
shard.** Nothing in `_staging/` is ever a shard, and any deletion of an active file is
caught by the writer via `ENOENT` (worst case: the upload restarts). Therefore:

- A human can `ls _staging/`, read the deadline prefix as a wall-clock time, and delete
  anything in the past — no special tooling, no lock-aware cleaner, no platform branch.
- The same `ls` + `rm` procedure works identically on POSIX and Windows.
- Even a blunt "delete the first half of the sorted list" under space pressure is **safe**
  (fencing guarantees it). It is simply not always *optimal*: if most files are active,
  the first half may include not-yet-expired uploads, which then restart. The
  delete-everything-whose-deadline-is-past rule wastes nothing.

This "a tired operator can GC it correctly with `ls` and `rm`" property is the kind of
thing that survives contact with production.

## The lease knob: renew vs. pre-assign

`<deadline>` gives each upload a tunable trade-off, set entirely by the writer:

| Strategy | Renew cadence | If the writer crashes | Best for |
|---|---|---|---|
| **Short lease, frequently renewed** | rename every few seconds | reclaimed quickly | ordinary streaming uploads |
| **Long, pre-assigned deadline** | none (or rare) | orphan lingers until the far deadline | large/important uploads; reboot survival |

Both are the same mechanism (set a future deadline) at different magnitudes. A long lease
buys reboot-survivability and low churn at the cost of slower reclamation of a crashed
upload's space.

## Liveness is bound to the upload, not the process

A lock conflates two distinct facts — *the process is alive* and *the upload is alive* —
because it ties the file's liveness to an fd's lifetime. That conflation is wrong at both
ends:

- **Process alive, upload dead.** An uploader aborts but its `rm`/close fails, or it simply
  abandons the upload and moves on to other work while the process keeps running. The
  `flock` / open handle stays held for the life of the *process*, not the life of the
  *upload*. The GC can never reclaim the file, and the leak is invisible — the process
  looks healthy and is doing useful work, yet it pins a dead upload until it exits.
- **Process dead, upload should live.** A reboot drops the lock and kills an upload you
  wanted to resume (see the next section).

The lease binds liveness to the upload's own intent to stay alive — "is anyone still
pushing the deadline forward?" — which is exactly the right predicate. Abandon the upload,
leak the handle, or fail to abort, and the deadline still expires and the GC reclaims it.
A long-lived process pins nothing, because there is no process-held resource to leak.

The consequence: **cleanup is an optimization, not a correctness obligation.** `abort`
reclaims space *sooner*; skipping or failing it costs one deadline's worth of space and
then self-heals. With the lock, releasing is mandatory and every error path that misses it
leaks a file for the process's whole lifetime — the classic "you forgot the `finally`"
footgun, and the OS won't save you because the process is still alive.

## Reboot-survivable resume

Because liveness is a durable filename rather than a process-held lock, an upload can
survive a reboot:

1. The writer pre-assigns (or had renewed to) a deadline beyond the expected downtime.
2. The machine reboots. The lock-based design would lose its `flock` and the GC would eat
   the file; here the file's deadline is still in the future, so it survives.
3. On restart, the uploader locates its file by the **stable `random256` suffix**,
   `stat`s it to get `size`, re-reads bytes `[0, size)` to rebuild its SHA state, and
   resumes with `writeBytes(path, size, …)`.

Resume cost is O(bytes-so-far) because SHA-2 is not seekable and the hash state must be
rebuilt from disk. This is acceptable for the sizes involved and is the only non-O(1) part
of the design.

## Trade-offs and caveats

- **Leases are a timing assumption, not a truth.** A live-but-paused writer (STW GC pause,
  container freeze, laptop sleep, debugger breakpoint) that exceeds its deadline is
  declared dead and reclaimed. The design **fails safe** — the writer detects the loss via
  `ENOENT` and aborts, never corrupting a shard — but it does waste that upload. Size the
  TTL above the longest expected gap between appends, or renew on a background heartbeat
  for idle-but-open handles.
- **Cap the maximum lease.** A buggy or wrong-clock writer can stamp an absurd far-future
  deadline and leak space indefinitely. The GC should enforce `deadline ≤ now + MAX`
  (reclaim or reject beyond the cap). The cap bounds the leak but also bounds how long a
  legitimate long upload can pre-reserve, so it should be configurable.
- **Wall-clock dependence.** Deadlines are wall-clock. On a single host (writer and GC
  share the clock) this is fine; NTP steps and suspend/resume are edge cases. Across hosts
  over a shared filesystem (NFS) it is dangerous — but the lock design is dubious over NFS
  too, so this is not a regression.
- **`writeBytes` must never create.** Append/resume open the existing file only. Allowing
  create on the append path would let a reclaimed file be resurrected as a sparse file with
  a hole at offset 0 — silent corruption. Exclusive create happens exactly once, at
  `openWrite`.

## Comparison with the lock design (`staging.md`)

| Aspect | Lock (`staging.md`) | Deadline lease (this doc) |
|---|---|---|
| Liveness signal | OS-held `flock` / open handle | `<deadline>` in the filename |
| Liveness truth | Hard (OS-truthful) | Soft (timing assumption), but **fails safe** |
| POSIX/Windows | Asymmetric (advisory vs. hard) | Identical |
| Open→acquire race | Real → mandatory mtime grace period | None (atomic `O_EXCL` create) |
| `FileHandle` type / held fd | Required | None — `WriteHandle` is plain data |
| Cleaner protocol | `tryLockExclusive`, hold handle during delete | `rm` files with past deadlines |
| Manual `rm` in `_staging/` | Silently corrupts active writes on POSIX | Safe — worst case is a restarted upload |
| Slow-but-alive writer | Never reclaimed | May be reclaimed (fails safe) |
| Abandoned/leaked by a live process | File pinned for the process's lifetime | Reclaimed at the deadline |
| Cleanup on abort | Mandatory — missed release leaks the file | Optional — self-heals after the deadline |
| Survives reboot | No | Yes |

## Relationship to the existing `casUpload` path

The same migration note from `staging.md` applies: `casUpload` (`fs/cas/module.f.ts`)
currently stages into `.cas/.stage/` and would be unaffected by a lease GC scanning
`_staging/`. Migrating `casUpload` to write `<deadline>-<random256>` names under
`_staging/` brings it under one GC scope. Unlike the lock design, the lease has no mtime
dependency, so the `rename`-preserves-mtime hazard described in `staging.md` does not
apply here — a migrated `casUpload` only needs to stamp a fresh deadline into the name.
