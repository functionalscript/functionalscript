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

## Design philosophy

Three principles tie the whole design together; every property below is a consequence of
them.

**Strategy belongs to the uploader; mechanism belongs to the GC.** Each uploader chooses
its own lease strategy, and they need not agree. One holding an important document over a
flaky connection can pre-assign a long lease up front; a routine uploader can take a short
lease and renew on progress; a pool of hedged uploaders can all take short leases and race.
These strategies coexist in one `_staging/` directory with **no coordination**, because the
only thing an uploader communicates to the GC is a single number — the deadline in the
filename. There is no registry, no negotiation, no shared state to keep consistent.

**The contract is one line.** From the GC's side: *if a file's lease has expired, the file
is eligible to be reclaimed.* That is the entire agreement — the GC needs no knowledge of
uploader internals, progress semantics, or strategy. Note the precision: expiry makes a
file *eligible* for reclamation, it does not reclaim it. The GC is lazy and oldest-first, so
an uploader whose lease just lapsed can still win by renewing or committing before the GC
reaches it; the fencing only bites if the GC actually unlinks first, and then the loser
fails safe.

**Nothing is guaranteed at 100%, and that is the point.** The lease is best-effort: a
misjudged-slow uploader is reclaimed and restarts; a stalled one is reclaimed and a peer
takes over; a partition resolves into a restart. Because *every* outcome is fail-safe — the
worst case is wasted work, never a corrupted shard — the system does not need determinism,
and so it needs no consensus, no locks, and no central authority. Embracing probability is
what keeps it simple. The only near-deterministic layer is **hash verification**, and even
that is probabilistic: content addressing rests on collision resistance, so "same hash ⇒
same bytes" holds only up to the astronomically small probability of a collision. There is
no truly deterministic subsystem here — only one whose failure odds are small enough to
treat as certain.

The same honesty applies *after* commit. Lock-free staging minimises incorrect writes but
cannot guarantee one never happens, and a committed shard can still rot on the media long
after. The committed store therefore has its own always-on backstop — [block scrubbing and
repair](scrub.md), the committed-store dual of this directory's GC — which continuously
re-verifies shards against their hash and (in the future) repairs corruption by re-fetching
the block by hash from a friendly peer.

## Name format

The `<deadline>` must sort lexically as it sorts chronologically, so the GC can order the
directory with a plain `readdir` + sort. The encoding is a **single store-wide constant**,
not a per-client choice: **fixed-width, zero-padded UTC epoch milliseconds**.

```
0000001750512000000-3f9a…<64 hex chars>
```

The format must be canonical because the GC's oldest-first scan relies on expired files
forming one contiguous lexical *prefix* (and over-cap files one *suffix*). Mixing encodings
in the same `_staging/` breaks that invariant: every `0000…` epoch name sorts before, say,
a `2026…` ISO stamp regardless of its actual deadline, so the front scan could stop on a
live epoch file while expired ISO files sit unreclaimed after it. One encoding, fixed width,
for every writer — no alternative spellings.

Two consequences of "fixed width": the digit count must be wide enough that no realistic
deadline overflows it (millisecond epochs stay 13 digits until the year 2286; pad to a fixed
larger width for headroom), and local time ("GST"/wall-clock-with-offset) must **not** be
used — it fails to sort across DST transitions and offset changes.

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
| `stat` | `(path) => IoResult<{size, mtimeMs}>` | **New.** Used for **resume** (`offset = size`) and optional bookkeeping. `mtimeMs` is **not** required for correctness here — unlike `staging.md`, there is no open→lock gap to cover. |
| `fsync` | `(path) => IoResult<void>` | **New.** Flushes a path to disk. On a **file** path it persists the data; on a **directory** path it persists that directory's entries (creations/renames) — the same `fsync(fd)` syscall on a directory fd. `commit` needs both: file data before the rename, and the destination directory after it (so the new shard entry survives a power loss). There is no such effect in the current node set. On Windows, a directory fsync has no exact equivalent; use a write-through rename (`MOVEFILE_WRITE_THROUGH`) to make the commit durable instead. |
| `setReadonly` | `(path, readonly: bool) => IoResult<void>` | **New.** Sets (`true`) or clears (`false`) the read-only mark (`chmod 444`/`644` on POSIX; ReadOnly attribute on Windows). `commit` sets it after the rename; the **repair** path and the Windows overwrite-existing path clear it first so the rename can replace the destination. There is no such effect in the current node set. |

