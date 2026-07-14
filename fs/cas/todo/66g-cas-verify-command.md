## 66G-cas-verify-command. CAS verify command: rehash stored blobs and delete corrupted ones

**Priority:** P3
**Status:** open

### Problem

`fileKvStore.read` (`fs/cas/module.f.ts:51-57`) returns whatever bytes live at the
addressed path without recomputing the hash. After **synchronization by copying files**
(see `issues/plan/vision.md`), or simply over time on a faulty disk, a blob can become
corrupted, truncated, or misnamed and no longer hash to the address it sits under. Nothing
in the store currently detects this, so the `same hash = same content` invariant the rest
of the design relies on can silently break, and a bad no-overwrite file can even block a
later correct sync of the same hash.

The vision doc allows deferred verification for trusted-source copies ("copy first, verify
later, delete what fails"). That deferred step needs an actual command to run.

### Proposal

Add a `cas verify` command (and a reusable library function behind it) that:

- iterates every stored hash via `Cas.list` / `KvStore.list`,
- re-reads each blob, recomputes its SHA-2 hash, and compares it to the address,
- deletes (or quarantines) any blob whose recomputed hash does not match its path,
- reports a summary: number checked, number corrupted, hashes removed.

Intended uses:

- run once right after a copy-files synchronization from a trusted source, to catch
  corruption introduced in transit/on disk;
- run periodically (e.g. a scheduled scrub) to detect bit-rot independently of any sync.

Open design points:

- delete vs. move-to-quarantine (safer: don't destroy until reviewed);
- whether deletion needs `Rm`/unlink effects added to the CAS operation set;
- exit code / output format so it is scriptable in CI and cron.

### Tasks

- [ ] Add a `verify` function over `Cas`/`KvStore` that rehashes and reports mismatches
- [ ] Wire it as a `cas verify` CLI command in `fs/cas/module.f.ts`
- [ ] Decide delete vs. quarantine for corrupted blobs and implement it
- [ ] Tests: seed a store with a corrupted/truncated/misnamed blob and assert it is caught
- [ ] Document the command in `fs/cas/README.md`

### Related

- [Read-time integrity](../README.md#read-time-integrity) — per-read `verifyHash` /
  `cas get --verify` / `cas_get { verify: true }` for the same invariant
- `issues/plan/vision.md` — protocol-agnostic synchronization / copy-files sync
