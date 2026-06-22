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

The design needs **no `FileHandle` type** and no held OS resource — the uploader's state is
plain data (`path`, `offset`, `hash`). Every effect is stateless and path-based, like the
existing `readBytes` / `writeFile` / `rename` effects in `fs/effects/node/module.f.ts`.

| Effect | Signature | Notes |
|---|---|---|
| `createExclusive` | `(path) => IoResult<void>` | `O_CREAT\|O_EXCL`. Creates the staging file. With 256 random bits in the name `EEXIST` never happens in practice; it is just a sanity guard. |
| `writeBytes` | `(path, offset, data: Vec) => IoResult<void>` | Mirror of `readBytes`. Opens the **existing** file (no create) and writes at `offset`. Writes the **entire** `Vec` or returns an error — no partial writes (the runner loops over short writes), so the later size check can't pass over a hole. `ENOENT` ⇒ the GC already reclaimed this file ⇒ the upload failed; delete and restart. Bounded to ≤128 KiB per call. |
| `rename` | `(src, dst) => IoResult<void>` | Already exists. Publishes the shard (`_staging/…` → `.cas/<prefix>/<hash>`) and renews the lease (`…-<rand>` → a newer deadline). Replace-on-existing is fine — same hash ⇒ same bytes. |
| `rm` | `(path) => IoResult<void>` | Already exists. Deletes a partial/aborted upload; also the GC's reclaim. |
| `stat` | `(path) => IoResult<{size}>` | **New.** Used at the end of `upload` to confirm the published shard exists with the expected size, and by resume to recover `offset = size`. |

`createExclusive`, `writeBytes`, and `stat` are **new**; `rename`, `rm`, and `mkdir` already
exist. Marking a committed shard read-only (`chmod 444`) for immutability is an optional
extra, not part of the core upload. The set is far smaller than the lock design's (no
`FileHandle`, `openExclusive`, `appendHandle`, `commitHandle`, `abortHandle`, or
`tryLockExclusive`).

## Write protocol

The upload is deliberately simple. It covers the failures that actually happen — the upload
is interrupted, the staging directory is missing, the process dies — and leaves the
vanishingly rare ones (power loss in one specific window, exotic cross-platform races) to be
**detected and repaired later by hash verification** (`scrub.md`), per the design philosophy.
It does not try to be crash-atomic.

```
upload(stream):                               // returns the content hash (the CAS key)
  rand    = random256()
  newPath = () => `_staging/${fmt(now() + delta)}-${rand}`   // delta is a fixed constant

  mkdir(`_staging`, {recursive})              // create _staging/ if absent (fresh store)
  path = newPath()
  createExclusive(path)

  offset = 0
  hash   = shaInit
  for chunk in stream:
      on any error below: rm(path); return uploadError      // partial upload ⇒ delete + fail
      writeBytes(path, offset, chunk)          // ENOENT ⇒ GC already reclaimed us ⇒ error (handled above)
      offset += len(chunk)
      hash    = shaUpdate(hash, chunk)
      next = newPath()                         // renew the lease every chunk: rename to a fresh
      rename(path, next)                       //   deadline (keeps `delta` constant — see below)
      path = next

  key = shaFinal(hash)                          // the address IS the hash of the bytes written
  dst = `.cas/${shard(key)}`
  mkdir(dirOf(dst), {recursive})                // create the hash-prefix dirs — ignore the result
  rename(path, dst)                             // publish                      — ignore the result
  rm(path)                                      // remove our staging file if still there — ignore the result
  if stat(dst).size == offset: return ok(key)   // success iff the target exists with the expected size
  else:                        return uploadError
```

Three things make this safe without extra machinery:

- **The key is computed, not supplied.** `key = shaFinal(hash)` over the bytes actually
  written, and `dst` is derived from it — so bytes can never land under a wrong address. A
  key-known caller passes its expected key only to *compare* and fail on mismatch.
- **Errors fail closed.** Any error while streaming deletes the partial file and returns an
  upload error; for a crash, the lease and the GC reclaim whatever is left behind. There is
  nothing to undo and no half-published state.
