## 66G-cas-verify-command. `cas verify`: scrub committed shards

**Priority:** P3
**Status:** open

### Problem

`fileCas(sha2)(path).read` (`fjs/cas/module.f.mjs`, the `read` method on the `FileCas`
returned by `fileCas`) streams whatever bytes live at the addressed path without
recomputing the hash. After **synchronization by copying files**
(see `todo/plan/vision.md`), or simply over time on a faulty disk, a blob can become
corrupted, truncated, or misnamed and no longer hash to the address it sits under. Nothing
in the store currently detects this, so the `same hash = same content` invariant the rest
of the design relies on can silently break, and a bad no-overwrite file can even block a
later correct sync of the same hash.

The vision doc allows deferred verification for trusted-source copies ("copy first, verify
later, delete what fails"). That deferred step needs an actual command to run.
[`fjs/cas/plan/scrub.md`](../plan/scrub.md) designs it as the store's background
sweep — the detection half of scrubbing, which stands alone and is useful
before any peer repair exists.

### Proposal

Add a `cas verify` command (and a reusable library function behind it) that:

- iterates every stored hash via `Cas.list`,
- re-reads each blob, recomputes its SHA-2 hash, and compares it to the address,
- quarantines any blob whose recomputed hash does not match its path — the
  action `plan/scrub.md` settles, since in a single store with no redundancy
  detection is all that is possible and a corrupt shard cannot be rebuilt,
- reports a summary: number checked, number corrupted, hashes quarantined.

Intended uses:

- run once right after a copy-files synchronization from a trusted source, to catch
  corruption introduced in transit/on disk;
- run periodically (e.g. a scheduled scrub) to detect bit-rot independently of any sync.

Open design points:

- where quarantined shards go, and whether a later repair can restore one;
- exit code / output format so it is scriptable in CI and cron.

### Tasks

- [ ] Add a `verify` function over `Cas` that rehashes and reports mismatches
- [ ] Wire it as a `cas verify` CLI command in `fjs/cas/cli/module.f.mjs`
- [ ] Quarantine corrupted blobs, per `plan/scrub.md`
- [ ] Tests: seed a store with a corrupted/truncated/misnamed blob and assert it is caught
- [ ] Document the command in `fjs/cas/README.md`

### Related

- [66g-cas-get-verify-option](66g-cas-get-verify-option.md) — per-read verification for the same invariant
- [`fjs/cas/plan/scrub.md`](../plan/scrub.md) — the scrubbing design: detection by
  re-hashing against the address, quarantine, and the background sweep this command is
- `todo/plan/vision.md` — protocol-agnostic synchronization / copy-files sync