`createExclusive`, `writeBytes`, `stat`, `fsync`, and `setReadonly` are **new** effects to
add to `fs/effects/node/module.f.ts`; `rename`, `rm`, and `mkdir` already exist (`commit`
uses `mkdir({recursive})` to create missing shard-prefix directories, and `stat` to test
whether the destination already exists). The set is still far smaller than the lock design's
(no `FileHandle`, `openExclusive`, `appendHandle`, `commitHandle`, `abortHandle`, or
`tryLockExclusive`).

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
  handle = maybeRenew(handle)               // pre-write: don't write into a near-dead lease
  writeBytes(handle.path, handle.offset, chunk)   // ENOENT ⇒ lease lost ⇒ abort
  handle = maybeRenew(handle)               // post-write: the successful write IS the progress
                                            //   event (progress-coupled mode) — refresh now, or a
                                            //   long gap after this chunk could expire a live,
                                            //   progressing upload and have GC reclaim it
  return { ...handle,
           offset: handle.offset + len(chunk),
           hash:   shaUpdate(handle.hash, chunk) }

maybeRenew(handle):                          // lazy: avoid a rename on every chunk
  if remaining(deadline(handle.path)) < threshold: return renew(handle)
  return handle

renew(handle):
  newDl   = now() + ttl
  newPath = `_staging/${fmt(newDl)}-${rand(handle.path)}`
  rename(handle.path, newPath)              // ENOENT ⇒ GC reclaimed us ⇒ abort
  return { ...handle, path: newPath }

commit(handle, key?, mode = normal):
  computedKey = shaFinal(handle.hash)       // 0. the address is ALWAYS the hash of the bytes we wrote
  if key? and key != computedKey: return error  //   key-known/resume mismatch ⇒ caller bug or bad
                                            //   resume state ⇒ refuse (never write under a wrong address)
  fsync(handle.path)                        // 1. file data durable before the shard is visible
  dst = `.cas/${shard(computedKey)}`        //    dst is derived from computedKey, not a trusted arg

  if mode == normal and stat(dst) is ok:    // 2. fast path only — an optimization, not relied on
      rm(handle.path); return ok            //    for correctness (see the rename handler below)

  newDirs = mkdir(dirOf(dst), {recursive})  // 3. create any missing prefix dirs; record which were new
  if mode == repair: setReadonly(dst, false)//    clear the bit so the rename can overwrite a corrupt shard

  switch rename(handle.path, dst):          // 4. the rename is the atomic, authoritative point
    ok:               break
    ENOENT(source):   return error          //    lease lost ⇒ restart upload
    EEXIST/EACCES(dst): // dst appeared/locked AFTER step 2 — concurrent same-hash commit (Windows)
        if mode == normal: rm(handle.path); return ok       //    dedup success — resolve here, not at stat
        if mode == repair:                                  //    corrupt dst was re-locked concurrently
            setReadonly(dst, false)                         //    clear again and retry —
            if rename(handle.path, dst) != ok: return error //    …but CHECK the retry; still locked or
                                                            //    lease lost ⇒ fail, caller restarts
    other:            return error          //    propagate any other rename error

  fsync(dirOf(dst))                         // 5. persist the new file entry, BEFORE reporting
  for d in newDirs (deepest → shallowest):  //    success — and persist every newly-created
      fsync(parentOf(d))                    //    directory's own entry in its parent, or a crash
                                            //    can still lose the prefix path (POSIX).
  setReadonly(dst, true)                    // 6. chmod 444 / ReadOnly (durability of the bit
                                            //    itself is not critical: strategy-1.md)
  // POSIX rename replaces an existing dst silently, so the EEXIST/EACCES branch is Windows-only
  // (ReadOnly dst ⇒ MoveFileEx access-denied). A write-through move (MOVEFILE_WRITE_THROUGH)
  // can substitute for the dir fsyncs.

abort(handle):
  rm(handle.path)                           // ENOENT is fine — already reclaimed
