## A loose object's writer belongs beside its reader

**Priority:** P3
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs) exports only `tryRead`. The writer of a
loose object — envelope, zlib-stored stream, `tmp_obj_*` below `objects/`,
rename into `objects/ab/<rest>` — is `writeObject` in
[`fjs/cas/git`](../../../cas/git/module.f.mjs). Nothing in it is CAS-specific:
it imports `readLoose` from here, `objectPath` and `objectsDir` from
`git/store`, `of` from `git/oid`, `writeEnvelope` from `git/object` and
`stored` from `zlib/stored`. Its one CAS dependency is `random256`, whose doc
says it is exported *because* `cas/git` needs it for a loose object's
temporary file. `zlib/stored` has exactly one importer, `cas/git`; the
[`fjs/git` README](../../README.md) describes `stored` as how the loose file
is written, yet no `fjs/git` module writes one, and its "What is not here"
does not list object writing as an intended gap.

The publish step inside it — write exclusively to a staged name, rename into
place, remove the staged file where the rename fails — is what
[`fjs/git/refstore/write`](../../refstore/write/module.f.mjs) keeps private as
`unlocked` and uses twice, in `tryWrite` and `packedRewritten`. `writeObject`
is its third spelling, longhand.

### Proposal

- `fjs/git/loose` exports `write(dir, oidBytes)(type, payload)` — today's
  `writeObject` moved whole, beside `tryRead`, with its `writeObject*` proofs.
  `random256` moves to a neutral home, beside `randomInt` in
  `fjs/effects/node`, since `fjs/git` must not import `fjs/cas`.
- One exported publish helper — `published(staged, path, chunks)`: write
  exclusively, then rename, with the staged file removed on failure — used by
  `tryWrite`, `packedRewritten` and the loose writer. Its error policy is
  [compensate-step](../../../effects/todo/compensate-step.md).

`branchCas` then calls the loose writer; `WriteOperation` in `cas/git`'s
`types.ts` becomes a union of the snapshot, loose-write and `Now` operations.
[git-trusted-timestamp-signatures](../../../../todo/git-trusted-timestamp-signatures.md),
which wants to "write the final object as a standard Git `commit` object",
gets its writer from `fjs/git` instead of reaching into `fjs/cas/git`.

### Tasks

- [ ] Move `writeObject` and its proofs here; move `random256` out of `cas`.
- [ ] Export the publish helper and use it at the three sites.

### Related

- [`fjs/cas/git/todo/streaming-writes`](../../../cas/git/todo/streaming-writes.md)
  — the same function, streaming its payload; lands on the writer wherever it
  lives.
