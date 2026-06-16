# 66G-cas-get-verify-option. Option to verify the hash during cas get / read

**Priority:** P3
**Status:** open

## Problem

`Cas.read` / `fileKvStore.read` (`fs/cas/module.f.ts:51-57, 85-92`) and the `cas get`
command (`fs/cas/module.f.ts:126-146`) return the bytes stored at an address without
recomputing their hash. If a blob was corrupted, truncated, or misnamed — for example by
disk corruption or by a copy-files synchronization that has not yet been verified — a reader
between the copy and a later scrub can consume invalid content under a hash that was signed
or referenced elsewhere. The reader has no way to ask "and prove these bytes actually hash
to the address I requested."

A separate batch [`cas verify`](./66G-cas-verify-command.md) command catches corruption
eventually, but there is a window before it runs, and some callers want certainty at the
moment of read rather than relying on a background scrub.

## Proposal

Offer an **opt-in verification mode** on read:

- a flag on `cas get` (e.g. `--verify`) that recomputes the SHA-2 hash of the returned bytes
  and confirms it matches the requested address before writing the output file, failing with
  a clear error otherwise;
- a corresponding option at the library level (e.g. a `verifiedRead` wrapper, or a parameter
  on `cas(sha2)`) so embedders can require verification per call or per store.

Keep it opt-in: verification costs a full rehash per read, which is wasteful for hot paths
that already trust the store. Callers that need integrity (untrusted source, security-sensitive
content, freshly synced data not yet scrubbed) turn it on.

Open design points:

- default off vs. on for `cas get`;
- whether to expose it through the MCP CAS tools as well;
- error shape on mismatch (treat as not-found vs. a distinct "corrupted" error).

## Tasks

- [ ] Add a `verifiedRead`-style helper that rehashes and compares against the requested key
- [ ] Add a `--verify` flag to the `cas get` command
- [ ] Decide whether MCP CAS read tools expose the same option
- [ ] Tests: corrupted blob read with verification fails; clean blob passes
- [ ] Document the option in `fs/cas/README.md`

## Related

- [i66G-cas-verify-command](./66G-cas-verify-command.md) — batch scrub for the same invariant
- `issues/plan/vision.md` — protocol-agnostic synchronization / copy-files sync