```

**The shard address is always the hash of the bytes actually written (step 0).** `commit`
finalizes the accumulated hash and derives `dst` from *that*, never from a trusted argument.
A `key` may still be passed for the key-known and resume paths, but it is only *checked*
against `computedKey`, never used to place the file — so a caller bug or a bad resume state
fails the commit instead of writing bytes under the wrong CAS address. This is what lets the
read path (and `scrub.md`) trust the path as the checksum.

**The destination-already-exists decision is made at the `rename` (step 4), not at the
preflight `stat` (step 2).** The preflight stat is only a fast early-out; relying on it for
correctness is a TOCTOU bug, because on Windows another writer can create and lock `dst`
*between* our stat and our rename — and then a harmless concurrent same-hash upload would
wrongly report failure. Resolving "dst exists" in the rename's error branch covers that race:
in `normal` mode it is dedup success (the shard is already present — `rm` the staging file and
return ok); in `repair` mode it clears the read-only bit and replaces.

**The `normal`-mode shortcut trusts the CAS invariant and is therefore only safe when the
existing shard is assumed valid** — the ordinary dedup case. A scrub-driven **repair** commit
(`scrub.md`) recommits a key *precisely because* the existing shard is corrupt, so it never
trusts `dst`: it replaces the bytes. A caller that wants certainty rather than the fast path
can run a **verifying** commit — re-hash `dst` and replace on mismatch — at the cost of an
O(size) re-read of the existing shard.

By default the staging file's data and its directory entry are **not** fsynced on
`createExclusive`/`writeBytes`/`renew`: a staging file lost to a crash before commit just
restarts the upload (fail-safe), so only `commit` — the point where success is acknowledged
— forces durability (the file data, the destination directory entry, and any newly-created
ancestor directory entries, all persisted before returning).

That default trades durability of *in-progress* work for speed, which is fine for a
disposable upload but is in tension with the reboot-survivable resume claim below. A lease
that must survive a **power loss** (not just a process exit) needs an **optional fsync
cadence**: periodically — e.g. at each `renew` — fsync the staging file's data and the
`_staging/` directory entry, so the partial bytes and the current deadline name are durable.
This is the durability counterpart of the lease-length knob: an uploader that pre-assigns a
long lease *because it needs the document* should also opt into the fsync cadence. Without
it, resume is scoped to clean restarts (see *Reboot-survivable resume*).

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

GC reclaims a file whose deadline is either in the past (expired) **or** absurdly far in
the future (beyond the `now + MAX` lease cap — a buggy or wrong-clock writer; see *Cap the
maximum lease*). Because names sort chronologically, expired files form a **prefix** of the
sorted listing and over-cap files form a **suffix**, with the live leases in the middle. GC
reclaims from both ends and stops as soon as it reaches a live lease, so it never has to
examine the middle:

```
gc(now, MAX):
  names = sort(readdir(`_staging/`))         // lexical sort = chronological
  for name in names:                         // front → back: expired prefix
      if deadline(name) < now: rm(`_staging/${name}`)   // ENOENT is fine
      else: break
  for name in reverse(names):                // back → front: over-cap suffix
      if deadline(name) > now + MAX: rm(`_staging/${name}`)
      else: break
