## write-from-stream-private-name. `writeFromStream` writes and removes by the destination's name

**Priority:** P4
**Status:** open

### Problem

`writeFromStream(path, e)` creates `path` with `createExclusive`, which closes
its handle, and then every `writeBytes` reopens `path` by name. On failure it
`rm`s `path`, also by name. Nothing binds any of these to the file the call
created.

The input that breaks it: another process removes or renames the file after
`createExclusive` and puts its own file at `path` before the stream ends. The
later `writeBytes` calls append this call's chunks to that file, and if the
stream then fails, the `rm` deletes it. `fjs cas get <hash> <path>` hands a
user-chosen path to exactly this function.

The `rm` did not create the race. It only makes the damage from it complete:
before the cleanup, the replacement was already being written into.

### Proposal

Write under a name only this call uses and publish it on success, the way the
`fjs/cas` staging upload does: `createExclusive` a random sibling
(`<path>.<rand>.partial`), stream into it, and on end-of-stream publish it to
`path`. On failure, `rm` the sibling. No other writer knows its name, so
removing it cannot remove anyone else's file. As a side effect, a reader never
sees a partial `path`, even while the write is still running.

Two questions to settle first:

- Publishing without replacing: a plain `rename` replaces whatever is at
  `path`, and `writeFromStream` refuses an existing destination today. Keeping
  that means a no-replace publish — `link` + `rm`, or `renameat2` with
  `RENAME_NOREPLACE` where the host has it. Deciding it means choosing which
  effect operation to add.
- The random name costs a `RandomInt` in the effect's operation set.

### Tasks

- [ ] Decide the publish step and the operation it needs.
- [ ] Stream into a private sibling; publish on success; remove it on failure.
- [ ] Proofs: a failure leaves neither name; a success leaves only `path`.
- [ ] `tsc`, `fjs test`, `node --test`.

### Related

- PR [#2226 review](https://github.com/functionalscript/functionalscript/pull/2226#discussion_r4094985947)
  — the review that raised it, on the change that added the cleanup.
- `fjs/cas/plan/staging-lease.md` — the same pattern for the store's uploads.