- **Publish ignores results and checks the end state.** The three publish steps — `mkdir -p`
  the prefix dirs, `rename` (which **replaces** an existing `dst`), then `rm` the staging file
  — all run best-effort with their results ignored. Success is decided afterward by *observing*
  the target: it exists and its size equals the bytes we received. This needs no branching on
  platform rename semantics and no dedup special-case. Because the rename replaces, a re-upload
  of the same content overwrites whatever was at `dst` with our freshly-written bytes — so it
  also *repairs* a same-sized corrupt shard for free, rather than skipping it. We compare
  *size*, not hash — a cheap stat, not a re-read — because a wrong-sized file is a real failure
  to catch now, while a shard that was already same-sized-but-corrupt *before* this upload is
  the rare case left to hash verification (`scrub.md`), never the hot path.

**Renewing every chunk keeps `delta` constant.** Renaming to a fresh `now() + delta` after each
chunk means `delta` only has to cover the gap between two consecutive chunks, not the whole
transfer — so it is a fixed constant, independent of payload size. The same `delta` doubles as
the stall threshold: if a chunk ever takes longer than `delta` to arrive, the lease lapses, GC
may reclaim the file, and the next `writeBytes`/`rename` fails `ENOENT` — the upload fails and
restarts (fail-safe). Renewing every chunk is the simplest choice; *Future optimizations* notes
a lazier variant.

**Explicit offset, not `O_APPEND`.** Keeping the offset makes a write idempotent — a transient
`writeBytes` error can be retried with the same bytes at the same offset with no double-append
(`appendBytes(path, data)` would just be `writeBytes(path, stat(path).size, data)`).

**Durability is best-effort by design.** The hot path does not `fsync`. A power loss that
loses a just-published shard, or a partial upload, is rare and self-correcting: a lost partial
restarts, and a lost shard is detected by hash verification and re-fetched (`scrub.md`).
Paying a per-chunk or per-commit fsync tax to shrink an already-tiny probability is exactly
the trade-off this design declines to make.

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

GC reclaims any file whose deadline is in the past. Because names sort chronologically, the
expired files are a **prefix** of the sorted listing, so the scan stops at the first live
lease:

```
gc(now):
  for name in sort(readdir(`_staging/`)):    // lexical sort = chronological
      if deadline(name) < now: rm(`_staging/${name}`)   // ENOENT is fine
      else: break                            // the rest are still live
```

Because `delta` is a fixed constant, a healthy writer's deadline is never more than `delta`
ahead of `now`, so there is nothing exotic to scan for. (A grossly wrong clock could park a
file far in the future and leak that one staging entry; that is a rare, single-file leak left
to manual cleanup, not something the core handles — see *Future optimizations*.) GC can run
lazily — piggy-backed on an upload — rather than as a daemon, since staging space reclamation
is not urgent.

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

## Future optimizations

The algorithm above is the **baseline**: the simplest thing that is correct in the
overwhelming majority of cases, with the rare residue left to hash verification (`scrub.md`).
The items below are deliberately **not** in the core. They are recorded here so they have a
home and do not creep back into the upload path as "fixes" — each is an *optional* extension,
to be added only behind a real, measured need.

- **Lazy lease renewal.** Instead of renaming after every chunk, renew only when the deadline
  is near — e.g. at the `delta/2` half-life (`now() ≥ deadline − delta/2`). This cuts rename
  frequency for fast/small-chunk streams. The cost is a smaller stall margin unless `delta` is
  enlarged: renewing at the half-life tolerates an inter-chunk gap of only `~delta/2`, so set
  `delta = 2 × maxGap` to keep the same tolerance. Baseline renews every chunk because it is
  simpler and gives the full-`delta` margin for free.
- **Stronger durability (`fsync`).** The baseline does not `fsync`; a power loss in a narrow
  window can lose a partial upload or a just-published shard, and scrub repairs the rare lost
  shard later. A writer that needs a hard durability guarantee could `fsync` the file and the
  destination directory before returning, at a latency cost.
- **Resumable / reboot-survivable uploads.** The baseline restarts a failed upload from
  scratch. A resume could instead re-hash the surviving staging bytes (`offset = stat(path).size`)
  and continue — surviving a reboot or handing the upload to another process. See
  *Reboot-survivable resume*.
- **Cross-machine / distributed uploads.** Running the same path-only protocol over shared
  storage (e.g. NFS) lets several machines upload into one store. See *Distributed and remote
  staging*.