```

A single early `break` on the front alone would be wrong: an absurd far-future name sorts
*after* the normal future leases, so the front scan would stop before ever reaching it and
the cap would never be enforced — the space would leak until that date. The back scan closes
that gap. (A plain full scan is also correct; the directory listing is already O(n). The
two-ended form just preserves the skip-the-middle optimization.)

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

**Two reboot classes, two guarantees.** A *clean* restart — process exit or graceful reboot
where the OS flushes its buffers — preserves the staging file and its name without any extra
work, so resume is reliable. A *power loss* is different: with the default no-fsync staging
path, the most recent `writeBytes` data, the latest `renew` rename, or even the staging
directory entry may not have reached disk, so on reboot the file can be missing, rolled back
to an older (now-expired) name, or truncated. Resume stays **fail-safe** regardless — step 3
re-derives `size` and the hash from whatever *durably* survived, so it never resumes onto
wrong bytes; it simply continues from the last durable offset or, in the worst case, restarts.
But turning power-loss survival from "best-effort" into a *guarantee* requires the optional
fsync cadence described under the write protocol (fsync the staging data + `_staging/` entry
at each renew). In short: clean restarts resume for free; power-loss-durable resume is the
long-lease writer's opt-in, consistent with the design's "you choose your own strategy"
contract.

## Distributed and remote staging

The lock is the one primitive that is fundamentally process-local — `flock` does not cross
machines, and over a network filesystem it is unreliable for this purpose. The lease
replaces it with primitives a **shared filesystem already provides**, plus a clock:

- atomic exclusive create (`O_EXCL`) — claim a unique name
- atomic `rename` — renew, commit, and ownership handoff
- atomic `unlink` — GC and abort
- a wall-clock deadline — liveness

So `_staging/` can live on a remote/shared disk (e.g. an NFS export) and be driven by
uploaders running on **several machines at once**. The stateless `writeBytes` model is, if
anything, *more* network-FS-friendly than a held-handle model: NFS's weak spots are all
around open file state (silly-rename on unlink-while-open, lock recovery after a server
reboot), and the lease touches none of it — it is all path-only ops (create / rename /
unlink / pwrite-at-offset), which network filesystems support well. Dropping the
`FileHandle` removed exactly the operations NFS handles worst.

### Cross-machine handoff

Ownership transfer uses the same fencing rename — to take over, a machine renames to a new
deadline; two claimants race the atomic rename, one wins, the other gets `ENOENT` and backs
off. **The lease token doubles as the distributed mutual-exclusion primitive**: the same
rename that detects crashes also transfers ownership.

What the rename does **not** do is quiesce a previous holder that is mid-write. The fence
protects *path lookups*: once renamed, no one can `open` the old name. But on POSIX/NFS an
fd a stale holder opened **before** the rename still refers to the same inode, so an
in-flight `writeBytes` (its internal `open`+`pwrite`) can land *after* the claimant has
renamed, statted, and re-hashed the file. The claimant would then commit a shard whose
bytes changed after its hash state was built — a CAS corruption. There are two safe
takeover modes:

- **Discard-and-restart (default).** The claimant does **not** inherit bytes. It starts a
  fresh staging file under its own `<deadline>-<random256>` identity and re-uploads. This
  collapses into the competitive pattern below, is trivially correct (no shared inode, no
  race), and is fully in the design's spirit — the worst case is wasted work.
- **Inherit-with-quiescence (optimization).** To reuse the partial bytes, the claimant must
  (1) after winning the rename, wait a **quiescence grace** longer than the maximum possible
  duration of a single in-flight `writeBytes` before it stats/re-hashes — by then any
  straddling write has landed and no new one can start, because the stale holder's next
  `writeBytes` opens the now-gone old name and fails `ENOENT`; **and** (2) verify
  end-to-end at commit — re-hash the finished file from disk and compare it to `key` before
  the rename — so that if the grace is ever mis-sized the mismatch is caught and the upload
  restarts rather than committing bad bytes. (For an inherited file the claimant is already
  re-reading to rebuild hash state, so this verification largely overlaps work it must do
  anyway.)

Either way, machine-to-machine takeover otherwise works like reboot-resume: the stable
`random256` identity locates the file, and (in inherit mode) re-hash-from-disk rebuilds
`{offset, hash}`.

### Skew and partition cost throughput, not safety

This is the property that makes it usable across machines, where writers and the GC may run
on different clocks and behind partitions:

- **Clock skew.** With bounded skew δ (NTP-synced), renew with margin > δ and behaviour is
  fine. *Unbounded* skew only costs efficiency, never safety: a GC that reclaims early just
  makes the writer's next renew/commit hit `ENOENT` and fail safe. No shard is corrupted.
- **Partition.** A writer that loses the mount cannot renew → its lease expires → GC
  reclaims → the writer fails safe via `ENOENT` on reconnect. A partition is just a long
  pause, already covered by the fail-safe property.

The local virtue — worst case is a restarted upload, never corruption — is exactly what you
want in a distributed setting, where skew and partitions are the norm rather than the
exception.

### Requirements and limits

- **Atomic `O_EXCL` create + `rename` + `unlink` on the shared FS are mandatory.** This
  holds on NFSv3+/v4 — NFSv3 added exclusive-create-with-verifier precisely so `O_EXCL`
  survives retransmits, and rename/unlink are single atomic RPCs. SMB/CIFS semantics vary
  and must be checked.
- **Object stores (S3/GCS) are not POSIX** — no atomic rename, no `O_EXCL`. The
  deadline-in-name *idea* ports to their conditional-write / `If-None-Match` compare-and-set
  primitives, but that is a distinct mapping, not the same syscalls.
- **Durability is the server's.** `commit`'s fsync-before-rename relies on the server
  actually flushing; network-FS durability and cache-coherence guarantees are weaker and
  must be verified for the target filesystem.

## Renewal policy: detecting stalls, not just deaths

The lease only knows what the **renewal trigger** tells it, and *when* a writer renews
decides what "alive" means:

- **Heartbeat renewal** — renew on a timer for as long as the process runs. The lease
  detects only process death and long pauses. A stuck-but-running uploader (blocked on a
  dead source, a hung socket, a deadlock) keeps renewing and pins its file indefinitely.
- **Progress-coupled renewal** — renew *only after a part is successfully written*. The
  lease detects lack of *progress*. A stuck uploader stops renewing even though its process
  is alive, so its deadline lapses and the GC reclaims it.

Progress-coupling turns the lease into a **stall detector**: "alive but making no progress"
is treated as dead, which for an upload is usually exactly right — a stalled upload that
will never finish should release its space and its slot rather than pin them on the
strength of a still-running process.

### Competitive and failover uploads

This enables two patterns for free:

- **Competitive / hedged uploads.** Start several uploaders for the same content, each with
  its own `<deadline>-<random256>` identity. The ones that stall stop renewing and get
  GC'd; the fastest commits; CAS dedup (same hash ⇒ same bytes) makes the losers' commits
  harmless. You get tail-latency hedging with no coordination — the system discards
  stragglers automatically. *Concretely:* of two uploaders, one keeps receiving parts and
  renews its name while the other is stuck and cannot, so the GC removes the stuck one and
  the healthy one wins. The loser's partial bytes are simply discarded.
- **True failover on one partial upload.** A healthy uploader takes over a stalled holder's
  partial file via the fencing rename. By default this is **discard-and-restart** (a fresh
  identity), which is exactly the competitive case. Reusing the partial bytes
  (`resume from offset = size`) is possible but requires the **inherit-with-quiescence**
  discipline from *Cross-machine handoff* — the fencing rename alone does not stop a stale
  holder's in-flight `writeBytes` from mutating the inherited inode, so a naive resume can
  commit corrupted bytes.

The difference is only whether the `random256` identity is shared: independent identities
give competitive redundancy (loser's bytes discarded); a shared identity *can* give
resumable failover, but only with the quiescence + commit-verification safeguards above.

### The slow-vs-stuck threshold

The lease cannot perfectly distinguish a *slow* source (legitimately bursty, long gaps
between parts) from a *stuck* one (will never deliver). The TTL is the threshold you choose
between them: long enough to tolerate the longest legitimate inter-part gap, short enough
to reclaim genuine stalls promptly. Whichever way it errs, the fencing keeps it fail-safe —
a misjudged-slow uploader restarts or hands off, never corrupts.

## Trade-offs and caveats

- **Leases are a timing assumption, not a truth.** A live-but-paused writer (STW GC pause,
  container freeze, laptop sleep, debugger breakpoint) that exceeds its deadline is
  declared dead and reclaimed. The design **fails safe** — the writer detects the loss via
  `ENOENT` and aborts, never corrupting a shard — but it does waste that upload. Size the
  TTL above the longest expected gap between appends. Whether an idle-but-alive writer is
  kept or reclaimed is a deliberate choice of renewal policy (see *Renewal policy: detecting
  stalls, not just deaths*): a background heartbeat tolerates stalls; progress-coupled
  renewal reclaims them.
- **Cap the maximum lease.** A buggy or wrong-clock writer can stamp an absurd far-future
  deadline and leak space indefinitely. The GC should enforce `deadline ≤ now + MAX`
  (reclaim or reject beyond the cap). The cap bounds the leak but also bounds how long a
  legitimate long upload can pre-reserve, so it should be configurable.
- **Wall-clock dependence.** Deadlines are wall-clock. On a single host (writer and GC
  share the clock) this is fine; NTP steps and suspend/resume are edge cases. Across hosts
  (see *Distributed and remote staging*) skew costs efficiency but not safety, *provided*
  the shared filesystem supplies atomic `O_EXCL` create, `rename`, and `unlink` — those
  atomic primitives, not clock agreement, are what the fencing rests on.
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
| Works across machines / shared disk | No — lock is process-local | Yes — atomic rename + create + deadline (needs an FS that supplies them) |
| Detects a stuck-but-alive writer | No — lock is held while the process lives | Yes, with progress-coupled renewal — enables competitive/failover uploads |

## Relationship to the existing `casUpload` path

The same migration note from `staging.md` applies: `casUpload` (`fs/cas/module.f.ts`)
currently stages into `.cas/.stage/` and would be unaffected by a lease GC scanning
`_staging/`. Migrating `casUpload` to write `<deadline>-<random256>` names under
`_staging/` brings it under one GC scope. Unlike the lock design, the lease has no mtime
dependency, so the `rename`-preserves-mtime hazard described in `staging.md` does not
apply here — a migrated `casUpload` only needs to stamp a fresh deadline into the name.
