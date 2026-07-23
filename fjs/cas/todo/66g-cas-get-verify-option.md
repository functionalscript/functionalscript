## 66G-cas-get-verify-option. Option to verify the hash during cas get / read

**Priority:** P4
**Status:** blocked
**Blocked by:** [fjs/cli options-edsl](../../cli/todo/options-edsl.md), [command-architecture](command-architecture.md)

### Problem

`Cas.read` / `fileKvStore.read` (`fjs/cas/module.f.ts:51-57, 85-92`) and the `cas get`
command (`fjs/cas/module.f.ts:126-146`) return the bytes stored at an address without
recomputing their hash. If a blob was corrupted, truncated, or misnamed — for example by
disk corruption or by a copy-files synchronization that has not yet been verified — a reader
between the copy and a later scrub can consume invalid content under a hash that was signed
or referenced elsewhere. The reader has no way to ask "and prove these bytes actually hash
to the address I requested."

A separate batch [`cas verify`](66g-cas-verify-command.md) command catches corruption
eventually, but there is a window before it runs, and some callers want certainty at the
moment of read rather than relying on a background scrub.

### Proposal

Offer an **opt-in verification mode** on read:

- a flag on `cas get` (e.g. `--verify`) that recomputes the SHA-2 hash of the returned bytes
  and confirms it matches the requested address before writing the output file, failing with
  a clear error otherwise;
- a corresponding option at the library level (e.g. a `verifiedRead` wrapper, or a parameter
  on `cas(sha2)`) so embedders can require verification per call or per store.

Keep it opt-in: verification costs a full rehash per read, which is wasteful for hot paths
that already trust the store. Callers that need integrity (untrusted source, security-sensitive
content, freshly synced data not yet scrubbed) turn it on.

**Blocked** (see the metadata above): the `--verify` flag must be declared through the CLI
options eDSL ([fjs/cli options-edsl](../../cli/todo/options-edsl.md)), not hand-parsed out of
`args`; and whether/where the option surfaces on other transports is an exposure-matrix
decision for the CAS command architecture
([command-architecture](command-architecture.md)). A working prototype exists in the closed
PR [#1277](https://github.com/functionalscript/functionalscript/pull/1277): a streaming
`verifyHash` core (folds the read stream into a fresh SHA-2 state, so it is not bound by the
128 KiB `Vec` cap) plus CLI/MCP wiring and tests. The core function and its tests are worth
reusing; the transport wiring is what the blockers replace.

Open design points:

- default off vs. on for `cas get`;
- whether to expose it through the MCP CAS tools as well — deferred to the
  [command-architecture](command-architecture.md) exposure matrix;
- error shape on mismatch (treat as not-found vs. a distinct "corrupted" error; the
  prototype used a distinct "hash mismatch" error, which keeps a present-but-corrupted
  blob distinguishable from an absent one).

### Tasks

- [ ] Add a `verifiedRead`-style helper that rehashes and compares against the requested key
- [ ] Add a `--verify` flag to the `cas get` command
- [ ] Decide whether MCP CAS read tools expose the same option
- [ ] Tests: corrupted blob read with verification fails; clean blob passes
- [ ] Document the option in `fjs/cas/README.md`

### Related

- [66g-cas-verify-command](66g-cas-verify-command.md) — batch scrub for the same invariant
- [command-architecture](command-architecture.md) — decides which transports expose this
- [fjs/cli options-edsl](../../cli/todo/options-edsl.md) — the declarative `--verify` flag
- PR [#1277](https://github.com/functionalscript/functionalscript/pull/1277) (closed) —
  prototype implementation kept for reference
- `issues/plan/vision.md` — protocol-agnostic synchronization / copy-files sync