- **Stall detection, competitive and failover uploads.** Coupling renewal to actual progress
  turns the lease into a stall detector and enables hedged/failover uploads. See *Renewal
  policy: detecting stalls*.
- **Clock-skew / far-future leak handling.** With a fixed `delta` a healthy deadline is at most
  `now + delta`, but a grossly wrong clock could park a single staging file far in the future
  and leak it. A periodic max-age sweep (delete `_staging/` entries whose deadline is absurdly
  far ahead) would reclaim it; the baseline leaves this rare case to manual cleanup.

The sections that follow document several of these extensions in detail. They are reference
material for *if* and *when* an optimization is justified — not part of the algorithm a first
implementation needs to ship.

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

Resume is **best-effort**, like everything else here. A clean restart (process exit or
graceful reboot) preserves the staging file and its name, so resume just works. A power loss
may lose the most recent bytes or the latest rename — in which case resume re-derives `size`
and the hash from whatever durably survived and continues, or, in the worst case, the file is
gone and the upload simply restarts. Either way nothing corrupts: the bytes under the final
hash are always what was hashed. We do not add an fsync cadence to make power-loss survival a
hard guarantee — that is the kind of low-probability hardening this design deliberately skips,
leaving the rare lost shard to hash verification (`scrub.md`).

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

Takeover is **discard-and-restart**: the claimant does not inherit the stalled file's bytes,
it just starts a fresh upload under its own `<deadline>-<random256>` identity. This is
trivially correct — no shared file, no in-flight-write race to reason about — and collapses
into the competitive pattern below; the worst case is that the partial bytes are thrown away.
(Inheriting a stalled holder's partial bytes is *not* safe to do casually: a fencing rename
moves the name but does not stop a previous holder's still-open fd from completing a write
into the same inode, so a naive resume could hash bytes that then change. Since the whole
point is to keep this simple, we don't inherit — we re-upload.)

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
- **Durability is the server's.** The upload path does not fsync, so a network-FS or server
  crash can lose a partial upload or a just-published shard; the partial restarts and the lost
  shard is caught by hash verification (`scrub.md`). Cache-coherence guarantees vary by
  filesystem and should be checked for the target.

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
- **Failover on a stalled upload.** A healthy uploader takes over by starting its own fresh
  upload of the same content; the stalled one's lease expires and the GC reclaims it. This is
  **discard-and-restart** — the same as the competitive case — and needs no coordination.

In both patterns the stalled uploader's partial bytes are simply discarded; we never inherit
a stalled file's bytes (see *Cross-machine handoff*).

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
  `ENOENT` and aborts, never corrupting a shard — but it does waste that upload. Size `delta`
  above the longest expected gap between chunks.
- **A wrong clock can leak one staging file.** With a fixed `delta` a healthy deadline is at
  most `now + delta`, but a grossly wrong clock could write a far-future name that GC never
  reclaims. It is a rare, single-file leak (never corruption); the baseline leaves it to
  manual cleanup, and *Future optimizations* notes a max-age sweep if it ever matters.
- **Wall-clock dependence.** Deadlines are wall-clock. On a single host (writer and GC
  share the clock) this is fine; NTP steps and suspend/resume are edge cases. Across hosts
  (see *Distributed and remote staging*) skew costs efficiency but not safety, *provided*
  the shared filesystem supplies atomic `O_EXCL` create, `rename`, and `unlink` — those
  atomic primitives, not clock agreement, are what the fencing rests on.
- **`writeBytes` must never create.** It opens the existing file only. Allowing create on the
  write path would let a reclaimed file be resurrected as a sparse file with a hole at offset
  0 — silent corruption. Exclusive create happens exactly once, when the upload starts.

## Comparison with the lock design (`staging.md`)

| Aspect | Lock (`staging.md`) | Deadline lease (this doc) |
|---|---|---|
| Liveness signal | OS-held `flock` / open handle | `<deadline>` in the filename |
| Liveness truth | Hard (OS-truthful) | Soft (timing assumption), but **fails safe** |
| POSIX/Windows | Asymmetric (advisory vs. hard) | Identical |
| Open→acquire race | Real → mandatory mtime grace period | None (atomic `O_EXCL` create) |
| `FileHandle` type / held fd | Required | None — the handle is plain data (path/offset/hash) |
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
